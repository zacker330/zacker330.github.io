---
layout: post
title: "这样搭建Spark学习环境效率似乎更高"
Description: "让搭建学习环境不再成为门槛"
date: 2017-01-31
tags: [Spark,Hadoop,Hbase]
comments: true
share: true
---


像学习Spark这类大数据平台，搭建环境，是一件很费时费力的事情。特别是当你想使用多台机器模拟真实生产环境时。

为了更有效的学习Spark，我决定将自己的学习环境按生产环境的要求来搭建。但是真实生产环境的群集往往由多个集群组成：Hadoop/Hbase集群、Zookeeper集群、Spark集群。掐指一算，至少需要6台机器了。

我们真的需要买6台机器吗？当然不是，我们只需要在自己的电脑上虚拟化出6台就好了。而我的电脑只有16G，虚拟化6台太吃力了。最终，我决定搭建成以下结构：

![spark-hadoop-hbase](/assets/images/spark-hadoop-hbase.jpg)



以下是搭建过程：

### 环境的搭建
按以前学习像Spring这些类Web，开发环境的搭建非常简单，也就引入几个依赖，添加几项配置，就好了。

但是学习Spark，我敢肯定不少人在环境搭建这一环节踩坑。正因为这样，才会有此博客。

Spark不是一框架，而是一个分布式的计算平台。所以，你不能通过引入依赖，添加配置就完成搭建。需要先将Spark这个平台部署起来。Spark支持4种部署方式：

1. 单机：同一台机器，同一进程，不同线程运行Master和Worker
2. 伪分布式：同一台机器，不同进程分别运行Master和Worker
3. Standalone方式：多台机器分别运行Master和Worker，自己解决资源调度
4. Yarn和Mesos方式：将资源调度这一职责外包出去

虽然Spark的单机部署方式很简单，但是没有人会在生产环境上使用单机部署方式。而伪分布式我见不少人搭建，以此为基础来学习Spark。但我不推荐。

因为在线上真正运行的是Standalone、Yarn、Mesos方式，也称为完全分布式的方式。只有一开始就使用完全分布式的方式来进行开发调试，你才会学习到生产环境会遇到什么问题。

### 机器准备
如果采取完全分布式的部署方式来学习，你必须准备很多台机器，就像上面所说的。

我想大多数人都会选择虚拟化方案来得到多台机器。我推荐Virtualbox。

我见不少人手工的创建一台机器，然后安装操作系统，接着想要多少台机器，就复制几台，甚至还要分别进入机器修改每台机器的IP。。。

这样的方式，效率低，又很难与你的同事分享你的环境（也就是统一一个团队的开发环境，以避免不同开发环境不同引起的问题）。

所以，我一开始就使用Vagrant。把机器的虚拟化这一动作进行自动化和版本化（提交到git仓库中）。使用了Vagrant，你只需要在Vagrantfile中定义机器数据、机器的系统镜像、CPU个数、内存，然后执行`vagrant up`，就可以得到你想要的机器了。要与同事统一这些机器，只需要他使用相同的Vagrantfile就好了。
同时，这样，还能实现：统一开发环境与生产环境使用同样或相近的机器环境。

以下是一个[Vagrantfile样例](https://github.com/bigdata-labs/spark2-hadoop2.6-hbase-labs/blob/master/Vagrantfile)：



```
Vagrant.configure(2) do |config|
  VAGRANT_VM_PROVIDER = "virtualbox"
  machine_box = "boxcutter/ubuntu1604"  -> 系统镜像

  config.vm.define "offlinenode1" do |machine|
    machine.vm.box = machine_box 
    machine.vm.hostname = "offlinenode1"
    machine.vm.network "private_network", ip: "192.168.11.151" -> 指定IP
    machine.vm.provider "virtualbox" do |node|
        node.name = "offlinenode1"
        node.memory = 4096 -> 指定内存
        node.cpus = 2 -> 指定CPU个数
    end
   end

   config.vm.define "offlinenode2" do |machine|
     machine.vm.box = machine_box
     machine.vm.hostname = "offlinenode2"
     machine.vm.network "private_network", ip: "192.168.11.152"
     machine.vm.provider "virtualbox" do |node|
         node.name = "offlinenode2"
         node.memory = 4096
         node.cpus = 2
     end
    end
....... 还可以定义很多这样的机器
end
```

### 搭建Spark集群

在准备好机器后，接下来做的就是搭建Spark集群。我会选择Ansible来实现自动化搭建，而不是一台台机器登上去，一条条命令的执行安装。

那么，只是学习阶段，我为什么要自动化呢？正因为在学习阶段，我们更要自动化搭建过程。作为新手很容易把环境弄乱了，又没法一下子查到原因。但是自动化后，意味着版本化了搭建脚本，查原因时，只要对比版本库就好了。

同时，也因为我要搭建的是Spark完全分布式，需要上3台机器，除了安装Spark，还需要安装Hadoop。如果不自动化这整个过程，学习过程会浪费很多时间在重复工作上。

题外话：很多人反对项目开始时就考虑自动化所有的部署流程，理由是成本高（指人力成本），先实现功能再说。这两点理由是站不住脚的，因为如果一开始不自动化，你后期返回来再补，成本会更高。因为会有历史负担！

### 监控集群
为什么我们要学习过程中就加上监控？写出刚刚能运行的Spark应用，不难，但是谁知道你写的应用的性能如何，有没有发挥所有机器的作用呢？所以，我在一开始就会加上监控。
目前，我还没有完成这部分工作。

### 自动化Submit提交Spark应用
在搭建好了Spark集群后，我们就可以写Spark应用，然后将应用提交到Spark集群中运行。我们采用集群模式来submit spark应用，在集群中某台Spark node上手工执行命令来提交：
```
./bin/spark-submit \
  --class codes.showme.HbaseExample \
  --master spark://192.168.11.153:7077 \
  --deploy-mode cluster
  --executor-memory 1G \
  --total-executor-cores 2 \
  /home/spark/spark/example.jar 
```
如果不自动这个过程，你需要做：
1. 在开发环境将应用打成jar包
2. 手工将jar包copy上指定机器指定路径
3. 执行命令

所以，我又将这个过程写成了Ansible脚本，你只需要在`./ansible/`下执行：
`./deploy-hbase-example.sh` 就完成submit的操作了。

最后，我们的应用如果要上CI，完全没有压力！


### 小结
以上是我个人的Spark学习环境搭建方法。希望有经验的同学能多多指教。
这是最终搭建好的环境：[spark2-hadoop2.6-hbase-labs](https://github.com/bigdata-labs/spark2-hadoop2.6-hbase-labs)

祝大家学习愉快。
