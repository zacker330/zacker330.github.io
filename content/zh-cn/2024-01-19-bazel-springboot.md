---
layout: post
title: "使用Bazel构建Springboot工程"
Description: ""
date: 2024-01-19
tags: [Springboot3.x,Bazel]
---

本文是关于如何使用Bazel搭建Springboot 3.1.0工程（基于JDK17）。为什么使用Bazel，而不是使用Maven或者Gradle？可以看我之前关于Bazel的介绍文章。

## 前期准备
在根目录加入`.bazelversion`文件，并加入`6.2.0`，指定当前工程使用的Bazel的版本。这样，Bazel命令自动使用该版本的Bazel进行构建。

在根目录加入`.bazelrc`文件，并指定构建和测试时使用JDK17，内容如下：
```shell
build --java_language_version=17 --java_runtime_version=17 --tool_java_language_version=17 --tool_java_runtime_version=17
test  --java_language_version=17 --java_runtime_version=17 --tool_java_language_version=17 --tool_java_runtime_version=17
```
## 外部依赖准备
在根目录中创建以下两个文件：
- WORKSPACE：在Bazel中，所有的外部依赖统一定义WORKSPACE文件中；
- BUILD.bazel：内容留空即可，用于告诉Bazel当前目录也是一个Package。

Bazel本身是支持多语言的。所以，我们需要特定语言的rule来帮助我们在WORKSPACE中定义外部依赖。

