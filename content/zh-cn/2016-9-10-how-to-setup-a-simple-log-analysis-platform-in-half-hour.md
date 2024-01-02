---
layout: post
title: "如何在半小时搭建一个简单的日志分析平台？"
Description: "最好了解下Ansible和Vagrant"
date: 2016-9-10
tags: [Elasticsearch, Logstash, Kibana, Ansible, Vagrant]
comments: true
share: true
---

人们常常说数据如金，可是，能被利用起的数据，才是“金”。而互联网的数据，常常以日志的媒介的形式存在，并需要从中提取其中的"数据"。

从这些数据中，我们可以做用户画像（每个用户都点了什么广告，对哪些开源技术感兴趣），安全审计，安全防护（如果1小时内登录请求数到达一定值就报警），业务数据统计（如开源中国每天的博客数是多少，可视化编辑格式和markdown格式各占比例是多少）等等。

之所以能做这些，是因为用户的所有的行为，都将被记录在nginx日志中或其它web服务器的日志中。日志分析要做的就是将这些日志进行结构化，方便我们的业务人员快速查询。日志分析平台要做的就是这些。

说完这些，你是不是觉得日志分析平台很难做，需要十人的团队加班几个月才能完成？

自从有了Elasticsearch、Logstash、Kibana，俗称ELK，小公司也可以很轻松地做日志分析了。说白了，1天几G的日志，ELK完全可以吃得消。就像标题说的，只需要1个人半小时就可以搭建好了。前提是你已经熟悉了Ansible。下文也假设你已经熟悉Anbile，如果不熟悉可以看看我的另一篇文章：[Puppet，Chef，Ansible的共性](https://my.oschina.net/zjzhai/blog/600430)

本文目的就是教你如何在搭建一个日志分析平台的雏形。有了这个雏形，你可以慢慢迭代出更强大，更适合你业务的日志分析平台。同时，提供可执行的源代码：[OSC-AdCenter](http://git.oschina.net/zacker330/OSC-AdCenter)



#### 简单日志分析架构图

![简单日志分析架构图](/assets/images/2016-9-elk.png)

我做了简化，架构图中的每个组件都可以分别放到不同的机器。这里简单介绍下这些你组件：

- your app：你的应用，我们的源码中，把这个给省略了
- Openresty：基于Nginx的Web开发平台，你可以想像它基于Nginx做了很多扩展，类似淘宝的Tengine。为什么我们不直接使用Nginx呢？因为在Openresty上，我们可以做更多事情。
- Logstash：日志收集，结构化数据后，push到Elasticsearch中，基于JRuby。可使用其它日志收集工具替代，比如[Beats](https://www.elastic.co/guide/en/beats/libbeat/current/index.html)
- Elasticsearch：分布式搜索引擎，基于Lucene
- Kibana：用于可视化数据，基于NodeJs



#### 日志分析平台开发所需要工具

* [Ansible](https://www.oschina.net/p/ansible) 2.0+：简单的自动化配置工具，运维工具。[关于自动化配置还有什么好说的呢？](https://my.oschina.net/zjzhai/blog/732120)
* [Vagrant](https://www.oschina.net/p/vagrant)：操作系统虚拟化工具，开发时使用。如果没有听过，Docker总听过吧。这家伙就和Docker完全类似的功能，也早于Docker出现。
* 一个简单的支持yml格式高亮的文本编辑器，比如Atom
* 自行下载JDK8:**jdk-8u66-linux-x64.tar.gz**放到项目路径：`provision/roles/jdk8/files/jdk-8u66-linux-x64.tar.gz` P.S. 抱歉这个的确需要你自己下。
* 什么？不用写代码吗？的确不用需要写。如果你要扩展这个雏形就会需要写一些脚本。



#### 启动一台服务器

因为我们需要在本地开发好以后，再部署到生产环境，所以，我们需要一台服务器用来做实验。用Vagrant可以在你的开发机上虚拟化一台。clone 下 OSC-AdCenter后，进入项目目录执行：`Vagrant up`

文件Vagrantfile有描述这台机器的配置：

```ruby
Vagrant.configure(2) do |config|

  ANSIBLE_RAW_SSH_ARGS = []
  machine_box = "trusty-server-cloudimg-amd64-vagrant-disk1"
  machine_box_url = "https://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-amd64-vagrant-disk1.box"

  config.vm.define "oscadcenter" do |machine|
    machine.vm.box = machine_box
    machine.vm.box_url = machine_box_url
    machine.vm.hostname = "oscadcenter"
    machine.vm.network "private_network", ip: "192.168.4.10" ##指定这台机器的IP，只能宿主机能访问
    machine.vm.provider "virtualbox" do |node|
        node.name = "oscadcenter"
        node.memory = 4048
        node.cpus = 2
    end
   end

end
```

更多关于Vagrantfile：https://www.vagrantup.com/docs/vagrantfile/

Vagrant机器的默认账号密码都是: **vagrant**，所以你可以使用`ssh vagrant@192.168.4.10`登录这台机器。也可以使用vagrant命令登录，在Vagrantfile所在目录下执行：`vagrant ssh oscadcenter`。

#### 部署日志分析平台

在你的开发机上，安装好ansible：

服务器准备好了，我们只需要一条命令就可以部署OSC-AdCenter了：

```shell
ansible-playbook ./provision/playbook.yml  -i ./provision/inventory  -u vagrant -k
```

然后输入ssh登录密码：**vagrant**。



简单说明：

- ansible-playbook是ansible的一个命令

- ./provision/playbook.yml是描述你的服务器配置的文本，你可以想像成所有的部署脚本都写在这个文件中

- ./provision/inventory是服务器在playbook在的host与ip的映射表，比如playbook中这么写：

  ```
  ---
  - hosts: adcenter
  ```

  那么，inventory文件就是这样的：

  ```
  [adcenter]
  192.168.4.10
  ```

  具体请看文档：http://docs.ansible.com/ansible/intro_inventory.html


- `-u vagrant -k` 表示使用vagrant账号ssh登录目标机器



**部署的这个过程，要看你的网速和elastic源的提供速度，可能会很漫长。** 参考时长为半小时。建议执行部署后，做些别的事情，比如午休。

#### 测试部署是否成功

1. 打开Elasticsearch http://192.168.4.10:9200/_plugin/head/ 可看到界面：

   ![es](/assets/images/2016-9-es.png)

2. 打开Kibana http://192.168.4.10:5601 可看到界面：

   ![kibana](/assets/images/2016-9-kibana.png)

3. 打开各种浏览器，输入url：[http://192.168.4.10/1.gif?account=oschina&e=pv&p=p233444&url=www.oschina.net&title=学习&sh=1200&sw=800&cd=400&lang=en](http://192.168.4.10/1.gif?account=oschina&e=pv&p=p233444&url=www.oschina.net&title=学习&sh=1200&sw=800&cd=400&lang=en)，然后可在Elasticsearch中和kibana中看到相应的数据



我使用Chrome访问了两次url，再使用Safari访问了一次。就这样，Elasticsearch中出现了3条数据，而Kibana中我们可统计出，过去4小时中，Chrome占了2/3，而Safari占 1/3。





#### 部署过程都执行了什么？

从部署脚本的入口`./provision/playbook.yml`看:

```yaml
- hosts: analysis
  sudo: yes
  vars_files:
    - ./vars/base-env.yml
    - ./vars/analysis-logstash.yml

  roles:
    - common # 执行一些基础工作
    - openresty # 安装openresty
    - {role: "analysis-openresty-conf",   nginx_server_conf: "analysis.conf"} # 配置openresty
    - jdk8 # 安装jdk8，并设置JAVA_HOME到 /etc/profile中
    - ansible-role-elasticsearch  #安装 es
    - ansible-role-kibana-4 # 安装kibana4
    - ansible-logstash # 安装logstash

```

这里的ELK的role都是从Ansible 的 [Galaxy](http://galaxy.ansible.com/list#/roles)上download下来的。



#### 然后呢？

1. 学习Kibana的查询语法，根据业务需求来统计分析日志。
2. 对当前的日志分析平台实施监控，哪天系统挂了，你都不知道。
3. 与现在有的系统结合。
4. 解决当单个Elasticsearch，特别庞大时的扩容问题



#### 最后

好吧，如果你不会Ansible，你半小时可能搞不定。所以，我说的半小时，其实并不科学。但是这也恰恰说明了使用的自动化配置的好处。我一个运维外行，利用Ansible两三天就搭建好了一个简单日志分析平台。

而且如果你要在生产环境使用这套系统，你只需要在线上准备一台干净的ubuntu服务器，修改inventory文件的IP就可以了。

现实中的日志分析平台一定不会这么简单的，本次教程，只是抛砖引玉。


附：项目源代码位置 http://git.oschina.net/zacker330/OSC-AdCenter