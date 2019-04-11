---
layout: post
title: "关于 Jenkins master standby 方案的实验"
description: ""
date: 2019-04-15
tags: [Jenkins]
comments: true
share: true
---
Jenkins master 的高可用是个老大难的问题。注意到知乎实现了 Jenkins Standby 方案。但是经过与其中一位开发者沟通，并不是真正的 standby。

以下是我自己做的 Jenkins master standby 实验。

### 实验环境介绍
两个独立启动的 Jenkins master，分别为 jenkins-a 和 jenkins-b。它们共用同一个 Jenkins home 目录。

启动过程就出问题了，a 先启动的话，b 再启动。我看到他们的界面是不一样的。

jenkins-b 的界面为：

![]({{ site.baseurl }}/assets/images/292372-fd4b85d5b9c8bdf6.png)

而 jenkins-a 的界面为：

![]({{ site.baseurl }}/assets/images/292372-1bfd4e033b6c25c8.png)

这时，将 jenkins-a 日志中的 Unlock 密码输入到 jenkins-b 的页面中，会得到报错信息：
```
ERROR: The password entered is incorrect, please check the file for the correct password
```

这时，再次 jenkins-b 日志中的 Unlock 密码输入到表单中即可进入下一步。接下来就是按照提示一步步完成了。在 jenkins-b 安装步骤的最后一步，我们设置了管理员的用户名密码：admin/admin。然后就算完成任务了。

然后我们再在 jenkins-a 使用 admin/admin 进行登录，登录是报错的：用户密码不正确。

我们使用  docker-compose restart jenkins-a 命令重启 jenkins-a。再次使用 admin/admin 就可以登录成功了。

当两个 Jenkins 启动完成后，接下来开始做实验。

### 实验1：创建任务
在 jenkins a 创建任务 x，刷新 jenkins b 的页面，jenkins b 上会不会显示出任务 x ？

结果：jenkins-b 不会出现任务 x。重启 jenkins-b 后，任务 x 出现在任务列表中。


### 实验2：任务结果可见性
jenkins-a 上任务执行，jenkins-b 上能否看到任务执行结果？

jenkins-a 执行任务 x，并且执行成功。刷新 jenkins-b 看不到任何执行记录。重启 jenkins-b 后，可看到执行记录。

### 实验3：两 master 同时执行同一任务
分别在两个 Jenkins master 上（几乎）开始同一个任务 x。其中一个任务的 build number 会更新，但是另一个不会。

其中jenkins-a任务 x 的 build number 会升到 2，而 jenkins-b 保持的是 1。这时，单独执行 jenkins-b 的任务 x，日志会出现错误：

```
jenkins-b_1  | WARNING: A new build could not be created in job x
jenkins-b_1  | java.lang.IllegalStateException: JENKINS-23152: /var/jenkins_home/jobs/x/builds/2 already existed; will not overwrite with x #2
```

### 实验4：编辑任务
jenkins-a 上设置任务 x 定时执行，刷新 jenkins-b 页面，任务 x 中并没有定时执行的设置。重启 jenkins-b 后，任务 x 更新。

### 实验5：定时任务的结果是什么？
如果 jenkins-a 和 jenkins-b 两个任务均为定时任务，而且都生效了。它们运行结果是什么的呢？

目前看到的现象是，两个任务都会按时执行，但是只有一个任务能将运行结果写入到磁盘中。界面上如图：

![]({{ site.baseurl }}/assets/images/292372-38c7a7f8aade0793.png)

另，从日志中，可以确认 jenkins-a 和 jenkins-b 确实按时执行了。如下图日志中，看出 jenkins-a 定时执行 #6 次构建时报错，因为 jenkins-b 已经执行过 #6 次构建了：

![]({{ site.baseurl }}/assets/images/292372-55e80e61f0d36dfb.png)

### 小结
可以确认的是，当两个 Jenkins 进程共用同一个 Jenkins Home 目录时，其中一个 Jenkins 进程更新了 Jenkins Home 的内容，另一个是不会实时更新的。所以，同时启动两个 Jenkins master 的 standby 是不可行的。我们不能在 jenkins-a 挂了后，直接将流量切到 jenkins-b。jenkins-b 必须重启。

最后结论：在不做任何修改的情况下，Jenkins master 是无法做到双活的，但不用说多活了。

### 附录
* 知乎的方案：[知乎容器化构建系统设计和实践](https://zhuanlan.zhihu.com/p/45694823)
* Jenkins standby 实验环境：[https://github.com/zacker330/jenkins-standby-experiment](https://github.com/zacker330/jenkins-standby-experiment)