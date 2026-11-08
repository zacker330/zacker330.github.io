---
layout: post
title: "[译] Bazel 的 strategies 是什么？"
Description: "介绍 Bazel 的 standalone、sandboxed、worker 和 remote strategies，说明执行语义、配置方式及 SpawnRunner 的职责。"
date: 2026-11-09T00:00:00+08:00
draft: false
tags: [Bazel, 构建系统, 翻译]
categories: ["软件工程"]
comments: true
share: true
---

> 原文：[What are Bazel's strategies?](https://jmmv.dev/2019/12/bazel-strategies.html) · Julio Merino · 2019 年 12 月 14 日。译文保留原文当时的技术描述。

“strategies？你要聊 Bazel 称霸世界的战略 🙀？”呃……不完全是。

过去几个月，dynamic execution 一直是我工作中的热门话题，我也正准备写一系列文章来介绍它。不过，在此之前，得先回顾一下 Bazel 的 execution strategies。要理解 dynamic execution *是什么*、*如何实现*，execution strategies 很重要。

简单来说，**strategies** 是 Bazel 对一套子进程运行机制的抽象，用于执行 action 的一部分工作，比如调用编译器。它们本质上就是加强版的 Unix `exec()` 系统调用或 Windows `CreateProcess`，能让子进程在*差别很大*的环境中运行。

不过，有一条约束始终不变：strategy *不影响*执行语义。也就是说，同一条命令行交给 strategy `A` 和 strategy `B` 执行，必须生成相同的输出文件。因此，切换 strategy 不会让 analysis graph 失效。

有了这个保证，就可以在运行时混用不同的 strategy，而不影响输出行为。Bazel 通过可重复指定的 `--strategy` 参数提供这项能力，参数值的形式是 `[mnemonic]=strategy`。你可以用它指定某一类 action 使用哪个 strategy。例如，`--strategy=remote --strategy=Javac=worker` 会把默认 strategy 设为 `remote`，只有 Java 编译使用 `worker`。另外，`--strategy_regexp` 可以根据 action message 选择 strategy，不过这里先不谈这套“魔法”。Bazel 也有一些挺巧妙的机制，支持[自动选择 strategy](https://blog.bazel.build/2019/06/19/list-strategy.html)。

实现上，所有 strategy 都是实现了 [`SpawnActionContext`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/actions/SpawnActionContext.java;l=22;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06) 接口的类。说得简单些，它们需要提供一个 `exec()` 方法，接收 `Spawn`（基本上就是一份命令行描述），返回一组 `SpawnResult`。为什么是一组？因为 strategy 可能会重试，失败尝试的结果也会包含在返回值里。

再往下看，strategy 封装了一个 [`SpawnRunner`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/exec/SpawnRunner.java;l=92;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)，真正知道如何运行 spawn 的是它。这个接口的 `exec()` 只返回一个 `SpawnResult`，由此就能理解 strategy 和 spawn runner 的分工：strategy 围绕 spawn runner 组织上层逻辑，spawn runner 负责执行细节。

有了这些背景，下面来看看 Bazel 的几种主要 strategy。

## `standalone` strategy

`standalone`（也叫 `local`）是最简单的 strategy。想了解 Bazel 中 strategy 和进程执行的内部机制，可以从它入手。

这个 strategy 直接*在* output tree 中执行 spawn。具体来说，命令的当前工作目录位于 output tree 内，所有文件引用也都在这个目录下。进程的行为不受限制，因此可能无意间影响到不相关的文件。

这个 strategy 的实现是 [`StandaloneSpawnStrategy`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/standalone/StandaloneSpawnStrategy.java;l=25;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)，使用 [`LocalSpawnRunner`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/exec/local/LocalSpawnRunner.java;l=71;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)。

## `sandboxed` strategy

`sandboxed` strategy 用来兑现 Bazel 对构建正确性的承诺，也是所有 local action 的默认 strategy。如果你没有做过任何定制，这里的 local action 就是全部 action。

这个 strategy 在受控环境中运行每个 spawn。环境与 output tree 隔离，还会限制进程与系统的某些交互，例如禁止访问网络。

执行 `exec()` 时，sandbox strategy 会依次完成以下步骤：

1. 在 output tree 之外创建一个目录，里面只放 spawn 所需的输入文件，并将这些文件设为只读。目前采用的是 symlink forest。
2. 在这个独立目录中执行 spawn，利用操作系统提供的技术限制进程行为，比如 Linux 的 namespaces 和 [macOS 的 `sandbox-exec`](https://jmmv.dev/2019/11/macos-sandbox-exec.html)。
3. 将输出从 sandbox 移到 output tree。
4. 删除 sandbox。

这个办法能用……但可能明显拖慢 action 的执行。这一直让我很不满意，我也已经花了很长时间，尝试[用 sandboxfs 改善它](https://blog.bazel.build/2018/04/13/preliminary-sandboxfs-support.html)，只是暂时还没有取得重大突破。

这个 strategy 为每个受支持的操作系统分别实现一个类，代码都在 [`sandbox`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/sandbox/;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06) 子目录中。

## `worker` strategy

有些语言的编译器启动成本很高，有些编译器会保留状态来优化 incremental build。`worker` strategy 就是为了加快这些语言的 edit/build/test cycle。它会与一个长期运行的 [*persistent worker* 进程](https://blog.bazel.build/2015/12/10/java-workers.html)通信，把要执行的命令行发送给这个独立进程。

以 Java 为例，persistent worker 可以省去 JVM 启动和 JIT 预热的开销。对于 Dart，persistent worker 能让编译器把文件状态保留在内存中，从而大幅加快后续编译。

启用 worker 也有风险。与常规的启动、退出进程的方式相比，它更容易引入正确性问题。处理 action 时出现的 bug，如果编译器紧接着就退出，可能并无大碍。但如果编译器长期运行，还会用来处理其他文件，这些 bug 就可能引发连锁问题。（没错，我们确实遇到过，比如 Swift worker 就出过这类问题。）

另外，Bazel 目前对 worker 的管理还很粗糙，盲目启用 worker，可能会让内存压力把机器拖垮。我们计划大幅改进这部分，但还没来得及动手。

这个 strategy 的实现是 [`WorkerSpawnStrategy`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/worker/WorkerSpawnStrategy.java;l=29;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)，使用 [`WorkerSpawnRunner`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/worker/WorkerSpawnRunner.java;l=65;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)。

## `remote` strategy

`remote` strategy 是 Bazel 皇冠上的明珠。有了它，Bazel 就能在远程机器上执行进程，让项目摆脱单台机器构建能力的限制。

即使只考虑通过 gRPC 协调远程机器、对请求进行多路复用和应对网络故障这些工作，它也是所有 strategy 中最复杂的一个。这里就不展开细节了。

这个 strategy 的实现是 [`RemoteSpawnStrategy`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/remote/RemoteSpawnStrategy.java;l=30;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)，使用 [`RemoteSpawnRunner`](https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/remote/RemoteSpawnRunner.java;l=99;drc=b202e1b026cea27d4939f1782c66f9e5f3b1cd06)。

---

今天就先聊到这里。接下来的文章会详细介绍 dynamic execution，应该也会多次引用本文。

不过要留意，随着 [Platforms & Toolchains 工作](https://groups.google.com/forum/#!topic/bazel-dev/SJyIAtJ6lIQ)推进，Bazel 中 strategy 的定义和注册方式有不少细节即将改变。strategy 的具体实现应该不会变。
