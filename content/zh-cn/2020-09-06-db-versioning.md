---
layout: post
title: "工程化实践：使用flyway进行数据库版本化"
Description: "版本化一切之一：数据库版本化"
date: 2020-09-06
comments: true
share: true
---
### 摘要
Flyway是一款数据库版本化工具。网上不少文章写的是将Flyway集成到Java应用中实现的。这种方式不适合工程化。本文介绍如何工程化的使用flyway进行数据库版本化。

### 如何理解Flyway
Flyway进行版本化的逻辑非常简单。
1. 在目标数据库中创建一个`flyway_schema_history`的表，用于记录数据库当前的版本。
2. 当执行`flyway migrate`执行，根据config/flyway.conf配置中的连接信息连接到数据库。
3. 检查`sql`目录的sql文件。sql文件名遵从flyway的命名约定。如果`sql`目录的版本比实际数据库中`flyway_schema_history`表里记录的版本要低，则执行升级版本的sql文件。
4. 如果执行升级sql文件成功，则更新`flyway_schema_history`表中记录。

以上是个人理解flyway原理后，用大白话阐述出来的。大家可以看下官方介绍：https://flywaydb.org/getstarted/how

### sql文件的命名约定

![image.png](/assets/images/flywaydb.png)

### 执行样例
在安装完成flyway命令（[下载地址](https://flywaydb.org/documentation/commandline/)）后，执行命令：
```shell
flyway -configFiles=config/flyway.conf migrate
```

执行结果：
```build
Flyway Community Edition 6.5.5 by Redgate
Database: jdbc:h2:file:./foobardb (H2 1.4)
Successfully validated 0 migrations (execution time 00:00.009s)
WARNING: No migrations found. Are your locations set up correctly?
Creating Schema History table "PUBLIC"."flyway_schema_history" ...
Current version of schema "PUBLIC": << Empty Schema >>
Schema "PUBLIC" is up to date. No migration necessary.
```

### 与CI/CD集成
使用1个Git仓库对数据库工程进行版化。目录结构如下：

```shell
├── config
│   ├── flyway.conf
│   └── flyway.template.conf
├── Jenkinsfile.groovy
├── README.md
└── sql
    └── V1__Create_person_table.sql

```

当Git仓库准备好后，我们就需要和类似Jenkins这样的CI/CD集成了。集成的思路很简单，就是把本地执行的命令照搬到CI/CD平台上就行。思路：

1. 准备Flyway的执行环境。推荐在Docker容器中运行。
2. 执行flyway命令。

### 安全问题
flyway.conf文件会有数据库的连接信息，这是敏感信息。我们不应该直接放在Git仓库中。那怎么办？

笔者的办法是config目录中只放flyway.conf的模板文件，比如`config/flyway.template.conf`，在CI/CD中执行flyway migrate执行前，
通过比较安全的方式将flyway.template.conf中的占位符换成真正值。

### 提醒
需要注意的是，生产环境的DB与测试环境的数据量没有可比性。在测试环境能直接运行的SQL，放在生产环境执行可能会发现事故（这也是我们需要引入code review的原因之一）。所以，数据库版本化，如果基础设施能力或团队能力没跟上，不建议在生产环境上进行。



附：工程样例链接 https://github.com/cd-in-practice/flywaydb-example