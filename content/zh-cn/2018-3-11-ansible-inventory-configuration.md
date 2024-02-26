---
layout: post
title: "巧用 Ansible 实现配置管理：多环境配置问题"
Description: "配置管理是本书其他内容的基础。没有配置管理，根本谈不上持续集成、发布管理以及部署流水线。它对交付团队内部的协作也会起到巨大的促进作用"
date: 2018-03-11
tags: [持续交付]
comments: true
share: true
---

![ansible logo](/assets/images/292372-65e68fd4479d6e18.png)

### 说在前面
在《持续交付》的第二章配置管理的小结里说到：

> 配置管理是本书其他内容的基础。没有配置管理，根本谈不上持续集成、发布管理以及部署流水线。它对交付团队内部的协作也会起到巨大的促进作用。

再怎么强调配置管理的重要性也不为过，特别是在多环境下。然而大家都知道重要，又少有人告诉我们具体如何做，所以实在难受。

本文总结了我在多环境配置管理实践方面的一点心得，希望对大家有帮助。

### Ansible 介绍
你可以简单地把它理解为一个自动化运维工具。本文将会使用这个工具下 inventory 概念来实现多环境配置。简单一点来说，inventory是一个文本文件，你可以在这个文件里记录下所有的机器，并对这些机器进行分组（分类）。

当然，其它的自动化运维工具也可以使用同样的思路来实践。本文只以 Ansible 为例。

### 例子
比如我们有两个环境，分别有一台机器。使用Ansible的 inventory 来管理这些机器，就会像下面这样：

```
## inventory
[aws-prod-app]
10.171.32.158

[aws-test-app]
10.161.158.221
```

所有的 app 应用都是同一份代码，而且都会涉及操作数据库。当然，不同环境下的 app 读取的数据库的配置项的值是不样的。比如 aws-test 环境下配置是

```
db:
  url: test.mysql.url
  username: testu1
  password: passwordtest
```
而生产环境 aws-prod 环境下配置：

```
db:
  url: prod.mysql.url
  username: produ1
  password: passwordprod
```

这时，因为机器少，我们可以使用 Ansible 的 inventory 变量实现不同环境的配置隔离，比如：

```
## inventory
[aws-prod-app]
10.171.32.158

## [分组名:vars] 这样的写法是 Ansible inventory的约定
## 按照这个约定来写，Ansible就可以识别了
[aws-prod-app:vars]
db.url = test.mysql.url
db.username = testu1
db.password = passwordtest

[aws-test-app]
10.161.158.221

[aws-test-app:vars]
db.url = prod.mysql.url
db.username = produ1
db.password = passwordprod
```
接着，如果环境上要部署新应用呢？而且还是很多呢？我们的 inventory 就会变成这样：

```
## inventory
[aws-prod-app]
10.171.32.158

[aws-prod-appX]
10.171.32.159

## 还有更多的 aws-prod-app...

[aws-prod-app:vars]
db.url = prod.mysql.url
db.username = produ1
db.password = passwordprod


[aws-prod-appX:vars]
db.url = prod.mysql.url
db.username = produ1
db.password = passwordprod

## 还有更多的 aws-prod-app:vars ...

[aws-test-app]
10.161.158.221

[aws-test-appX]
10.161.158.222

## 还有更多的 aws-test-app...

[aws-test-app:vars]
db.url = test.mysql.url
db.username = testu1
db.password = passwordtest


## 还有更多的 aws-test-app:vars ...

```

好吧，面对这种配置冗余，后期维护会很恐怖。有两种办法解决：

1. 不增加新应用
2. 想办法解决这个问题

不要觉得第一种办法可笑，现实中真的存在，只是不同环境下的具体形态不一样。

解决这个问题的办法就是使用 Ansible 的[分组的分组的变量](http://docs.ansible.com/ansible/latest/intro_inventory.html#groups-of-groups-and-group-variables)。说起来是有点绕。简单的说就是对我们刚刚的分组，再进行一次分组，然后再给这一更高层次的分组设置变量。

接着我们上面的例子，我们使用分组的分组变量进行重写：

```
## inventory
[aws-prod-app]
10.171.32.158

[aws-prod-appX]
10.171.32.159

## 注意，我们将所有的生产环境的
## 分组又加入到 aws-prod分组下
[aws-prod:children]
aws-prod-app
aws-prod-appX

## 这样，aws-prod 分组的变量又可以
## 应用到所有的 aws-prod 环境下所有的机器
[aws-prod:vars]
db.url = prod.mysql.url
db.username = produ1
db.password = passwordprod

[aws-test-app]
10.161.158.221

[aws-test-appX]
10.161.158.222

[aws-test:children]
aws-test-app
aws-test-appX

[aws-test:vars]
db.url = test.mysql.url
db.username = testu1
db.password = passwordtest
```
Ansible 这个分组概念设计得非常妙。仔细看，你会发现，利用分组的概念，你可以轻松地、简单地实现多种环境的配置管理。

当然，所有的配置都放一个 inventory 里就不合适了，所以，我们使用了Ansible的 group_vars 文件夹来进行管理，重构后如下：

```
目录结构
.
├── group_vars
│   ├── aws-prod
│   └── aws-test
└── inventory
```

```
## inventory
[aws-prod-app]
10.171.32.158

[aws-prod-appX]
10.171.32.159

[aws-prod:children]
aws-prod-app
aws-prod-appX

[aws-test-app]
10.161.158.221

[aws-test-appX]
10.161.158.221

[aws-test:children]
aws-test-app
aws-test-appX

```

```
## group_vars/aws-prod
db.url = prod.mysql.url
db.username = produ1
db.password = passwordprod
```
到这里，我们简单的多环境管理的例子就算讲完了。

如果觉得不够直观，可以访问我在Github的代码样例 [ansible-inventory-example](https://github.com/zacker330/ansible-inventory-example)。


### 小结
当环境少的时候，开发人员和测试人员会争抢环境；当环境多的时候，配置管理又会成为一个头大的问题。不论当哪种情况，都会增加我们研发成本。

而利用 Ansible 的分组概念同时加上它的自动化，就可以很轻松地解决多环境的配置管理问题，同时又降低我们的研发成本。

### 扩展
* [关于自动化配置还有什么好说的呢？](https://showme.codes/2016-08-12/automation-configuration/) 我的另一篇关于自动化配置的文章
* [Puppet，Chef，Ansible的共性](https://showme.codes/2016-01-02/the-nature-of-ansible-puppet-chef/)
* [Ansible doc](http://docs.ansible.com/ansible/latest/index.html)
