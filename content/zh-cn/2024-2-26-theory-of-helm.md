---
layout: post
title: "Kubernetes包管理器Helm的本质"
Description: "了解Helm的本质后，学习其它工具就很容易了"
date: 2024-02-26
tags: [云原生,Cloud Native,Helm]
---
“本质”类的文章，通常很难带流量。而且写起来非常吃力。

那我为什么还要写？写作是对自己的锻炼。写作是让自己的思想更有深度的一种有效方式。

如果你觉得这篇文章对你有帮助，也你麻烦你转发这篇文章，这是对我的帮助。谢谢。


## Kubernetes 的包管理器的本质

“Helm 是 Kubernetes 的包管理器”。Helm的官方网站如是说。

那什么是“Kubernetes 的包管理器”？

我们假设需要在没包管理器的场景下部署资源，你需要一个个文件手工地执行`kubectl apply -f abc.yaml`，abc.yaml就是Kubernetes的资源的定义文件。

文件内容如下：

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
	name: abc
	labels:
		app.kubernetes.io/name: abc
spec:
	replicas: 1
	selector:
		matchLabels:
			app.kubernetes.io/name: abc
```

当需要卸载资源呢？你又需要手工执行`kubectl delete -f abc.yaml`。

所以每次发布，你都必须有一个发布记录，记录下哪些YAML要执行apply，哪些yaml要执行delete。而且delete后，你还要记得将那个文件从文件夹中删除。

如果每次手工执行，工作量大不说，还很容易出错。所以，有人会想到使用Shell脚本或者Python脚本来解决这些问题。

当你通过Shell脚本或者Python脚本能自动化解决以上问题时，实际上就等于实现了一个Kubernetes 的包管理器。

当我们真正理解以上所说的Kubernetes资源的部署问题后，你就明白了Kubernetes 的包管理器其实就两个核心功能：
1. 自动化执行Kubenetes资源更新；
2. 跟踪Kubenetes资源更新记录（本质还是版本化）。

我们在选择包管理器时，务必要从这两个角度考虑。像Grafana公司Tanka，并不是一开始就实现“跟踪Kubenetes资源更新记录”功能，具体可以看：https://github.com/grafana/tanka/issues/88 。


## Helm是如何实现包管理的

注：本文讲的是Helm3。Helm2与Helm3存在较大差异。

### Helm的包：Chart
假如存在一个微服务x，我们将其部署到Kubernetes中，需要准备Deployment、HPA、Service的这三种资源的YAML文件。这三个文件，统一放在一个文件夹中。

Helm本身是一个命令行工具。通过package子命令，可以将整个文件夹打包成一个tgz的压缩包。打包命令为：`helm package x-service --version 1.0` 。打包结果是一个tgz包。如下图：
![Pasted image 20221213140013.png](https://upload-images.jianshu.io/upload_images/292372-c272b0d600a1417f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

这个tgz包，我们称之为Chart包。本质上它就是Kubernetes的资源文件的一个集合。

我们可以将Chart包上传到Nexus这类制品管理工具进行版本化控制。这涉及到Chart的管理的工程实践，不在本文范围。

在有了Chart包以后，我们可以通过命令`helm install <release> <chart路径>`将svc安装到指定的Kubernetes集群上。如x-svc的部署指令将会是：`helm install x-svc ./x-svc-1.0.tgz`。

`release`是Helm的一个概念，即发布名。每执行一次helm install，对于Helm来说就是创建一个release。通常我们使用应用名作为发布名。

release这个概念在资源变更跟踪中环节非常重要。后面会反复使用此概念。

### 使用模板技术解决Chart的规模性问题

实际工作中，我们还会有y-svc、z-svc……n个服务。我们是不是每个服务要创建一个Chart？另外，每个服务都将被部署到三个环境中，那么，是不是每个环境还要单独又创建一个Chart？最终，我们需要服务与环境两个维度进行排列组合个Chart。

如果不能很好解决这个问题。Chart的数量会爆炸式增长。Helm如何解决这个问题呢？

它通过模板技术解决。换句话说，就是将Chart中资源文件中的容易变化的部分配置抽离出来变成变量，不变的部分变成模板。

变量部分配置统一放在Chart包中的values.yaml文件中。所以，这部分配置，我们通常也称为values配置，或者values文件。

这样，我们的Chart包的结构就变成如下（实际还有一些别的文件，但是不是本文讨论范围）：

![Pasted image 20221213151111.png](https://upload-images.jianshu.io/upload_images/292372-318d56cd0c4df44f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

对于Chart中不变的部分，Helm使用gotemplate模板语言进行描述。就是说我们可以在deployments.yaml中直接写gotemplate模板语言了，如代码1：
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
	name: {{ .Values.name }}
	labels:
	{{- include "demo.labels" . | nindent 4 }}
...篇幅有限，省略
		resources:
			{{- toYaml .Values.resources | nindent 12 }}
```

