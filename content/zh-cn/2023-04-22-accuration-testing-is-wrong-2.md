---
layout: post
title: "精准测试不过是增量构建的副产品"
Description: ""
date: 2023-04-22
tags: [Testing]
---
前文中，我们给了“精准测试”定义：
> 它是一种能力，能只针对变更进行测试，而不是每次变更都进行全量测试。

同时，介绍了当前行业里的主流实现方法。个人并不看好该实现方法。

本文介绍的另一种实现精准测试的方法。在真正介绍前，我们就必须先说增量构建和Bazel。

## 全量构建与增量构建
在软件构建领域，存在两种构建类型：全量构建和增量构建。
- 全量构建指的是针对代码仓库中所有的代码进行构建；
- 增量构建是指只针对有变动的代码及受变动影响的相关代码进行重新构建。

从定义看，增量构建要做的事情和精准测试要做的事情几乎是一样的。只不过，把build命令，换成test命令罢了。

这也就是为什么我觉得应该把“精准测试”叫做“增量测试”才对。

目前行业里，在增量构建领域，Bazel可谓是佼佼者。

## Bazel介绍
Bazel是Google 2015年开源的一款构建工具。采用声明式的方式定义所有的构建任务。Bazel叫target。

每个target声明包含了：构建类型、输入、构建方式、输出、依赖等。以下代码展示了两个构建任务：

```python
# 声明打成jar包，作为library被其他任务使用
java_library(  
    name = "greeter",  
    srcs = ["src/main/java/com/example/Greeting.java"],  
)
# 声明打包成一个可执行Jar
java_binary(  
    name = "ProjectRunner",  
    srcs = ["src/main/java/com/example/ProjectRunner.java"],  
    main_class = "com.example.ProjectRunner", 
    # 依赖之前打好的library，这是实现增量构建的关键
    deps = [":greeter"],  
)  
```

Bazel在运行时，就会根据target声明，在内部维护一个有向依赖图，如下：
![](/assets/images/dag-bazel2.png)

有了这个有向依赖图，Bazel就可以实现增量构建。

当用户修改了 Greeting.java 文件时，Bazel知道 //:greeter target 依赖它，所以Bazel知道要执行 //:greeter 时。同时Bazel又知道 //:ProjectRunner 依赖 //:greeter ，所以Bazel知道还要执行 //:ProjectRunner target。

以上是在同一个语言下的增量构建的案例，让我们看下多语言场景下，Bazel是如何实现增量构建的。

## 多语言场景下Bazel是如何实现增量构建的
如下图，在一个软件工程下，同时使用到了：Docker、Python、YAML、C++等技术。

![](/assets/images/bazel-test2.png)
这个依赖关系是在开发和运维在写代码的时候就定义好了的。所以，Bazel从一开始就有了这个依赖图。

Bazel允许声明不同语言的target之间的依赖，所以，很自然的，一个软件工程的完成的依赖图就有了。你不需要花额外的精力去收集。

当执行Bazel进行构建build时，Bazel发现配置文件config.yaml是被修改了，这时它就计算出接下来要执行的构建，如下图标为橙色的路径。即所有的依赖于//:config.yaml 的直接依赖和间接依赖。

但是，因为执行的是build，所以，Bazel只会build路径上的所有源代码，并不会去执行 `*_test` 测试任务。

![](/assets/images/bazel-test.png)

这就是精准构建，不，叫增量构建：只构建需要构建的。

也许你会好奇Bazel是怎么做到的？请关注我的公众号，将来我还会分享更多Bazel的内容。

## Bazel是如何精准测试
Bazel有很多子命令，有两个常用的子命令，一个是`build`，一个是`test`。这两个子命令是用于区分构建的类型的。因为有时，你可能只是想build，不想test。

接着上面的例子，同样修改了config.yaml文件，当我们执行的是test子命令，Bazel会计算出要执行的路径——和上文一样的路径，因为//:config.yaml所影响的依赖范围是一样的。

区别是，这次它除了执行build，还会运行`*_test`类的任务。Bazel并不会关心它是单元测试，还是集成测试，只关心该测试的大小。如下图中的标为黑色的部分：
![](/assets/images/Screen Shot 2023-11-02 at 9.30.45 PM.png)


这就是精准测试了。同时，Bazel还会发现`//:x_test`、`//:main_test`、`//:docker_image_test`是完全独立的测试，那么Bazel就可以进行并行测试，进而提升测试的速度。

## 精准测试是增量构建的副产品
说回我们之前总结的精准测试的实现思路：
1. 找到变更；
2. 根据变更找到相关联的测试用例；
3. 只执行相关联的测试用例。

以上所有步骤都可由Bazel完成，而且可以在本地完成。

所以，使用Bazel后，精准测试的实现，你不需要自己投入研发以支持多语言，更不需要另外开发一堆平台。

但是，以上的好处并不是没有代价的。

## 增量构建（精准测试）的代价
通过以上例子，有读者应该已经注意到了，以上案例是一个单仓库项目，也就是所有的工程（前后端、运维、手机端）的代码都放在同一个仓库下。

这是要实现增量构建的一个前提。

第二个前提是：你必须使用类似Bazel这样的支持增量构建的工具，这意味着过去的项目都可能需要进行构建工具的迁移。而且，类似Bazel的工具，在整个行业的使用率还很低，在公司里推行，需要一定的成本。

最后，你会选择基于Bazel来实现精准测试吗？