对于Java工程，我们使用[rules_jvm_external](https://github.com/bazelbuild/rules_jvm_external)进行外部依赖的管理。它的使用步骤如下：

### 步骤1：在WORKSPACE中增加rules_jvm_external配置
以下配置指定了rules_jvm_external的下载位置，并进行rule的初始化：
```python
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")  
  
RULES_JVM_EXTERNAL_TAG = "4.5"  
RULES_JVM_EXTERNAL_SHA = "<sha hash value>"  
http_archive(  
	name = "rules_jvm_external",  
	strip_prefix = "rules_jvm_external-%s" % RULES_JVM_EXTERNAL_TAG,  
	sha256 = RULES_JVM_EXTERNAL_SHA,  
	url = "https://github.com/bazelbuild/rules_jvm_external/archive/%s.zip" % RULES_JVM_EXTERNAL_TAG,  
)  
  
load("@rules_jvm_external//:repositories.bzl", "rules_jvm_external_deps")  
  
rules_jvm_external_deps()  
  
load("@rules_jvm_external//:setup.bzl", "rules_jvm_external_setup")  
  
rules_jvm_external_setup()  
  
load("@rules_jvm_external//:defs.bzl", "maven_install")  
  
maven_install(  
	artifacts = [
		# The project's dependencies
		"junit:junit:4.12",  
		"org.hamcrest:hamcrest-library:1.3",  
	],  
	repositories = [  
		# Private repositories are supported through HTTP Basic auth  
	# "http://username:password@localhost:8081/artifactory/my-repository",    
		"https://maven.aliyun.com/repository/public",  
	],  
)
```
> 以上采用了非Bzlmod的管理rule。
###  步骤2：初始化maven_install.json
rules_jvm_external通过maven_install.json对Java依赖的版本进行固定。类似前端工程通过package-lock.json文件，用于固定依赖的版本。

因为是新工程，需要在根目录执行以下命令生成maven_install.json：
```shell
bazel run @maven//:pin 
```

然后在WORKSPACE中的`maven_install`语句加入：
```python
load("@maven//:defs.bzl", "pinned_maven_install")  
pinned_maven_install()
```
并在maven_install的参数列表中增加`maven_install_json`参数，效果如下：
```python
maven_install(
    # artifacts, repositories, ...
    maven_install_json = "//:maven_install.json",
)
```
### 步骤3：加入Springboot的外部依赖
修改WORKSPACE中maven_install的artifacts的参数，加入Springboot 3.1.0所需的依赖：
```python
SPRING_BOOT_VERSION = "3.1.0"  
SPRING_VERSION = "6.0.9"  
maven_install(  
    artifacts = [  
        # log  
        "org.slf4j:slf4j-api:2.0.7",  
        "ch.qos.logback:logback-classic:1.4.6",  
        # template engine  
        "org.springframework.boot:spring-boot-starter-thymeleaf:%s" % SPRING_BOOT_VERSION,  
        # spring  
        "org.springframework.boot:spring-boot-autoconfigure:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-configuration-processor:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.data:spring-data-jpa:%s" % "3.1.0",  
        "org.springframework.boot:spring-boot-test-autoconfigure:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-starter-test:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-starter-validation:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-test:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-starter:%s" % SPRING_BOOT_VERSION,  
        "org.springframework.boot:spring-boot-starter-web:%s" % SPRING_BOOT_VERSION,  
        "org.springframework:spring-webmvc:%s" % SPRING_VERSION,  
        "org.springframework:spring-beans:%s" % SPRING_VERSION,  
        "org.springframework:spring-context:%s" % SPRING_VERSION ,  
        "org.springframework:spring-test:%s" % SPRING_VERSION,  
        "org.springframework:spring-web:%s" % SPRING_VERSION,  
        "org.springframework:spring-core:%s" % SPRING_VERSION,  
        "org.springframework:spring-orm:%s" % SPRING_VERSION,  
        "org.springframework:spring-tx:%s" % SPRING_VERSION,  
        "jakarta.servlet:jakarta.servlet-api:6.0.0",  
        'javax.annotation:javax.annotation-api:1.3.2',
    ...
```
执行以下命令更新maven_install.json文件：
```shell
bazel run @unpinned_maven//:pin
```

至此目录结构如下：
```shell
> $ tree 
.
├── .bazelrc
├── .bazelversion
├── .gitignore
├── BUILD.bazel
├── WORKSPACE
├── maven_install.json
```

## 创建Maven工程结构
本例中，我们在根目录创建一个server模块来对外提供服务，最终效果图如下：
![](/assets/images/java-sprintboot-idea-screen-shotcut.png)


可以看出，server模块的目录结构与常规的Maven工程的结构相同。在Bazel并不一定需要采用Maven工程的结构，只是为了保持Java工程的习惯。

为达以上效果，我们需要做以下事情：
### 配置rules_spring
由于Springboot的代码需要使用Springboot loader进行启动，Springboot程序的打包逻辑与普通的Java程序不同。这意味着，Bazel原生的 java_binary 无法正常启动Springboot程序。

其它构建工具Maven/Gradle是通过plugin完成对Springboot工程的打包。

而在Bazel通过[rules_spring](https://github.com/salesforce/rules_spring)实现相同的功能。具体方法是在WORKSPACE中加入rules_spring：
```python
http_archive(  
    name = "rules_spring",  
    sha256 = "<hash value>",  
    urls =["https://github.com/salesforce/rules_spring/releases/download/2.3.0/rules-spring-2.3.0.zip",  
    ],  
)
```

### 配置Java构建
在Bazel，构建逻辑写在BUILD.bazel文件中。本案例的`server/src/main/java/BUILD.bazel`的内容如下：
```python
# load rule that you can use it
load("@rules_spring//springboot:springboot.bzl", "springboot")  
  
package(default_visibility = ["//visibility:public"])  
app_deps = [  
    "@maven//:org_thymeleaf_thymeleaf",  
    "@maven//:com_fasterxml_jackson_core_jackson_annotations",  
    "@maven//:org_springframework_spring_beans",  
    "@maven//:org_springframework_spring_core",  
    "@maven//:org_springframework_boot_spring_boot_starter_thymeleaf",  
    "@maven//:org_springframework_boot_spring_boot_loader_tools",  
    "@maven//:org_springframework_boot_spring_boot_loader",  
    "@maven//:org_springframework_boot_spring_boot",  
    "@maven//:org_springframework_boot_spring_boot_autoconfigure",  
    "@maven//:org_springframework_boot_spring_boot_starter_web",  
    "@maven//:org_springframework_spring_context",  
    "@maven//:org_springframework_spring_webmvc",  
    "@maven//:org_springframework_boot_spring_boot_starter_validation",  
    "@maven//:jakarta_servlet_jakarta_servlet_api",  
    "@maven//:org_springframework_spring_web",  
    "@maven//:ch_qos_logback_logback_classic",  
    "@maven//:org_slf4j_slf4j_api"  
]  

# define a lib contains all java files, in this case
java_library(  
    name = "lib",  
    srcs = glob(["**/*.java"]),  
    deps = app_deps,  
    # include the all resources
    resources = ["//server/src/main/resources:server-resources"],  
)  
  
springboot(  
    name = "springboot",  
    # specify the main class
    boot_app_class = "codes.showme.server.Main",  
    # refrence the library
    java_library = ":lib",  
    # build failed is there's any duplicated classes
    dupeclassescheck_enable = True,  
dupeclassescheck_ignorelist = "//server:springboot_dupeclass_allowlist.txt",
)
```

### 配置Resources
本例中，我们采用了Thymeleaf模板引擎进行前端渲染。所以，我们在`server/src/main/resources/templates/pages`中增加Thymeleaf模板。

为了告诉Springboot Thymeleaf的模板的位置，在application.yml配置以下内容：
```yaml
spring:  
  thymeleaf:  
    mode: HTML  
    # prefix: file:<path of the templates>  
    prefix: classpath:/templates/pages/  
    cache: false  
    content-type: text/html  
    encoding: UTF-8  
    suffix: .html  
    check-template-location: true  
  application:  
    name: bazel-springboot  
  main:  
    banner-mode: "off"
```
最后，再在`server/src/main/resources/BUILD.bazel`中配置server-resources target：
```python
filegroup(  
    name = "server-resources",  
    srcs = glob([  
        "application.yml",  
        "templates/pages/**/*",  
    ]),  
    visibility = ["//visibility:public"],  
)
```

至此，基础工程已经配置完成。看起来需要配置很多内容。但是这些配置就是在工程开始时配置一次。今后修改就不需要配置这么多内容了。

文章最后提供了本文的代码模板。使用该模板即可节约大量配置时间。

## 构建并启动工程

基础工程已经配置完成后，剩下的就是在此基础上构建新功能，并执行调试。

我们通过以下命令进行构建：
```shell
bazel build //...
```
如果希望在本地启动并调试，运行以下命令：
```shell
bazel run //server/src/main/java:springboot
```

如果运行在生产环境，建议使用Bazel打包好的bazel-bin/server/src/main/java/springboot.jar，或者将其打包到Docker镜像中。

## 总结
本教程遗留了以下几个问题需要处理：
1. 未集成ORM的能力；
2. 未集成前端JS/CSS相关的能力。

以上能力接下来的教程中实现。

完整的工程地址：https://github.com/zacker330/bazel-springboot-project-template

## 补充
rules_spring提供了类冲突检测能力，构建时出现如下异常，时代表工程中存在重复的依赖。这一检测能力对软件工程的稳定性非常有益。遇到这种情况，你有两种选择：
1. 移除其中一个依赖；
2. 在dupeclassescheck_ignorelist的文件中配置允许重复。
```shell
Exception: Found duplicate classes in the packaged springboot jar
Spring Boot packaging has failed for bazel-out/darwin-fastbuild/bin/server/src/main/java/springboot.jar because multiple copies of the same class, but with different hashes, were found:
  class jakarta/servlet/annotation/ServletSecurity$EmptyRoleSemantic.class
    jar processed_jakarta.servlet-api-6.0.0.jar hash b31cc341ef8131abf1c791b152880c53
    jar processed_tomcat-embed-core-10.1.8.jar hash 54513d067d21bf5a31fe942473085bec
  class jakarta/servlet/annotation/ServletSecurity$TransportGuarantee.class
    jar processed_jakarta.servlet-api-6.0.0.jar hash eb31c9cca28bba1ba7f3e6fc5839e828
    jar processed_tomcat-embed-core-10.1.8.jar hash 0acd10bfd01aa6cec1b89cdd0fcbd0f9
  class jakarta/servlet/annotation/ServletSecurity.class
    jar processed_jakarta.servlet-api-6.0.0.jar hash 9b7a0b
```

