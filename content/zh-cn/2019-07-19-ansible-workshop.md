---
layout: post
title: "如何设计 Ansible 的入门工作坊"
Description: ""
date: 2019-07-19
tags: [ansible]
comments: true
share: true
---

![image.png](/assets/images/292372-28f3aed45a46631e.png)

本月在公司内部做了一次 Ansible 的入门工作坊。本文即对这次工作坊的设计过程进行一次总结。其他技术类的工作坊也可以参考。

设计过程大概过程如下文所述。

首先，我们需要确定参加本次工作坊的受众。他们是否具有最基本的前提。本次工作坊的受众有开发、测试、运维，还有毕业生。但是他们都会使用 shell。这已经满足最基本的前提。同时，了解受众后了，也就可以因材施教。

第二，分析工作坊的内容。Ansible 是一款上手非常容易的自动化运维工具。它的特点就是实操性非常强，不需要理解 Ansible 背后的概念就可以使用的工具。

笔者根据受众和教学内容的特点，得出本次工作坊的目标（教学目标）：
1. 知道 Ansible 是什么，并知道它的作用。
2. 了解如何查文档。
3. 能部署一个 Spring Boot 应用。

是不是很简单？其实不然。整个工作坊没有一个人能完成所有的任务。同时发现有运维和开发基础的同学会做得更快。

那接下来怎么实现这个目标呢？笔者使用的是任务驱动的方法。也就是受众通过做一个个任务，在任务中完成学习。同时，教师可以任务过程穿插讲相关的知识点。

以下为任务列表：

1. 执行 `ansible-playbook -i hosts playbook.yml` 成功
2. 创建用户 apps 及用户组 apps：
    * user 模块: https://docs.ansible.com/ansible/latest/modules/user_module.html
    * group 模块: https://docs.ansible.com/ansible/latest/modules/group_module.html
3. 创建以下文件夹，并设置文件夹的用户和组为 apps：
    /apps，/apps/hello，/apps/hello/bin，/apps/hello/logs
    * file 模块: https://docs.ansible.com/ansible/latest/modules/file_module.html
4. 将 helloworld-0.0.2.jar copy 到 /apps/hello/bin 目录下，设置该 jar 文件的用户和用户组为 apps
    * copy 模块: https://docs.ansible.com/ansible/latest/modules/copy_module.html
5. 使用 template 模块将 app.service copy 到目标服务器的 /etc/systemd/system 中，并重命名 hello.service :
    * template 模块: https://docs.ansible.com/ansible/latest/modules/template_module.html
6. 启动 hello 服务
    * service 模块: https://docs.ansible.com/ansible/latest/modules/service_module.html
7. 监听 hello 服务是否启动成功
    * wait_for 模块: https://docs.ansible.com/ansible/latest/modules/wait_for_module.html
8. 为目标机器安装 JDK 1.8:
    1. 在本地仓库中创建 roles 目录
    2. clone 代码：https://github.com/geerlingguy/ansible-role-java 到 roles 目录中
    3. 在 playbook.yml 文件中加入 ansible-role-java 的role
9. 创建自定义 role: hello role
    1. 进入 roles 目录：cd roles
    2. 使用命令生成 role 模板：`ansible-galaxy init hello`
    3. 将 hello 的部署逻辑（在 playbook.yml 中）写入到 hello role 中
10. 将 hello 部署到多台机器
    * 需要修改 hosts 文件
11. 多环境部署

任务的设计并不是随意的，而是有意的。比如：
* 任务1：受众拿到练习代码后，执行命令，一定会报错。这时，教师可以讲解 Ansible 部署时需要确定“部署位置”和“部署逻辑”。顺便扩展一下：其它的自动化部署工具，也需要确定这两部分。
* 任务2：受众在创建用户时，一定会失败。因为用户组还没有创建。
* 任务3：重复创建多个文件夹，由于新手不懂`with_items`可以遍历创建文件夹，所以，新手写出来的代码会很多重复的。有悟性的同学，会想办法减少这种重复。
* 任务5： 由于 app.service 模板中使用了未定义的变量，所以，此任务用户也没有办法一次运行成功，而是需要学习在 playbook.yml 中定义变量，才能运行成功。


可以看到这些任务中充满了“陷阱”。本文就不一一列出所有的陷阱。这些陷阱能达到以下效果：
1. 在多次出现错误时，受众会学会自己看日志，查文档，找原因。
1. 受众可以在这个不断遇到问题，解决问题的过程中， 体会到真实的开发是怎样的。
1. 激发受众的自主思考（最重要）。

采用任务驱动的方式，还能规避受众能力参差不齐的问题，因为能力好的同学可以帮助能力差的同学。

### 后记
很久没有做老师了，稍微找回了当年做老师的感觉。

本次工作坊的练习代码：[https://github.com/zacker330/ansible-workshop](https://github.com/zacker330/ansible-workshop)