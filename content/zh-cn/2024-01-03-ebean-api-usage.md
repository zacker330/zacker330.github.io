---
layout: post
title: "Ebean简明教程"
Description: ""
date: 2024-01-15
tags: [Ebean,JPA]
---
> 本文基于Ebean 13
> 本文大量使用的代码InstanceFactory.getInstance(Database.class);指的是从一个实例管理工厂拿到一个Database的实例

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

## CRUD
保存和更新一个实例都是同一个接口：
```java
Database database = InstanceFactory.getInstance(Database.class);
database.save(obj);
```
删除一个实例：
```java
database.delete(obj);
```

查询方法1：
```java
database.find(Artifact.class).where()
.eq("group_id", groupId)
.eq(Artifact.COLUMN_ARTIFACT_ID, artifactId)
.findOneOrEmpty();
```
- find方法传的是实体的类型
- eq方法，参数1是数据库表中的字段名
- findOneOrEmpty方法返回的是一个optional对象，提醒程序员返回的数据可能为null


查询方法2：
```java
database.find(Artifact.class).where()
.eq("group_id", groupId)
.eq(Artifact.COLUMN_ARTIFACT_ID, artifactId)
.findOneOrEmpty();
```


## 通过Ebean生成DDL

## 如何实现集成测试
如果数据库是Sqlite，那么，只需要创建一个`io.ebean.Database`就可以



