---
layout: post
title: "K8s工程化：K8s中的Java应用出现OOM后怎么办？"
Description: ""
date: 2024-02-26
tags: [云原生,Cloud Native,Kubernetes]
---

> 完整代码在文末

### 背景

前段时间，线上系统出现了两次持续时间比较长的事故。这两次事故暴露我在某些方面的不足。同时，也意识到在SRE这个领域，经验的重要性。

事故过程中，我们发现大量的FullGC。当时，我们想到了要dump内存出来分析，可惜发现没有加`-XX:HeapDumpPath`参数。同时，我们也发现，如果dump出来了，我们也没法拿到dump出来的文件。因为我们的应用是跑在K8s中的。

### 方案调研
经复盘，我们得到一个action：在Java应用出现OOM时，将内存dump出来，并持久化，并且方便分析。

这个action可以细分为两个任务：
1. OOM时，dump内存出来；
2. 提供一种途径方便分析。

经过权衡，任务2的优先级是可以降低的。puvad只要把任务1做好就可以。所以，这两个任务最终变成：在Java应用出现OOM时，将内存dump到NAS中。

笔者在网上搜索一通，看到的方案基本就是启动一个sidecar容器，与应用共享一个目录。然后监控这个目录，发现内容就上传到s3这类对象存储中。

这种方案的问题在于：
1. sidecar在传输过程，有出现问题的风险；
2. 为了OOM这个小概率事件启动一个sidecar，资源有点浪费。

个人觉得，Java应用的Pod应该只负责将OOM时的内存dump到NAS即可，其它事情应该由其它Pod完成。

### 具体实现

以下方案是基于Helm自动化部署。如果你使用的是其它自动化部署工具，思路大体相同。

#### 准备NFS服务
这部分不是本文范畴。

#### Java应用启动时参数配置
在Dockerfile中必须将变量$JAVA_OPTS加入到启动参数中。
```
FROM openjdk:11.0.12-jre-buster
COPY target/app.jar /app.jar
CMD java -jar $JAVA_OPTS /app.jar
```

#### 加入InitContainers
作用：创建符合指定规则的Dump目录（注意DUMP_FOLDER变量的定义）。如下代码，在init容器启动后，它会创建目录：/nfs/dump/default/jvm-oom-example/10.233.66.38 。在应用出现OOM，内存文件会被dump在此目录下。
```
initContainers:
- name: init
  image: registry.cn-shenzhen.aliyuncs.com/aliacs-app-catalog/busybox:1.30.1
  command: ['sh', '-c', 'echo $DUMP_FOLDER;mkdir -p $DUMP_FOLDER']
  {{- with .Values.volumeMounts }}
  volumeMounts:
  {{- toYaml . | nindent 12 }}
  {{- end }}
  env:
  - name: MY_NODE_NAME
      valueFrom:
      fieldRef:
          fieldPath: spec.nodeName
  - name: MY_POD_NAME
      valueFrom:
      fieldRef:
          fieldPath: metadata.name
  - name: MY_POD_NAMESPACE
      valueFrom:
      fieldRef:
          fieldPath: metadata.namespace
  - name: MY_POD_IP
      valueFrom:
      fieldRef:
          fieldPath: status.podIP
  - name: DUMP_FOLDER
      value: "/nfs/dump/$(MY_POD_NAMESPACE)/{{ include "app.fullname" . }}/$(MY_POD_IP)"
```

#### 配置应用容器
我们要做的，其实就是设置JAVA_OPTS环境变量。这里要注意的是JAVA_OPTS可以由三部分组成的：
1. 内存大小设置，比如：-Xmx640M Xms640M 这类；
2. GC算法设置，比如：-XX:+UseSerialGC
3. JVM日志设置，比如：-XX:ErrorFile=/dump/hs_err_pid%p.log -XX:HeapDumpPath=/dump。

1,2部分应该是由用户决定。第3部分是由平台决定的。

所以，我们的配置JAVA_OPTS分成两部分：DUMP_ARGS 和 用户的JVM配置。代码如下： 
```
containers:
- name: {{ .Chart.Name }}
  {{- with .Values.volumeMounts }}
  volumeMounts:
    {{- toYaml . | nindent 12 }}
  {{- end }}
  env:
    - name: MY_NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
    - name: MY_POD_NAME
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    - name: MY_POD_NAMESPACE
      valueFrom:
        fieldRef:
          fieldPath: metadata.namespace
    - name: MY_POD_IP
      valueFrom:
        fieldRef:
          fieldPath: status.podIP
    - name: DUMP_FOLDER
      value: "/nfs/dump/$(MY_POD_NAMESPACE)/{{ include "app.fullname" . }}/$(MY_POD_IP)"
    - name: DUMP_ARGS
      value: "-XX:ErrorFile=$(DUMP_FOLDER)/hs_err_pid.log  -XX:HeapDumpPath=$(DUMP_FOLDER) -XX:+HeapDumpOnOutOfMemoryError"
    - name: JAVA_OPTS
      value: "{{.Values.javaOpts}} $(DUMP_ARGS)"

```

### 最终效果
```
[vagrant@k8s-3 jvm-oom]$ pwd
/persistentvolumes/dump/default/jvm-oom
[vagrant@k8s-3 jvm-oom]$ tree
.
├── 10.233.66.37
└── 10.233.66.38
    └── java_pid6.hprof
```

### 小结
这个方案并不是没有缺点。比如每次Pod启动都会创建一个目录，不论是否出现OOM。当然，这个缺点的解决方案也很简单，另启一个Pod负责清理就好了。

完成代码地址：https://github.com/zacker330/jvm-oom-example

