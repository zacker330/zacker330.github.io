---
layout: post
title: "使用 Jenkins + Ansible 实现跨应用配置管理"
Description: ""
date: 2020-03-12
comments: true
share: true
---
![image.png](/assets/images/292372-29bb768786bc0467.png)

本文继续前两篇 Jenkins + Ansible 的文章（见附录）的例子。代码仓库结构与 《使用 Jenkins + Ansible 实现 Spring Boot 自动化部署101》 介绍的相似。

但是以下改进：
1. 增加了展示跨应用配置管理的样例（本文重点）
2. 实现了二进制包与配置分离

### 跨应用配置是什么
《持续交付》的2.4.4节介绍了“跨应用配置管理”。但是书中没有明确给出它的定义。以下是笔者所理解的“跨应用配置”：

> 所谓跨应用配置指的是在同一个配置项同时被多个应用引用。

比如现实中同一个 Redis 的配置项（如地址、端口）就可能同时被多个业务系统引用。如下图所示。
![image.png](/assets/images/292372-fc2abb960d0575b5.png)

### 为什么要进行跨应用的配置管理

如果没有跨应用配置的管理，我们就必须在应用1和应用2的配置文件中写死 redis 的配置项（在没有配置中心的情况下）。这样一看是没有问题的。但是笔者认为应用在到达10个以上的时候会（经常）遇到以下问题：

1. 无法实现快速重建一整套新的环境。新的环境意味着新的 redis 地址。也意味着所有引用了 redis 地址的应用的配置都要改。手工修改很容易出错。
2. 当你希望对现有的 redis 进行调整时，你无法评估影响面，因为你不知道哪些应用使用了这个 redis。进而，导致团队对架构优化的信心不足。

这两个问题会随着系统数量增加而加重。

那么如何实现跨应用的配置管理以解决上述问题呢？

### 如何实现跨应用的配置管理
如果使用如 Ansible、Puppet、Chef 这类自动化工具，跨应用的配置管理就很容易实现。因为它们的变量系统，天生就支持一处定义配置项，其它地方到处引用。对 Ansible 变量不熟悉的同学可以在文末找到学习链接。

在我们的 Nginx + Spring Boot 的例子中，对配置代码仓库（2-env-conf）进行了调整，结构如下：

```yaml
├── Jenkinsfile
├── README.MD
└── dev
    ├── group_vars
    │   ├── all  # Ansible 默认的 all 组变量目录
    │   │   └── global.yaml  
    │   └── nginx.yaml # nginx 组变量
    ├── host_vars
    │   ├── 192.168.52.10
    │   └── 192.168.52.11
    └── hosts
```

因为 Spring Boot 应用的端口会被 Nginx 的配置引用，所以，我们将端口的配置项放到 global.yaml 中，代码如下所示。

```yaml
app_springboot_config:
  port: 7896
```

`nginx.yaml` 文件在 group_vars 目录中代表它是 nginx 这个组的变量文件。以下是它的部分配置项。

```yaml
servers:
  backend_server_1:
    address: "{{groups['springboot'][0]}}"
    port: "{{ app_springboot_config.port }}"
    weight: 1
    health_check: max_fails=3 fail_timeout=5s
```
这里需要简单介绍一下。Ansible 使用了 Jinja2 模板系统。`{{ }}` 是它的占位符。占位符中，可以使用 `.` 号访问该配置的属性。`port: "{{ app_springboot_config.port }}" ` 最终会变成：`port: "7896"`。

Ansible 在执行过程，默认会提供一些默认变量，比如 `groups`。

`groups` 是 inventory（就是那个 hosts 文件）中所有群组（主机）的列表。可用于枚举群组中的所有主机。除了使用 `.` 号访问配置的属性，还可以使用 `配置['属性名']` 的方式。而 `[0]` 代表取数组中的第0个。

因为目前后端只有一个 Spring Boot 应用。所以，取第0个配置到 Nginx 中就可以。

同时，Spring Boot 应用本身的 application.yml 配置文件也使用了 `app_springboot_config` 配置项。这样就实现真正的一处定义，多处引用了。

最后，本文代码样例都放在 [https://github.com/cd-in-practice](https://github.com/cd-in-practice)下 2- 开头的工程：

```shell
tree -L 1
├── 2-cd-platform
├── 2-env-conf
├── 2-nginx-deploy
└── 2-springboot
```

## 附：
* Jinja2 模板系统：[http://jinja.pocoo.org/docs/2.10/](http://jinja.pocoo.org/docs/2.10/)
* 使用 Jenkins + Ansible 实现 Spring Boot 自动化部署101：[https://jenkins-zh.cn/wechat/articles/2019/05/2019-05-20-jenkins-ansible-springboot/](https://jenkins-zh.cn/wechat/articles/2019/05/2019-05-20-jenkins-ansible-springboot/)
* 使用 Jenkins + Ansible 实现自动化部署 Nginx
：[https://jenkins-zh.cn/wechat/articles/2019/04/2019-04-25-jenkins-ansible-nginx/](https://jenkins-zh.cn/wechat/articles/2019/04/2019-04-25-jenkins-ansible-nginx/)
* Ansible 变量：[https://ansible-tran.readthedocs.io/en/latest/docs/playbooks_variables.html](https://ansible-tran.readthedocs.io/en/latest/docs/playbooks_variables.html)
