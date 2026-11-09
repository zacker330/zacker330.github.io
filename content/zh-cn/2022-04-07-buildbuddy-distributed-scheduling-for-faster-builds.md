---
layout: post
title: "[译] 通过分布式调度加快构建"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-distributed-scheduling-for-faster-builds"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Tyler Williams"]
original_url: "https://www.buildbuddy.io/blog/distributed-scheduling-for-faster-builds"
original_title: "Distributed Scheduling for Faster Builds"
original_date: 2022-04-07T08:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Distributed Scheduling for Faster Builds](https://www.buildbuddy.io/blog/distributed-scheduling-for-faster-builds)<br>
作者：Tyler Williams · 原文发表于 2022-04-07。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

先向还不了解的读者介绍一下 BuildBuddy。我们为 Bazel 构建提供 UI、分布式缓存和 remote execution 平台，安全地编译代码、缓存 artifacts，并展示结果。使用这套服务，可以在笔记本上用不到 5 分钟构建 Tensorflow 等项目，而原先需要 90 分钟。

显然，要做到这一切，我们必须应对一些棘手的工程挑战，其中之一就是安排远程执行。为此，我们有一个调度程序。调度程序只是将我们的 API 接收到的 actions（基本上是作业）与实际执行工作的远程 workers 相匹配。如果您将 Tensorflow 之类的完整 构建 视为 10 道菜的餐食，那么单个 action 就相当于该餐食一小部分的食谱。为了更容易可视化，这里有一个来自构建 BuildBuddy 的真实 action：

```bash
# this action just uses gcc to compile zlib/infback.c into an object file, zlib/infback.o
/usr/bin/gcc -U_FORTIFY_SOURCE -fstack-protector -Wall -Wunused-but-set-parameter \
  -Wno-free-nonheap-object -fno-omit-frame-pointer -g0 -O2 -D_FORTIFY_SOURCE=1 \
  -DNDEBUG -ffunction-sections -fdata-sections -MD -MF \
  bazel-out/k8-opt-exec-34F00540/bin/external/zlib/_objs/zlib/infback.d \
  -frandom-seed=bazel-out/k8-opt-exec-34F00540/bin/external/zlib/_objs/zlib/infback.o \
  -iquote external/zlib -iquote bazel-out/k8-opt-exec-34F00540/bin/external/zlib \
  -isystem external/zlib/zlib/include \
  -isystem bazel-out/k8-opt-exec-34F00540/bin/external/zlib/zlib/include -g0 \
  -Wno-unused-variable -Wno-implicit-function-declaration -fno-canonical-system-headers \
  -Wno-builtin-macro-redefined -D__DATE__="redacted" -D__TIMESTAMP__="redacted" \
  -D__TIME__="redacted" -c external/zlib/infback.c -o \
  bazel-out/k8-opt-exec-34F00540/bin/external/zlib/_objs/zlib/infback.o
```

这是另一个：

```bash
# this action uses protobufjs to generate typescript bindings for a protobuf file
bazel-out/host/bin/external/npm/protobufjs/bin/pbts.sh
--out=bazel-out/k8-fastbuild/bin/proto/buildbuddy_service_ts_proto.d.ts
bazel-out/k8-fastbuild/bin/proto/buildbuddy_service_ts_proto.js
--bazel_node_modules_manifest=bazel-out/k8-fastbuild/bin/proto/__buildbuddy_service_ts_proto_pbts.module_mappings.json
```

也就是说，构建一个二进制文件需要编译、链接许多库，一个 action 通常就是其中的一条命令。理解这一点就可以继续往下看了。

假设我们有数百或数千个 actions 一次访问我们的 API，并且有一个远程 workers 池准备运行它们。让我们开始吧。如果您像我一样，您首先想到的是 *负载均衡器*。我的意思是，为什么不呢？这些只是需要到达机器池的请求，而负载均衡器是一种非常常见且易于理解的方法。

最初我们确实这样做：在一组 executors 前面放一个 nginx。它能工作，但负载很不均匀。典型 Web 应用中的请求往往相近，例如静态文件查询或简单页面 actions，通常不到一秒就完成。我们的任务却差别很大：最快的 gcc 编译只生成一个目标文件，耗时几十毫秒；大型链接任务需要读取全部目标文件，可能超过 30 秒；某些测试 actions 则要运行单元测试二进制文件，耗时超过 30 分钟。

发生的情况是，负载均衡器会以循环方式分配任务，并将两个大型任务放在同一个 worker 上，而其他 workers 则闲置在那里，而 构建 将花费比应有的时间更长的时间。

我应该提到，我真的希望它能够工作，因为我不想编写调度程序。这看起来很复杂而且有风险。我宁愿使用一些简单且经过充分测试的东西，而不是 构建 自定义关键基础设施（例如调度程序）。事实上，我尝试了各种方法来避免这样做，从使用不同的负载平衡技术（例如最小负载或指数加权移动平均 (EWMA)），到尝试将工作拆分到多个负载平衡器 targets，再到使用 Kubernetes 调度程序。

最后，这些办法都不太理想。负载均衡器不适合这里，根本原因是它不知道所分配请求的任务规模。虽然可以额外提供提示，但那就得自己实现负载均衡算法，或维护非常复杂的路由配置。这两种做法都违背了最初选用负载均衡器的理由：快速、简单。

于是，我开始读调度器相关资料，找到了一篇介绍分布式调度器 Sparrow 的论文：[https://cs.stanford.edu/~matei/papers/2013/sosp\_sparrow.pdf](https://cs.stanford.edu/~matei/papers/2013/sosp_sparrow.pdf)。文章短而清楚，还介绍了几个很有意思的想法，其中最重要的是随机二选一。

注

[随机负载均衡中两种选择的威力](https://www.eecs.harvard.edu/~michaelm/postscripts/mythesis.pdf)

典型负载均衡器会根据请求耗时，记录 worker 的负载指标，再据此分配新请求。但这些指标来自过去的请求，容易过时，影响分配效果。一个更好的办法，是随机挑选两个 workers，把任务分配给其中负载较低的一个。这样可以指数级地改善最大负载。

Sparrow 对随机二选一做了些调整，还加入了 Late-Binding。许多调度器让每个 worker 维护一个队列，再把任务分配给队列最短的 worker。但队列长度并不能准确反映任务耗时，这正是它在我们这类负载下表现不佳的原因之一。Late-Binding 把同一个任务放进多个 workers 的队列，由最先轮到该任务的 worker 领取执行，避免一个大任务堵住其他工作。

这篇论文如此精彩的另一个原因是作者实际实现了 Sparrow，移植了 Apache Spark 来使用它，然后分析了结果。旁注：我希望更多这样的论文！读起来很有趣。

Sparrow 是 *分布式* 调度算法，因此没有单个节点掌握世界的整个状态。这对我们 BuildBuddy 来说非常重要，因为我们希望我们的基础设施具有弹性。当 API 服务器或后端 worker 重新启动或关闭时，无论出于何种原因，我们都不希望它影响客户构建。

我以这篇论文为基础，用 Go 实现了 Sparrow，实际没有想象中那么难，大约只花了几天，比此前寻找替代方案的时间短得多。论文的主要作者还通过邮件帮忙答疑。替换掉负载均衡器后，效果几乎立刻超过了此前的方案，构建不再因为负载不均而超时。算法具有分布式特性，我们还能把 workers 放在经常会重启的廉价可抢占机器上，不用担心任务丢失。（这种机器的价格还不到原来的一半！）

今天我们仍在生产中使用这个调度程序，它对我们来说运行良好。我们对请求的路由方式进行了一些修改，但从根本上讲，该算法与论文中的算法相同，也是今天为 BuildBuddy 上的所有 remote execution 提供支持的算法。

如果您想了解有关 BuildBuddy 的更多信息或尝试一下，请查看 [我们的文档](https://www.buildbuddy.io/docs/introduction/)。如果您喜欢这种解决问题和工程工作，[我们正在招聘](https://www.buildbuddy.io/careers/)！

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
