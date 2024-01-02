---
layout: post
title: "PostgreSQL15 Public Schema没有权限问题解决"
Description: ""
date: 2024-01-01
tags: [Postgresql15]
---
PostgreSQL15后，Public Schema的权限发生了变化：普通用户默认在Public schema中不再有CREATE的权限。当他们执行CREATE TABLE命令时，就会报以下错误：
```
ERROR: permission denied for schema public
```
所以，我们需要为该用户再分配权限。命令如下：
```
GRANT USAGE, CREATE on SCHEMA PUBLIC to <username>;
```

因为某些应用程序的sql的migration是自动的，你可能还需要为用户分配更多权限，命令如下：
```
grant all on database <db_name> to <username>;
ALTER DATABASE  <db_name OWNER to  <username>;
```



