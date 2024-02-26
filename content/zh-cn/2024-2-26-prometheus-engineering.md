---
layout: post
title: "SRE-DevOps不得不懂的：Prometheus的配置工程化"
Description: "优雅地管理Prometheus的配置"
date: 2024-02-26
tags: [云原生,Cloud Native,Prometheus]
---
# 背景
Prometheus有两个最基本的组件：一个是Prometheus程序，一个是Alertmanager程序。

它们的职责分工很明确：
- Prometheus程序负责：定时拉取监控指标数据、存储指标数据、根据告警规则发起告警通知；
- Alertmanager程序负责：负责告警通知的路由，即当接收到Prometheus程序的通知后，该将通知以何种方式通知给谁。

![](/assets/images/prometheus-config-1.png)



Prometheus程序的配置最核心的[配置](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#configuration)是：

```yaml
# ... 

# 当指标数据符合什么规则进行告警通知。
# 在其它文件定义，这里只是引用该文件的路径。
rule_files:
  [ - <filepath_glob> ... ]

# 从哪里，该如何拉取指标
scrape_configs:
  [ - <scrape_config> ... ]
  
# ...
```

Alertmanager程序的配置最核心的[配置](https://prometheus.io/docs/alerting/latest/configuration/#configuration)是：

```yaml
# ...
# 告警通知路由规则
route:
	[- <route_config>-]
# 告警通知的接收者列表，部分监控告警平台也称之为channel
receivers:
	[- <receivers>-]
# ...
```

在实际工作中，Prometheus和Alertmanager的配置会非常大。

严谨的软件工程要求我们在真正部署这些配置前，对其进行有效性和正确性的检查。否则SRE/DevOps的工程效率就会很低，因为你需要手工调试庞大的配置。

所以，我们需要有一种高效率的方式来保证配置的有效性和正确性。

# 保证Prometheus程序配置的有效性和正确性

## promtool

Prometheus程序提供了一个叫promtool的命令行程序。解压Prometheus的程序包后，你会发现它和Prometheus程序放在一个文件夹中。

promtool提供了一些子命令来保证Prometheus程序配置的有效性和正确性：

```shell
# 校验Prometheus配置的有效性，它支持--lint="duplicate-rules"参数，用于检查重复的rule配置
check config [<flags>] <config-files>...
# 校验rule配置的有效性
check rules [<flags>] <rule-files>...
# 执行rules单元测试用例
test rules <test-rule-file>...
```

至于有效性检查，只需要执行check子命令即可，不需要过多说明。

promtool的`test rules`子命令可以实现rule配置的单元测试，具体命令如下：

```bash
./promtool test rules test.yml
```

test.yaml是单元测试描述文件。promtool是支持同时指定多个单元测试文件的，如：`./promtool test rules test.yml test1.yml test2.yml`

单元测试描述文件内容的格式如下：

```yaml
# Prometheus的rule配置文件路径
rule_files:
    - rule1.yml

# 评估的间隔时长
evaluation_interval: 1m

# 单元测试列表
tests:
- interval: 1m
  input_series:
  alert_rule_test:
  promql_expr_test:
```

`tests`下的每个用例由4个字段组成：
1. input_series：测试用例的测试数据，即指标的时序数据；
2. interval：代表每个时序数据之间的间隔时长；
3. alert_rule_test：告警规则的测试用例；
4. promql_expr_test：promql表达式的测试用例。我们可以使用它进行调试我们的promsql。

接下来将详细介绍它们。


## 测试用例数据
测试用例数据的定义格式如下：

```yaml
  input_series:
  - series: 'up{job="prometheus", instance="localhost:9090"}'
	values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'
  - series: 'up{job="node_exporter", instance="localhost:9100"}'
	values: '1+0x6 0 0 0 0 0 0 0 0' 
  - series: 'go_goroutines{job="prometheus", instance="localhost:9090"}'
	values: '10+10x2 30+20x5' 
  - series: 'go_goroutines{job="node_exporter", instance="localhost:9100"}'
	values: '10+10x7 10+30x4' 
```

每一条input_serie由两个字段组成：
- series：指标时序数据的key
- values：指标的value。其中的每一个值之间的间隔时长是`interval`的值

为了简化values的值的定义，你可以一种扩展符号来定义其值。语法如下：
- `a+bxc`代表：`a a+b a+(2*b) a+(3*b) … a+(c*b)`；这一个a值是起始值的序列，然后a以b的(0..c)的倍数进行递增；
- `a-bxc`表示：这一个a值是起始值的序列，然后a以b的(0..c)的倍数进行递减；
- `_`下划线表示：序列中的某次指标值没有被抓取到；
- `stale`表示：过期的样本数据。
以下是一些来自官方文档的例子：
- `-2+4x3`表示：`-2 2 6 10`
- `1-2x4`表示：`1 -1 -3 -5 -7`
- `1x4`表示：`1 1 1 1 1`
- `1 _x3 stale`表示：`1 _ _ _ stale`
- `1+0x6 0 0 0 0 0 0 0 0`表示： `1 1 1 1 1 1 1 0 0 0 0 0 0 0 0`
- `10+10x2 30+20x5`表示：10 20 30 30 50 70 90 110 130

## 测试Promsql表达式
在写Prometheus告警规则时，一个很大的痛点就是无法简单的验证自己写的promsql的正确性。我们在告警规则的单元测试中验证后，再配置到真正的rule文件中。

promsql的测试用例的写法如下：
```yaml
  promql_expr_test:
  - expr: go_goroutines > 5 
	# 要测试的promsql表达式，它将会从测试数据中查询数据
	eval_time: 4m
	# 评估时长。从测试数据的第0秒开始算。
	# 如果interval是1m，那么4m代表的是测试数据的第4个数值
	exp_samples: # 执行promsql表达式后，预期得到的数据结果
		- labels: 'go_goroutines{job="prometheus",instance="localhost:9090"}'
		  value: 50
		- labels: 'go_goroutines{job="node_exporter",instance="localhost:9100"}'
		  value: 50
```

## 告警规则的单元测试

在单元测试描述文件中，添加Promsql表达式的测试用例的同时，我们还可以添加告警规则的测试用例，代码样例如下：
```yaml
alert_rule_test:
- eval_time: 10m
  alertname: InstanceDown
  exp_alerts:
  - exp_labels:
	  severity: page
	  instance: localhost:9090
	  job: prometheus
	exp_annotations:
	  summary: "Instance localhost:9090 down"
	  description: "localhost:9090 of job prometheus has been down for more than 5 minutes."
```

- eval_time：规则评估时长；
- alertname：告警名，要求与Prometheus的告警规则中的alertname一致；
- exp_labels：预期收到的告警通知中的label值；
- exp_annotations：预期收到的告警通知中的annotation值。

# 保证Alertmanager程序配置的有效性和正确性

## amtool

与Prometheus程序类似，Alertmanager程序提供了一个叫[amtool](https://github.com/prometheus/alertmanager#amtool)的命令行程序。

我们关注它的两个子命令：
- `config routes test`：验证配置的正确性
- `check-config <config.yaml>`：验证配置的有效性

## config routes test子命令介绍
amtool不像promtool那样支持在YAML文件中定义测试用例，以下是它的命令样例：
`amtool config routes test --config.file=config.yaml --verify.receivers=team-X-pager service=database owner=team-X`

`--config.file`参数指定了配置文件的路径。

除了支持指定配置的路径，还可以通过参数`--alertmanager.url`指定使用某个运行中的Alertmanager的配置。

`--verify.receivers`指定期望返回的receiver列表，使用逗号分隔。

该子命令的最后是标签集，由key=value的格式组成，并使用空格分隔。例子中`service=database owner=team-X`，代表的是`{service="database",owner="team-X"}`

为了更好的可视化，还可以加一个`--tree`的参数，效果如下：
```bash
% amtool config routes test --config.file=config.yaml --tree --verify.receivers=team-X-pager service=database owner=team-X

Matching routes:
.
└── default-route
    └── {service="database"}
        └── {owner="team-X"}  receiver: team-X-pager
```

如果验证失败，该命令返回非0结果。

## check-config子命令介绍

它的运行效果如下：

```bash
% amtool check-config config.yaml
Checking 'config.yaml'  SUCCESS
Found:
 - global config
 - route
 - 1 inhibit rules
 - 5 receivers
 - 1 templates
  SUCCESS
```
如果验证失败，该命令返回非0结果。


## 可视化告警通知路由

Prometheus官网提供了一个告警通知路由的[在线可视化编辑器](https://prometheus.io/webtools/alerting/routing-tree-editor/?_gl=1)。

![alertmanager-route-editor.png](/assets/images/prometheus-config-2.png)

将配置粘贴至编辑框中，然后在“Match Label Set”中输入告警的标签，最后下方会显示通知的路由路径。如下图，实心红点即是匹配了该label的receiver：

![alertmanager-route-editor.png](/assets/images/prometheus-config-3.png)pro


可视化工具在路由配置调试阶段非常有用。减小了路由配置的难度。但是，需要注意：不要将任何敏感配置上传到公网。


# 如何集成到CI/CD Pipeline中

以上介绍的是两个命令最原始的使用方法，即手工运行。我们需要将其集成到CI/CD pipeline中，以实现工程化。

集成方式一般有两：
1. 在Pipeline中增加一个执行promtool和amtool的阶段
2. 集成构建工具中，比如集成到Bazel中。

当然有一些DevOps平台如果需要深度集成，可以将promtool的amtool的实现代码引入到自己的DevOps平台的代码中。


# 工程化的挑战
另一个工程化的挑战，就是以上的配置文件之间存在引用，如下prometheus的rule文件中的expr字段的值，实际上是被prometheus-unitesting.yml文件引用。

![](https://upload-images.jianshu.io/upload_images/292372-26b61dfe31e0de99.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


如果不对这个引用关系进行治理，这些配置的维护成本将会非常高。

由于YAML文件天生不具备变量定义的功能。可以采用类似Jsonnet、CUE这样的支持编程的配置语言代替YAML。

这个话题比较大，不在本文讨论范围。


