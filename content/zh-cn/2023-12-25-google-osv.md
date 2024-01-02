---
layout: post
title: "使用Google OSV工具扫描依赖安全漏洞"
Description: ""
date: 2023-12-25
tags: [DevOps,DevSecOps]
---
![](/assets/images/xkcd-dependency.png)

## 安全漏洞是软件工程化能力的试金石
2021年年底，Log4j的漏洞陆续被公开。因为该框架被大量的开源软件依赖，所以，漏洞影响面非常大。

面对这个漏洞，我们遇到的第一个问题是：如何知道我们哪些工程使用了Log4j？

在我看来，这个漏洞是企业软件工程化的一颗非常好的试金石。因为：
1. 如何第一时间了解到这个漏洞，反应这家企业的安全能力；
2. 如何第一时间能找到所有使用了Log4j的位置，体现了这家企业第三方软件依赖管理能力；
3. 替换Log4j的速度，体现企业的持续集成、持续部署的能力。

## Google的开源软件安全漏洞扫描工具
今天介绍的OSC-Scanner，能加强我们第1项和第2项能力。

OSV-Scanner是Google在2022年12月13日推出的一款免费的安全扫描工具。它具有以下特点：
1. 支持多生态系统，包括：Go、PyPI、RubyGens、Linux、Maven等16个生态系统；
2. 同时支持直接依赖的扫描和间接依赖的扫描；
3. 采用标准的漏洞记录格式；
4. 从当前最大的开源软件漏洞数据库（https://osv.dev/）获取信息。这也是DenpencyTrack和Flutter安全工具的漏洞数据库。

OSV-Scanner是一款命令行工具，我们可以将它集成到我们的构建工具或者CICD Pipeline中。目前它已经被集成到Scorecard中。Scorecard是一款为开发源软件的安全健康度打分的开源软件。我们可以在Github Actions中使用它：https://github.com/ossf/scorecard/tree/main?tab=readme-ov-file#scorecard-github-action

## OSV-Scanner的安装

Windows：
```shell
scoop install osv-scanner
```

Mac Homebrew:
```
brew install osv-scanner
```

也可以直接下载二进制包：https://github.com/google/osv-scanner/releases

具体安装文档：https://google.github.io/osv-scanner/installation/

## OSV-Scanner的使用
Keras是一个使用Python编写的开源人工神经网络库。我们以它为例。命令行里运行以下命令：
```shell
./osv-scanner_1.3.6_linux_amd64 --format json keras/
```

![](/assets/images/osv-scanner-keras.png)

输出内容说明：keras存在一个“潜在内存泄漏”的漏洞。

当拿到json结果后，我们的DevOps平台就可以进行一些告警监控的操作。

## 后记
osv-scanner目前需要连osv.dev，才能使用。但是，已经开放实验功能，允许用户离线使用osv-scanner。这是自建DevOps平台的福音！

