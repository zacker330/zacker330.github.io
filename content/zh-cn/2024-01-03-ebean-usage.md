---
layout: post
title: "Ebean工程化"
Description: ""
date: 2024-01-14
tags: [Ebean,JPA]
---
> 本文基于Ebean 13

## Ebean初始化
Ebean的核心API为：`io.ebean.Database`。所有的持久化操作，都是通过它。

但是官网介绍的是DBServer这个静态类接口。个人不推荐。《原因》

以下是初始化方式：
```java
// 指定bean的name是因为一个服务中可能存在多个database
// 比如实现读写分离
@Bean(name = "id_info_database")
public io.ebean.Database idInfoDatabase() {
    HikariDataSource datasource = new HikariDataSource();
    datasource.setJdbcUrl(getIdInfoDbSqliteJDBC());
    datasource.setAutoCommit(true);
    datasource.setDriverClassName("org.sqlite.JDBC");

    DatabaseConfig config = new DatabaseConfig();
    config.setName("id_info_database");
    config.setRegister(true);
    config.setDefaultServer(false);
    config.setDdlExtra(false);
    // 设置ebean从哪些类包中查询
    config.setPackages(Arrays.asList(IdInfo.PACKAGE_PATH));
    config.setDdlCreateOnly(false);
    // 是否生成ddl
    config.setDdlGenerate(isDdlGenerate());
    // 应用启动时，是否执行ddl
    config.setDdlRun(isDdlRun());
    // seed数据sql的路径
    config.setDdlSeedSql(IdInfoRepositoryImpl.SEED_FILE_PATH);
    config.setDataSource(datasource);
    return DatabaseFactory.create(config);
}

```


## 通过Ebean生成DDL

## 如何实现集成测试
如果数据库是Sqlite，那么，只需要创建一个`io.ebean.Database`就可以