我们无意挑起模板语言的战争，我们对gotemplate没有好感。你需要小心翼翼地去维护模板文件中的空格数量。如代码1的最后一行，它的意思是指该YAML块缩进12个空格。

关键问题我们该如何确定它应该是12，而不是10呢？而且，如果重构这部分代码，我又要重新算一次空格的数量！

使用gotemplate作为它的模板语言是它的最大错误。我们可能需要另外写一篇文章介绍规避这个问题的方法。

在写Helm的gotemplate模板时，建议不要写太复杂的逻辑，代码宁可重复，甚至另创建一个新的Chart。

### 执行资源变更

当values与Chart都已经准备好之后，我们通过以下命令，即可将x-svc的所有的资源部署到指定的namespace中：
```shell
helm install x-svc ./svc-chart-1.0.tgz -f x-svc-value.yaml
```
注意，一个不存在的服务，首次部署时是要执行install子命令。将来更新时，就只能执行upgrade子命令了。

以此类推，y-svc的部署命令就是：
```shell
helm install y-svc ./svc-chart-1.0.tgz -f y-svc-value.yaml
```

在执行install成功后，如果你需要修改该release，你需要执行upgrade指令，如下：
```
helm upgrade y-svc ./svc-chart-2.0.tgz -f y-svc-value.yaml
```

但是，helm是如何知道是要执行创建/变更资源，还是要执行删除资源呢？svc-chart-2.0.tgz比1.0版本可能少了deployment资源。

这就涉及到资源变更的跟踪了。


### 资源变更跟踪
在介绍“资源变更跟踪”前，我们先介绍几个重要的相关子命令：
1. upgrade：更新已存在的release。如：`helm upgrade y-svc ./svc-chart-1.0.tgz -f y-svc-value.yaml`；
2. list：列出所有的已经安装的release；
3. rollback: 将指定的release进行回滚。甚至可以指定回滚到某个版本，命令：`helm rollback <RELEASE> [REVISION] [flags]`；
4. history: 列出release的发布记录。

有些同学可能发现问题了：执行helm命令时，即没有默认的，也没有显示指定的release持久化方式，这些release信息是记录在哪里的？

同时，这又与我们上文说的“资源变更跟踪”有什么关系？

它们是相关的。Helm的核心原理就在此：
1. 当首次部署时，使用install，这时，Helm会直接在指定命名空间（默认是default）下，创建一个helm.sh/release类型的secret。secret的名称定义为：sh.helm.release.v1.release.v1。secret的内容是这次执行的所有的Kubernetes资源的YAML内容。
2. 当使用upgrade更新时，Helm从sh.helm.release.v1.release.v1的secret取出所有的YAML资源内容与本次将要执行更新的YAML资源内容进行对比，计算出本次更新需要执行的操作，是删除，变更。源码：https://github.com/helm/helm/blob/main/pkg/action/upgrade.go#L286
3. 当upgrade执行成功，Helm会创建名为sh.helm.release.v1.release.v2的secret。当你看到这个v2的时候，你就已经知道了。Helm是通过结合secret的名称约定和secret的内容来记录下每一次发布的。当下次upgrade时，Helm会取v2的secret，然后执行更新，并创建v3的secret。以此类推。

为了展示的更友好，Helm把这些底层都隐藏下来了，所以，当你执行history指令时，你看到的将是：

![helm-theory.png](/assets/images/helm-theory.png)


截图取自Helm官网

至此，整个Helm的本质，已经介绍完。剩下细节可以通过查文档学习了。

## 小结
虽然本文标题写的是Helm的本质，其实写的是Kubernetes的包管理器的本质：
1. 自动化执行Kubenetes资源更新；
2. 跟踪Kubenetes资源更新记录（本质还是版本化）。

你可以拿这两次去评估Kustomize或者另的包管理工具。



