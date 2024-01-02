---
layout: post
title: "我故意写了个死循环"
Description: "没有踩过死循环的坑的程序员不是好程序员"
date: 2017-2-17
tags: [Java]
comments: true
share: true 

---
导致CPU100%的原因很多，而程序中出现死循环就是原因之一。然而，并不是每个人在工作中都有机会踩中这个坑。我就是其中一个没踩过的。人生似乎有些不完整。

所以，我做了一个很重要的决定：**在程序中写一个死循环。看看会发生什么事情**。

当然，不是在生产环境。😜 我搭建了一个实验环境来做实验。只是这个实验环境**不仅**可以用于这个死循环实验。以下是这个环境的结构图：

![实验室结构](/assets/images/2017-2-17-292372-4c451d9ef3b37ab1.png)
还是老样子，使用Vagrant + Virtualbox + Ansible自动化搭环境。代码及搭建步骤在文末。

我们会写一个简单的Spring MVC 应用，然后其中一个接口里会有死循环代码：

```
    @RequestMapping(value = "/loop", method = RequestMethod.GET, produces = "application/json; charset=UTF-8")
    public void endlessLoop() {
        int i = 0;
        while (true) {
            System.out.println(i += 1);
        }
    }
```

以下是我自己尝试找出这个死循环的过程。


### 使用top，查看是哪个进程的问题

我请求一次：`http://192.168.88.10:9898/web/loop`

![07:13:36 cpu100%了](/assets/images/2017-2-17-292372-e7afb1a7f5524fec.png)

然后，我打开新窗口，又请求一次


![07:22:28 CPU120%~130%之间](/assets/images/2017-2-17-292372-864eaa6befc3bdd5.png)

这里，我好奇CPU没有到200%。一直在120%和130%之间。P.S. 我一定是某个知识点不牢固，要不，不会有这个疑问。

### 堆空间
因为不涉及JVM堆空间问题，执行 `jstat -gcutil 32593 1s` 没看出什么问题。32593为Java进程ID，1s指1秒抽样一次。

![查看堆空间GC情况](/assets/images/2017-2-17-292372-a4d954f013d39fb6.png)

### 栈
堆没问题，就看看是哪个线程占用得高。
1. 列出java进程的线程，`top -H -p <java 进程pid>`
![找到CPU占用高的线程PID](/assets/images/2017-2-17-292372-1af95af5be74988e.png)
1. 将jvm的栈dump下来
  `jstack -l <其中一个线程PID> >> stack.log`，这里我选3596。

1. 在日志中，找到相应的线程
  我们需要从栈日志中找到相应的线程，但由于栈日志中使用的16进制，但是top中的PID又是10进制，所以，需要手工将10进制的PID转成16进制。3596的16进制转是0xe0c
![less stack.log 然后搜0xe0c](/assets/images/2017-2-17-292372-410dacd26223800a.png)

### 小结
好吧。我没有因为写这个死循环去看10小时的无聊电影。

附录：
* 代码：[performance-labs](https://github.com/zacker330/performance-labs)
* 准备环境：虚拟机的账号密码都是_vagrant_
  * git clone  git@github.com:zacker330/performance-labs.git
  * vagrant up
  * download jdk8 to ansible/roles/jdk8/files: [https://pan.baidu.com/s/1bpxfpvD](https://pan.baidu.com/s/1bpxfpvD)
  * ansible-playbook ./ansible/playbook.yml -i ./ansible/inventory -u vagrant -k
  * ansible-playbook ./ansible/init-mysql.yml -i ./ansible/inventory -u vagrant -k
  * cd ansible;chmode +x ./buildwarfile.sh;./buildwarfile.sh --> 将会提示输入vagrant密码
* 访问：http://192.168.88.10:9898/web/