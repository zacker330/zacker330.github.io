---
layout: post
title: "Spark本地开发环境搭建"
Description: ""
date: 2016-01-01
tags: [Spark, 大数据]
comments: true
share: true
---
本文使用Scala2.10.6，sbt。请自行提前装好。


#### 设置SSH，本地免密码登录
因为Spark master需要ssh到Spark worker中执行命令，所以，需要免密码登录。

> cat ~/.ssh/id_rsa.pub > ~/.ssh/authorized_keys

执行`ssh localhost`确认一下，如果不需要密码登录就说明OK了。


Tips：
Mac下可能ssh不到本地，请检查你sharing设置：


![Spark本地开发环境搭建](/assets/images/2016-1-spark-network.png)

#### 下载Spark

http://spark.apache.org/downloads.html 

我选择的是spark-1.6.0-bin-cdh4.tgz 。看到cdh4(Hadoop的一个分发版本)，别以为它是要你装Hadoop。其实不然，要看你自己的开发需求。因为我不需要，所以，我只装Spark。

#### 配置你的Spark slave
我很好奇，worker和slave这个名称有什么不同？还是因为历史原因，导致本质上一个东西但是两种叫法？

在你的Spark HOME路径下

> cp ./conf/slaves.template ./conf/slaves

`slaves`文件中有一行`localhost`代表在本地启动一个Spark worker。

#### 启动Spark伪分布式

> <SPARK_HOME>/sbin/start-all.sh


执行JPS验证Spark启动成功

    ➜ jps
    83141 Worker
    83178 Jps
    83020 Master


#### 打开你的Spark界面 
http://localhost:8080

![Spark本地开发环境搭建](/assets/images/2016-1-spark-webview.png)

#### 下载Spark项目骨架

为方便我自己开发，我自己创建了一个Spark应用开发的项目骨架。

1. 下载项目骨架： http://git.oschina.net/zacker330/spark-skeleton

2. 项目路径中执行：`sbt package` 编译打包你的spark应用程序。

#### 将你的spark应用程序提交给spark master执行

        <SPARK_HOME>/bin/spark-submit \ 
              --class "SimpleApp" \
              --master spark://Jacks-MBP.workgroup:7077 \
                  target/scala-2.10/spark-skeleton_2.10-1.0.jar

这个“spark://Jacks-MBP.workgroup:7077”是你在 http://localhost:8080 中看到的`URL`的值

可以看到打印出: hello world