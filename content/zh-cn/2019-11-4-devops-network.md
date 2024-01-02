---
layout: post
title: "谈DevOps平台实施：实现从内网拉取外网依赖的一种方案"
Description: ""
date: 2019-11-4
comments: true
share: true
---

### 背景
在大型企业内部，网络通常会被划分成多个不能直接访问的区域。比如本例中，网络被分成了内网和DMZ两个区域。出于安全的考虑，内网的机器不能直接访问外网。内网访问 DMZ 的机器、DMZ的机器要访问外网都需要单独提流程。

但是，我们的应用能部署到 DMZ 区域中吗？答案是技术上不是问题，但是管理上不允许这样做。

所以，在这样的大型企业内部，应用都会部署到内网中（本例中的A、B、C、D）。

可是，总会有一些应用需要发 HTTP 请求到外网。比如实施DevOps平时，我们的应用需要从外网拉取依赖。

这时，怎么办呢？本文就是为解决此问题而写。

### 解决方案

最后的解决方案如下：

![image.png](/assets/images/292372-062b26be43710a4e.png)

* Privoxy 是一个HTTP 协议过滤代理。
* Squid 是HTTP代理服务器软件。Squid用途广泛，可以作为缓存服务器，可以过滤流量帮助网络安全，也可以作为代理服务器链中的一环，向上级代理转发数据或直接连接互联网。

说实话，光看介绍，笔者一开始也一头雾水。不过，看完本文就应该知道它们的作用了。

以下是方案具体实施步骤：

1. 在应用机器上设置全局环境变量：
```bash
export http_proxy=http://192.168.1.100:3126
export https_proxy=http://192.168.1.100:3126
```
这一步的作用是将本机的 http 流量都代理到 192.168.1.100 的 3126 端口

2. 在 192.168.1.100 上安装 Privoxy。它的作用是根据配置，决定流量走哪个网络。本例中，它的作用是我们指定的http请求，走到 dmz。而其它的则和原来一样。它的配置如下：

```bash
cat /etc/privoxy/config
listen-address  192.168.1.100:3126
forward  .abc.com/  192.168.42.12:3127
```
* listen-address 指 Privoxy 监听的IP和端口
* forward 指接收到符合域名规则（.abc.com）的请求，将转发给 192.168.42.12 的 3127 端口。

到此，得到的效果就是当在应用机器访问 abc.com,admin.abc.com 等时，这些流量都会被 Privoxy 转发到 192.168.42.12 的 3127 端口。其它 HTTP 请求则不会。

而 192.168.42.12 则是安装了 Squid 实现 HTTP 代理的机器的 IP。

3. 在 DMZ 区的机器上安装并配置 Squid。它的作用才是真正地将请求代理到外网。Squid 的配置样例如下：

```bash
cat /etc/squid/squid.conf
http_port 192.168.42.12:3127
cache_mem 64 MB
maximum_object_size 4 MB
cache_dir ufs /var/spool/squid 100 16 256
access_log /var/log/squid/access.log
http_access allow all
visible_hostname squid.demo
```

以上步骤，还要注意机器本身的防火墙策略。

### 后记
在大型企业内部实施 DevOps 平台，还会遇到另一个网络问题，就是内部网络区域之间，也会有不通的情况，这种情况如何解决呢？留给下篇写吧。



