---
layout: post
title: "简单易懂Ansible系列 —— 解决了什么"
Description: ""
date: 2017-06-12
tags: [Ansible,自动化运维]
comments: true
share: true
---

![Ansible](/assets/images/292372-a504ab242c05db6a.png)

不知什么时候，Ansible的slogan从“IT Automation Software for System Administrators”变成了“AUTOMATION FOR EVERYONE”。

从一个给系统管理员使用的工具变成了给所有人使用的工具。

但是，现实中，发现了解Ansible的人，还是太少了。同时，自己断断续续学习Ansible也有一段时间，希望拿出来和大家交流。所以就决定不定期写写一个关于Ansible的系列。如果你觉得我写得还可以，到文末扫码请我喝杯茶。

此文为“简单易懂Ansible”系列文章的开篇 —— Ansible解决了什么

## Ansible解决了什么
首先，它是一个运维工具。当然要解决运维过程中遇到的问题了。运维过程遇到了什么问题？

想像一下，你要在一台新的机器上安装Tomcat，你会怎么样呢，条件反射的：
```
ssh user@111.111.111.111

wget -c http://apache.fayea.com/tomcat/tomcat-8.5.15.tar.gz

tar -zxf apache-tomcat-8.5.15.tar.gz
.....省略
```
好，10分钟后你愉快地完成了老板给你的任务。但是现在你需要给100台机器安装Tomcat呢？手工的重复100次？

![懵逼满屏](/assets/images/292372-b33ed81e9618ca8a.png)


而Ansible能让我们只定义一次，理论上可以在无限台机器上执行。换句话：**减少运维工作中的重复工作**。

同时，如果是人工执行100次，那么失误是难免的！自动化运维工具会严格根据我们所给指令来执行，而不会因为失恋而手抖执行了：`sudo rm -rf /`。

不少人反对自动化，认为那样太危险，因为一不小心就在上百台机器删错文件。显然，他们没有注意到：自动化实现的是**准确地执行指令**，解决人类执行任务时存在的指令理解不正确、执行不严格的问题。而机器不会出现这些问题的概念几乎为零。

没有达到预期效果，往往是我们人类下达的指令不正确。

所以，Ansible还解决了**人执行指令不准确**的问题。

如果使用Ansible来实现上述的运维需求，怎么做呢？你需要做三件事情：

* 定义目标机器的列表：一种被称为inventory的类ini文件
* 定义这些机器的配置：使用[YAML](https://en.wikipedia.org/wiki/YAML)格式的文件来描述你机器的配置
* 执行 `ansible-playbook -i inventory playbook.yml`

以下是inventory文件：
```
[tomcat-servers]
111.111.111.111
112.112.112.112
....
```
而这些ip的配置写在一种被称为playbook的YAML文件中：
```
---
- hosts: tomcat-servers
  tasks:
    - name: download tomcat
      get_url:
          url: http://apache.fayea.com/tomcat/tomcat-8.5.15.tar.gz
          dest: /tmp
          
    - name: unarchive tomcat to /usr/local
      unarchive:
          src: /tmp/apache-tomcat-8.5.15.tar.gz
          dest: /usr/local/
          remote_src: true
.....省略
```
如果你想再添加100台机器，你需要做的，也只是在inventory文件里添加100个ip，再执行一遍ansible-playbook命令。

当然，写shell写得不错的人，也能实现上面的功能。

但是，使用Ansible有什么优势？**模块化和标准化！** 手工写shell，甚至手工写python，要做到模块化和标准化，太困难了。

Ansible将大部分运维工作都抽象并标准化成一个个模块（module）。所有的模块都以这样形式使用：
```
- name: <描述说明(option)>
  <模块名>
  <属性名>: <属性值>
```
比如使用Ansible的file模块创建文件夹，而且file模块会自行判断该文件夹是否存在：
```
- name: create a directory
  file:
    path: "/tmp/aa"
    state: directory
    owner: "centos"
    group: "centos"
    mode: "ug=rwx,o=rx"
```
显然，不同的人使用shell或python在方法名上可能都不一样，是驼峰，还是使用下划线？是使用createDir？使用createDirectory？还是create_folder？

## 小结
我们小结一下Ansible到底解决了什么问题？

* 自动化：避免运维工作中重复的工作，以及人的不确定性问题
* 模块化：大部分运维工作能做到模块化，直接使用shell脚本或者python，还是过于低级，比如：
    ```
      if [ ! -d "/tmp/aa" ]; then
          mkdir /tmp/aa
      fi
      ....
    ```
* 标准化：所有的模块的使用方式都是一样的，减少学习成本

然后，我个人认为Ansible解决以上问题都是为了实现一个最根本的目标：**自动化配置**！关于自动化配置，你可以看看我写的另一篇文章：[关于自动化配置还有什么好说的呢？](http://showme.codes/2016-08-12/automation-configuration/)

最后，这篇文章存在一个假设：手工运维、非模块化、非标准是问题，需要解决。如果你觉得这些都不是问题的话，这篇文章所说的也就都不成立了。
