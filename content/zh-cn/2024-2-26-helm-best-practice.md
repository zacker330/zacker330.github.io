---
layout: post
title: "云原生部署之Helm最佳实践"
Description: "Helm部署实践总结"
date: 2024-02-26
tags: [云原生,Cloud Native,Helm]
---
![helm-best-practice](/assets/images/helm-best-practice.png)

半年多前，我们从传统的Ansible自动化部署迁移到了云原生部署。我们没有通过Rancher或者KubeSphere这些平台的可视化界面部署，而是选择了Helm这个命令行工具。原因有以下几点：

1. 坚持一切版本化，一切自动化的原则；
2. Helm在声明式思维方面相对其它工具更友好；
3. 方便配置与制品分离；

Helm目前有两个版本：v2和v3。幸运的是，我们正准备大规模使用时，v3版本发布。所以，我们没有经历升级之苦。特此说明以下最佳实践基于Helm3。

注：本文针对对Helm有一定基础的同学，如果没有基础，可以先收藏。

正片开始：

### 自行版本化chart

maven、npm等构建工具的包会有一个唯一的官方源，但是，Helm的chart包似乎没有，你会遇到很多不同的源。这对chart的版本控制非常不利，因为你不知道哪天，远端的源就不见了。所以，最好的做法，使用helm pull命令将chart下载本地，然后指定一个版本上传制品库Nexus的Helm仓库中。上传命令为：

`curl -s -u '${USER_PASS}' --upload-file ${chart_name}-${charts_version}.tgz http://xxx-nexus.com/repository/helm-repo/ `

### 使用upgrade —install子命令部署应用

刚开始学习Helm时，我们通常使用helm install来安装chart。但是，第二次执行helm install，就会报错，因为K8s中已经存在了该chart的release了。这个过程对流水线是不友好的，所以，在流水线，我们使用的是`helm upgrade —install xx ./xx.tgz`来部署。

### 尽早标准化应用，标准化chart

如果存在100个微服务，我们是不是要创建100个chart呢？事实上，一开始，我们团队就是这样的。这是因为我们的微服务一开始不够标准化，所以，chart也跟着不同。后来，我们逐渐标准化了应用。chart也变成了标准。也就是所有的后端服务使用的是同一个chart。这样做的还有利于提高我们创建新的微服务的速度。

所谓标准化，指的是pod对外提供服务的端口号、优雅停机、设置环境变量的方法等等这些通用的领域的配置都应该是统一的。

### 尽量少使用if-else判断

以chart中，我们应该尽量少使用if-else判断。有时，宁愿多写几个YAML也不要在同一个文件嵌套if-else。因为要尽可能的让chart本身所见即所得。


### 使用template子命令快速调试chart

当我们在开始chart时，每次修改都要执行一次helm upgrade来验证正确性是很不经济的。Helm提供了template子命令，用于验证我们的chart的语法的正确性。示例：helm template <chart的地址>。

### 定义一个全局的values.yaml

chart中的values.yaml文件为我们提供了chart的默认配置。同时，我们可以在执行helm upgrade —install部署chart时，加入-f values.yaml来指定另外的values文件，比如：

```yaml
helm upgrade --install -f ./abc.yaml abc ./abc-chart.tgz
```

但是，有些配置，是全局性的，比如mysql的url。我们不希望它重复写在不同的应用的配置中。所以，我们定义一个全局的values.yaml。比如：global-value.yaml。helm的命令将变成：

```yaml
helm upgrade --install -f ./global-value.yaml -f ./abc.yaml abc ./abc-chart.tgz
```

### 利用helm的-f参数的顺序实现配置的优先级

当全局values文件与应用的values存在配置冲突的时候，通过会采用应用的values文件中的配置。需要注意的是 -f 参数的顺序。后一个 -f 参数的配置会覆盖前一个-f参数的配置。 

### 多版本的实现

过去，我们通常是一个应用一个版本。但是，现在我们更多的是一个应用线上同时存在多个版本。所以，一个chart能同时部署多个版本的应用。

```yaml
helm upgrade --install -f ./global-value.yaml -f ./abc.yaml  --set 'image.tag={1.2.1,1.2.3}'  abc ./abc-chart.tgz
```

chart中的deployment文件：

```yaml
{{/* globle变量缓存全局变量, 遍历tag的同时，再将全局变量变回 */}}
{{- $global := . -}}
{{- range .Values.image.tag }}
{{- $version := . -}}
{{- with $global }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "abc.fullname" . }}-{{ $version }}
  labels:
    version: {{ $version }}
spec:
# 注意此处，我们可以针对不同的版本设置不同的副本数
{{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
{{- end }}
  selector:
    matchLabels:
      {{- include "abc.selectorLabels" . | nindent 6 }}
      version: {{ $version }}
  template:
    ...省略无关代码...
      containers:
        - name: {{ .Chart.Name }}
	  ...省略无关代码...
          image: "{{ .Values.image.repository }}:{{ $version | default .Chart.AppVersion }}"
          
      
  {{- end }}
{{- end }}
```

### 所有的内容都通过chart进行部署

也许你会觉得创建一个namespace就是一个命令的事情，不需要使用helm了。但是，基于持续交付的原则——一切版本化，一切自动化——我们强烈建议，任何操作都应该通过helm进行。比如，我们可以专门创建一个管理Kubernetes的chart。这个chart中，我们就可以实现根据配置创建namespace。再说说Istio这个流行的网格服务的框架。它本身提供了，istioctl命令行进行部署。但是，我们还是建议你使用helm的方式进行部署。因为这样，你才能获得更多的可控性。
