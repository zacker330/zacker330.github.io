---
layout: post
title: "使用Mxroute和Sendgrid实现邮箱服务和邮件发送服务"
Description: ""
date: 2023-12-31
tags: [Email]
---
最近在做一个产品，需要用邮箱服务和邮件发送服务。本文以[Mxroute](https://mxroute.com/)和[Sendgrid](https://sendgrid.com/)为例介绍邮箱服务和邮件发送服务的配置。但是所有的这类产品，思路都应该是一致的。

Mxroute是邮箱服务，类似Web服务，只不过，它是专门为邮箱协议而设计的。Sendgrid就是邮件发送服务，也就是你需要批量向一堆邮箱发送邮件时，就需要用邮件发送服务。本质上Sendgrid与Mxroute是两回事。但是，通常我们先配置邮箱服务，再配置邮件发送服务。

本文只为记录一下，将来忘记了可以重新拾起。


## 配置邮箱服务
首先，邮箱服务需要MX类型的域名解析记录。这能让邮箱服务能在整个互联网被解析到。

每一个在Mxroute付费的用户，都会被分配到一个独立的MX域名，如first.mxrouting.net 。他们应该会发邮件给你，你需要留意。

在Mxroute上配置的步骤如下：
1. 创建一个域名。比如example.com。如果你使用的是子域名，也可以是mail.example.com。
![](/assets/images/mail-service-setup-1.png)

2. 拿到DKIM Keys等信息。在Mxroute的左边菜单中可以找到链接
![](/assets/images/mail-service-setup-2.png)

3. 在域名提供商中，再配置以下这些DNS记录

| **记录类型** | **name** | **content** | **优先级** |
| ---- | ---- | ---- | ---- |
| MX | _dmac | v=DMARC1; p=none |  |
| CNAME | mail | <mxroute分配的独立MX域名> |  |
| MX | mail | <mxroute分配的独立MX域名> | 10 |
| MX | mail |<mxroute分配的独立MX域名> | 20 |
| TXT | mail | <从mxroute上获取> |  |
| TXT | x._domainkey |  <从mxroute上获取> |  |

> 如果你使用的是子域名，那么，还需要在 _dmas和x.domainkey 后加上 .<subdomain> 。例如mail子域名，就是 x.domainkey.mail。

通过以上配置，只证明我们的“邮箱服务器”已经配置好了。现在在上面创建账号，并进行测试了。如果你可以向这个账号收发邮件，就证明，你的邮箱服务已经配置完成。

## 配置邮件发送服务

当你有了一个邮箱账号后，你就可以Sendgrid上配置了。登录后，从左边菜单“Senders”进入列表页。
![](/assets/images/mail-service-setup-3.png)

然后再点击按钮“Create new Sender”，即可创建。这部分就不细说了。因为太简单了。



