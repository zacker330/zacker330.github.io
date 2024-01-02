---
layout: post
title: "基于Bazel + SQLFluff实现SQL lint"
Description: ""
date: 2023-04-17
tags: [Bazel,SQLFluff,Lint]
comments: true
share: true
---

### 背景

SQL进行版本化控制后，我们希望为SQL加入lint步骤。这样做的好处是我们可以在真正执行SQL前发现问题。

本文中，我们通过Bazel执行[SQLFluff](https://github.com/sqlfluff/sqlfluff)以实现SQL的lint。

SQLFluff是一款使用Python语言使用的，支持SQL多方言的SQL lint工具。

它的特点是：
1. 支持多方言。如：Snowflake、PostgreSQL、ClickHouse。所有支持的方言列表：https://docs.sqlfluff.com/en/stable/dialects.html；
2. 可以输出正确的SQL，减少了我们手工修正SQL的工作；
3. 同时支持命令行方式使用和API调用方式。

### 集成到CI/CD流水线中

在我看来，在CICD流水线中实现SQL lint有两种方式：
- 方式一：在流水线中增加一个SQL lint步骤；
- 方式二：将SQL lint的逻辑写在测试代码，执行测试步骤，就自动执行了SQL lint。

方式二是我最爱，我会在本文最后讲原因。

### 工程结构

```bash
.
├── BUILD.bazel
├── WORKSPACE
├── repository-hibernate-impl
│   ├── BUILD.bazel
│   └── src
│       ├── main
│       │   └── sql
│       │       └── V1__runbook_table.sql
│       └── test
│           └── python
│               ├── BUILD.bazel
│               ├── requirements_lock.txt
│               └── sql_test.py
```


### 步骤1: 在WORKSPACE中增加Python外部依赖
本文中我们使用的是Bazel 5.4.0，所以还在使用WORKSPACE定义外部依赖
```python
http_archive(  
    name = "rules_python",  
    sha256 = "a644da969b6824cc87f8fe7b18101a8a6c57da5db39caa6566ec6109f37d2141",  
    strip_prefix = "rules_python-0.20.0",  
    url = "https://github.com/bazelbuild/rules_python/releases/download/0.20.0/rules_python-0.20.0.tar.gz",  
)  
  
load("@rules_python//python:repositories.bzl", "py_repositories")  
  
  
py_repositories()  
  
load("@rules_python//python:repositories.bzl", "python_register_toolchains")  
  
python_register_toolchains(  
    name = "python3_11",  
    python_version = "3.11",  
)  
  
load("@python3_11//:defs.bzl", interpreter_3_11 = "interpreter")  
  
load("@rules_python//python:pip.bzl", "pip_parse")  
  
# Create a central repo that knows about the dependencies needed from  
# requirements_lock.txt.  
pip_parse(  
   name = "pip_deps",  
   python_interpreter_target = interpreter_3_11,  
   requirements_lock = "//repository-hibernate-impl/src/test/python:requirements_lock.txt",  
)  
# Load the starlark macro which will define your dependencies.  
load("@pip_deps//:requirements.bzl", "install_deps")  
# Call it to define repos for your requirements.  
install_deps()  
```

### 步骤2: 定义SQLFluff依赖

requirements_lock.txt的内容如下：
```python
sqlfluff==2.0.5  
Jinja2==3.1.2  
MarkupSafe==2.1.2  
Pygments==2.15.0  
appdirs==1.4.4  
chardet==5.1.0  
click==8.1.3  
colorama==0.4.6  
diff_cover==7.5.0  
iniconfig==2.0.0  
packaging==23.1.0  
pathspec==0.11.1  
pluggy==1.0.0  
pytest==7.3.1  
tomli==2.0.1  
toml==0.10.2  
exceptiongroup==1.1.1  
pyyaml==6.0  
regex===2023.3.23  
tblib==1.7.0  
tqdm==4.65.0  
typing_extensions==4.5.0
```

### 步骤3: 定义BUILD目标

```python
load("@pip_deps//:requirements.bzl", "requirement")  
load("@rules_python//python:defs.bzl", "py_test")  
  
py_test(  
    name = "sql_test",  
    srcs = ["sql_test.py"],  
    # data传入是sql的label
    data = [ "//repository-hibernate-impl:sqlTest",],  
    deps = [  
       requirement("sqlfluff"),  
       requirement("Jinja2"),  
       requirement("MarkupSafe"),  
       requirement("Pygments"),  
       requirement("appdirs"),  
       requirement("chardet"),  
       requirement("click"),  
       requirement("colorama"),  
       requirement("diff_cover"),  
       requirement("iniconfig"),  
       requirement("packaging"),  
       requirement("pathspec"),  
       requirement("pluggy"),  
       requirement("pytest"),  
       requirement("tomli"),  
       requirement("toml"),  
       requirement("exceptiongroup"),  
       requirement("pyyaml"),  
       requirement("regex"),  
       requirement("tblib"),  
       requirement("tqdm"),  
       requirement("typing_extensions"),  
    ],  
)
```

注：sql的BUILD目标(repository-hibernate-impl/BUILD.bazel)为：
```python
filegroup(  
    name = "sqlTest",  
    testonly = 1,  
    srcs = glob(["src/main/sql/*.sql"]),  
    visibility = ["//visibility:public"],  
)
```

### 步骤4: 调用SQLFluff实现SQL lint

```python
import unittest  
import sqlfluff  
import os  
import codecs  
  
sqls_path = os.path.join(os.getcwd(), "repository-hibernate-impl/src/main/sql/")  
  
dialect = "postgres"  
  
class TestSum(unittest.TestCase):  
    def test_lint_sql(self):  
        sql_dir_files = os.listdir(sqls_path)  
        # 确保目录中有sql文件
        self.assertTrue(len(sql_dir_files) > 0)  
        for sql_filename in sql_dir_files:  
            if sql_filename.endswith(".sql"):  
                f = codecs.open(os.path.join(sqls_path, sql_filename), "r", "utf-8")  
                sql_content = f.read()  
                lint_result = sqlfluff.lint(sql_content, dialect=dialect)  
                # 如果存在lint问题
                if len(lint_result) > 0:  
		            # 通过sqlfluff修复sql的问题，并返回正确的写法。
                    fix_result = sqlfluff.fix(sql_content, dialect=dialect) 
                    # 将正确的sql写法打印出来方便查看
					print("correct sql should be: \n" + fix_result)
                self.assertEqual(len(lint_result), 0)  
  
if __name__ == "__main__":  
    unittest.main()
```

### 执行

我们只需要在工程根目录执行`bazel test //...`命令，就可以对SQL进行lint了。


### 为什么我选择方式二

选择方式二（通过Bazel实现SQL lint）原因有二：
1. 方式一需要开发人员将代码提交后，才可以解决流水线的执行，而方式二，在本地就可以执行，有利于开发人员在本地就可以实现SQL lint。
2. 方式二可以实现构建缓存（Bazel天然支持），可以节约大量的构建成本。


