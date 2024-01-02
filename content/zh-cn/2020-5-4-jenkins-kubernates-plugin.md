---
layout: post
title: "Jenkins kubernates原理"
Description: ""
date: 2020-05-4
comments: true
share: true
---

![image.png](/assets/images/292372-8163b7fa93e5d1fb.jpg)


## 如何使用
使用Kubernetes插件时，我们需要做三件事情：
1. 根据官方文档，在Jenkins上加入kubernetes配置。
2. 在Jenkinsfile中加入kubernetes agent的申明。
3. 指定容器执行你的业务脚本。

关于第2点，kubernetes agent的申明又有两种方式。一种是脚本式的，代码样例如下：

```groovy
podTemplate(containers: […]) {
  node(POD_LABEL) {
    stage('Run shell') {
      container('mycontainer') {
        sh 'echo hello world'
}}}}
```

一种是申明式，代码样例如下：
```groovy
pipeline {
  stages {
    stage('Run maven') {
      agent {
        kubernetes {
              yaml """
                apiVersion: v1
                kind: Pod
                metadata:
                  labels:
                    app: jenkins-agent
                spec:
                  containers:
                  - name: maven
                    image: maven:alpine
                    command:
                    - cat
                    tty: true
                  - name: busybox
                    image: busybox
                    command:
                    - cat
                    tty: true
                """  
        }}
      steps {
        container('maven') {
          sh 'mvn -version'
}}}}}
```
笔者推荐使用申明式。yaml配置部分看起来并不优雅，这是另一个话题。咱们今后再讲。

## 原理
我们都知道Jenkins是master/agent的架构。而master与agent之间通信方法有两种：
1. 通过JNLP协议：需要启动JNLP客户端主动连接master。这是Kubernetes插件使用的方式。
2. 通过SSH协议：master使用SSH主动连接agent机器。

Kubernetes插件的具体的做法就是连接到Kubernetes集群，然后启动一个Pod。Pod中包含一个JNLP客户端，容器名约定为：jnlp。jnlp 会主动连接Jenkins master。

所以，当你发现Jenkins任务的日志中，一直在等待jnlp连接时，我们可以这样查问题：
1. 查看相应的Pod是否存活。
2. jnlp 容器连接不上master：大概率是配置不对。

可是，我们看到上面的示例代码中，都没有叫jnlp的容器呢。这是因为Jenkins kubernates插件在真正创建pod前，为我们混入了默认的jnlp的容器定义。也就是，最终执行的yaml其实是：
```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    some-label: some-label-value
spec:
  containers:
  - name: jnlp
    image: jenkins/jnlp-slave:alpine
    args: ['\$(JENKINS_SECRET)', '\$(JENKINS_NAME)']
  - name: maven
    image: maven:alpine
    command:
    - cat
    tty: true
...省略其它
```

最后，pod启动后，pod中的jnlp容器会连上Jenkins master。当pipeline运行到以下代码：
```
container('maven') {
 sh 'mvn -version'
}
```
kubernates插件会找到名为`maven`的容器，然后将闭包内的代码发给它执行。

以上基本就是kubernates插件全部。

## 更换jnlp实现
当我们知道它的原理后，我们也就可以更换jnlp的实现镜像了。比如有些同学是在arm架构的机器上执行Kubernetes的，那么，他可以创建一个基于arm架构的jnlp镜像，然后，加入到yaml中。比如：
```yaml
containers:
  - name: jnlp
    image: supercom.com/jnlp-arm-agent:1.0
    args: ['\$(JENKINS_SECRET)', '\$(JENKINS_NAME)']
```

## 小结
总的来说，它的原理无非就是创建pod，pod中的jnlp容器连接到Jenkins master，然后Jenkins master根据需要，将需要执行的命令发送给相应的容器执行。

## 附录
1. Jenkins kubernetes源码：[https://github.com/jenkinsci/kubernetes-plugin](https://github.com/jenkinsci/kubernetes-plugin)
1. 混入jnlp容器的代码位置：`org.csanchez.jenkins.plugins.kubernetes.PodTemplateBuilder#build()`
1. 创建pod的代码位置：`org.csanchez.jenkins.plugins.kubernetes.KubernetesLauncher#launch`