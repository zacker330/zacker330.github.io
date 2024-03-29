---
layout: post
title: "出现运维事故后，你会怎么办？"
Description: ""
date: 2018-03-30
tags: [运维,SRE]
comments: true
share: true
---
![stormtrooper-2296199_640.jpg](/assets/images/292372-d079a1036ccc1e08.jpg)

### 从聊天说起
有一次和朋友聊天，他说他们有一次部署出事了，影响还挺大，那次事故后，他们公司对于部署流程增加了更多的审批。

当朋友说完前半句时，我已经猜到下半句，那是很多公司或个人会做出的反应。至于为什么会做出这样的反应，我也不知道。

我问：为什么那次部署会“出事”？

他说：当时部署的人忘记了那台机器上有一条 Iptable 规则，导致了事故。

我就在想，如果有人审批，那次事故就不会发生吗？审批的人就知道那台机器上有一条规则导致事故的发生？然后驳回这次部署吗？连一线的开发和运维都忘记了的 Iptable 规则，“高高在上的审批领导”就更不知道了。

题外话：增加审批流程并不能避免这次事故，只不过当出现事故时，可以更好的定责。然而我又好奇了，这种“审批”是为了解决问题，解决什么问题？，还是为了逃避责任？谁逃避了责任？谁又有责任？

对于这类问题，我心里已经有数了，但想知道这位朋友的回答，就接着问：那么怎么杜绝这类问题呢？

他说：因为那条 Iptable 规则的设置太久远了，是谁都记不起。如果能把每次部署的步骤记录下来，这样下次部署的时候，过一下以前的部署记录，就会知道那个 Iptable 规则了。（作者：大概原意，已经记不清原话）

这位朋友说的做法，我之前待的一个团队的做法也差不多：会有一个页面专门记录下每次部署的步骤，步骤由开发人员写，然后由运维人员执行。只是我不知道他们会不会回顾之前所有针对这台机器的部署步骤。

这个团队里有某某大型互联网公司来的架构师和某财务软件公司来的运维，所以，我不负责地推测，我们这个行业很多公司对于配置的管理还没有达到足够的重视，也没有正确的看待。

我笑了，接着问朋友：那我要知道当前机器的“最终状态”，是不是要找出所有部署记录，还要过滤出对这次部署有影响的每一个细节？比如那条 Iptable 规则。

接下来的对话细节已经记不清，也不重要了。重要的是找出针对这类运维事故根本原因及解决办法。

我个人认为这类问题的根本原因在于：

1. 配置管理的失控：
    已经没有人完整知道线上环境配置是什么了？要了解时，只能一个个查。
2. 测试环境与生产环境的配置不一致：
    如果那位倒霉的同学在测试环境部署出现这样的问题，到生产环境部署时，自然就会注意相关配置项了。

以上只是我个人认为的，不一定正确，欢迎各位读者讨论。

那如何杜绝这类问题呢？

这两个原因可以看作一个，也可以看作两个。但方法都是一样的：

1. 使用声明式的配置管理方法，而不是脚本式
2. 版本化这些声明的配置
2. 所有环境使用同一套装配置管理方法


### 使用声明式的配置管理方法，而不是脚本式的

脚本式的配置管理是这样的：

```
apt-get install build-essential
apt-get install libtool
cd /usr/local/src
wget ftp://ftp.csx.cam.ac.uk/pub/software/programming/pcre/pcre-8.37.tar.gz
tar -zxvf pcre-8.37.tar.gz
cd pcre-8.34
./configure
make
make install
```
而声明式的配置管理是这样的：

```
# ./ansible-nginx/tasks/install_nginx.yml
    # 使用这个7-0.el7版本的yum包
    - name: NGINX | Installing NGINX repo rpm
       yum:
       name: http://nginx.org/packages/centos/7/noarch/RPMS/nginx-release-centos-7-0.el7.ngx.noarch.rpm

    # 当前机器的nginx的状态应该是最新版本
    - name: NGINX | Installing NGINX
       yum:
       name: nginx  
       state: latest

    # 当前机器的 nginx service 的状态应该是已经启动的。至于如何确保 nginx 这个 service，当前是什么状态的，又是如何启动的，我们不需要关心。
    - name: NGINX | Starting NGINX
       service:
       name: nginx
       state: started
```
声明式的配置里写的是当前环境的“状态”，语意上，声明式的配置不论你执行多少次，你得到最终的“状态”就是你所声明的，这也就实现了《持续交付》里说的：

> 确保部署流程是幂等的
> 无论开始部署时目标环境处于何种状态，部署流程应该总是令目标环境达到同样（正确）的状态，并以之为结束点。

这样，你就不用在第1000次部署时，根据前999次部署脚本找出对这一次部署有影响的细节了。

具体实践时，我发现 Ansible 就能很好的做到这点。

### 版本化这些声明式的配置
将这些配置版本化的好处，就不需要重点说明了。

### 所有环境使用同一套装配置管理方法
具体一点的说就是所有环境都使用相同的声明配置，具体到不同环境时，使用变量替换。这样就可以保证所有环境的一致性了。

具体实践方法，还需要根据所在团队调整。你也可以通过本文附录里链接，参考其他人是如何实践的。

### 小结
* 关于银弹：如果真的按照以上方法就可以确保运维万无一失了吗？很遗憾，答案是否定的。就连亚马逊这样的行业标杆都没有办法做到万无一失。
* 关于定责：见过一些企业凡事都讲究“定责”。定责可以有，但是定责了，是否真的能解决问题了？是值得讨论的。
* 关于配置：团队对于“配置”的理解达成共识很重要
* 关于成本：要实现以上所说的实践成本高吗？是不是需要一个DevOps团队？
    说实话，找到懂这些并有实践经验的人很难，从这一方面看，成本很高。但是这并不是我们不朝这个方向发展的借口。另，对于软件工程的“成本”，大家没有统一的定义，所以也就更不好讨论下去了。


### 附录
关于配置管理

* [关于自动化配置还有什么好说的呢？](https://showme.codes/2016-08-12/automation-configuration/)


多环境配置管理

* [巧用 Ansible 实现配置管理：多环境配置问题](https://showme.codes/2018-03-11/ansible-inventory-configuration/)
* [How to Manage Multistage Environments with Ansible](https://www.digitalocean.com/community/tutorials/how-to-manage-multistage-environments-with-ansible)
