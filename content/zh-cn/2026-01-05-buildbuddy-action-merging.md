---
layout: post
title: "[译] Action Merging"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-action-merging"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Iain Macdonald"]
original_url: "https://www.buildbuddy.io/blog/action-merging"
original_title: "Action Merging"
original_date: 2026-01-05T14:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Action Merging](https://www.buildbuddy.io/blog/action-merging)<br>
作者：Iain Macdonald · 原文发表于 2026-01-05。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

BuildBuddy 的 remote execution 引擎会合并相同 actions 尚未完成的执行，为用户节省时间和资源。本文会介绍 action merging 为什么有用、具体如何实现，以及我们多年来在生产环境中积累的经验。

## 概述 {#overview}

缓存 action 结果是 Bazel 的核心性能优化之一。但本地缓存和 remote Bazel 缓存都不能共享尚未完成的执行结果。比如，Alice 提交一项后端改动，需要运行 BigSlowTest。测试尚未结束，Bob 又提交一处很小的前端改动，Bob 仍得重新运行同一个 BigSlowTest。这会拖慢他的 invocation，还可能重复消耗模拟器许可证或配额等外部资源。

![](/images/buildbuddy/action-merging-timeline-db317991b5cb4158ab144023d7aa4a82-57a3227bed17.webp) *A Alice 和 Bob 未合并的 BigSlowTest 执行的时间线。*

这个例子并不只是设想。下文介绍的 action merging 系统，在生产高峰期每秒会合并超过 1,000 个 actions，为某些长时间运行的测试节省接近 3 小时。Stripe 也曾在[这篇文章](https://stripe.com/blog/fast-secure-builds-choose-two)中介绍过他们解决同类问题的内部方案。

## 背景 {#background}

### Actions 和执行 {#actions-and-executions}

Actions 是 Bazel 的工作单元，作为更大的 invocation 的一部分运行。 action 可能是编译或链接命令。每个 action 都有一个 ID，称为 Action ID，它是 action 的定义（命令、环境变量）和所有输入的哈希值。

```shell
g++ your_file.cpp -o your_program_name
```

执行是单个 action 的运行，由执行开始时生成的称为“执行 ID”的唯一 ID 进行标识。每次执行总是恰好有一个 action，但 action 可能有零次、一次或多次执行。

![](/images/buildbuddy/action-merging-definitions-4f931d5379486ca76ce5641917820fec-f323f818f4c9.webp) *一个简单的 action，以及对该 action 的一次执行。*

### BuildBuddy {#buildbuddy}

BuildBuddy的remote cache和remote execution主要由两个服务实现：有状态的“应用程序”，用于存储和服务缓存、与数据库交互以及执行调度；以及运行远程执行的无状态自动缩放“executors”。 BuildBuddy 使用 [Sparrow 调度算法](/zh-cn/buildbuddy-distributed-scheduling-for-faster-builds/) 来调度远程执行。

每个 executor 都维护一个待执行队列。任务到达队首后，executor 会尝试认领并执行。认领成功的任务会写入 invocation 数据库，从而出现在 UI 中。执行完成后，最终状态和统计数据等也会记入数据库。

![](/images/buildbuddy/action-merging-architecture-2a63b154d62d79c29bdc890b015bea56-1229d21ae20b.webp) *A BuildBuddy 架构和调度的简化概述。*

## 详情 {#details}

回到上面的示例，Alice 和 Bob 都执行相同的 Action（相同的 action ID！），但他们具有独立的执行（不同的执行 ID）。为了更快地获得结果，Bob 可以通过等待 Alice 的执行 ID 来重用 Alice 的 BigSlowTest。从最简单的角度来看，这就是 action merging 的工作原理，但问题在于细节。

接下来讨论边界情况。下文将 Alice 的执行称为“主”执行，将 Bob 的执行称为“合并”执行。

### 排队执行 {#queued-executions}

全部 action merging 数据都保存在 Redis 中。它们写入频繁，又不承担正确性的关键保证，因此放在 Redis 能减轻数据库负载。这些数据主要包含每个尚未完成的执行对应的 Action ID 与主 Execution ID 之间的双向映射。执行可能从调度器中消失，比如对应的 invocation 被取消，所以初始 TTL 设得较短，避免后续请求合并到已不存在的执行上。

executor 认领执行后，调度器会更新 Redis 中的 action merging 状态，标记任务已被认领，同时延长 TTL。只要 executor 正常运行，就会定期续期。主执行结束、action 结果写入缓存后，对应 action merging 状态会被删除。之后的 invocations 就可以直接读取已完成的 action 结果，无需再合并执行。

### 已取消 Invocations {#cancelled-invocations}

再考虑一种情况：Alice 的 presubmit 中有单元测试失败，她取消了整个 invocation，Bob 的 invocation 怎么办？我们为合并到同一次执行的 actions 维护引用计数，只有不存在等待中的 actions 时才取消该执行，从而保证其他请求仍能等到结果。不过，当前实现做了简化，并不会递减 action merging 的引用计数。要正确递减，就得跟踪全部合并执行的状态，而非只跟踪主执行。这种情况还不够常见，暂时不值得引入相应复杂度。因此，即使 Alice 和 Bob 都取消了各自的 invocations，主执行仍会跑完，哪怕已经无人等待。

### 执行停滞 {#stalled-executions}

在生产环境运行 action merging 几年后，我们偶尔会收到客户关于执行卡住的反馈。原来并非所有 Bazel rules 都是 hermetic 且可复现的，因此 actions 有时会遇到死锁、一直等待外部依赖，或因其他难以解释的原因卡住。如果其他请求合并到了一次卡住的执行上，这个 action 的所有后续 invocations 就都会被阻塞，直到该执行的运行时限到期，最坏可能持续几个小时。这可不行！

最初几次遇到这个问题时，我们会手动删除 Redis 中的 action merging 状态，让后续 invocations 继续运行。后来，我们为合并执行增加了 hedging 支持，自动解除后续 invocations 的阻塞。如果主执行跑得太久，或被合并的次数太多，就额外调度一次执行与它竞争，先将 action 结果写入 action cache 的一方完成这场竞争。不过，这还不能解决所有情况：已经合并到原主执行的在途 invocations 仍会卡住，只有额外执行结束后启动的 invocations 才能恢复。

![](/images/buildbuddy/action-merging-hedging-a99fcc590ed16508b5c085fc9e6131d6-dd23a95d39f5.webp) *对冲如何解锁合并以防止执行停滞。*

### 一个随规模扩大而暴露的 bug {#a-scaling-bug}

加入 hedging 时，我们也增加了 action merging 的监控指标。最理想的情况下，数百次 invocations 共用一次主执行，action merging 为某些 invocations 节省了数小时。可是随着时间推移，action merging 的效果反而变差了。最初我们以为是流量变化，深入排查后，Brandon 发现 action merging 使用的 Redis 客户端被错误配置为只在单个 Redis 分片上读写 action merging 状态，没有使用整个 Redis 集群。因此，Redis 集群越大，action merging 的有效性反而按比例下降。

好在这个问题[很容易修复](https://github.com/buildbuddy-io/buildbuddy/pull/10257)。

## 未来的改进 {#future-improvements}

前面提到过一些待改进之处，比如正确维护合并 invocations 的引用计数，让取消行为更准确。action merging 还有其他改进方向。首先，action merging 会放大 flaky test 的影响：主执行如果因为测试偶发失败而失败，合并进来的执行也会一起失败。我们希望利用已有的 flaky test 信息，更合理地合并 actions 并决定何时额外发起竞争执行。其次，希望额外执行的结果也能唤醒已经卡住的合并 actions，而不只服务于它结束后才提交的请求。最后，希望在 BuildBuddy UI 中展示更多 action merging 信息。

## 结论 {#conclusion}

Action merging 通过合并同一个 action 尚未完成的重复执行，节省时间和资源。和许多分布式系统一样，要正确处理各种边界情况并不容易。希望本文解释清楚了这项功能的作用和实现。想进一步了解，可以看看[Christian Scott 在 Bazelcon 2024 的演讲](https://www.youtube.com/watch?v=zZB_Q-BKJ04&list=PLbzoR-pLrL6ptKfAQNZ5RS4HMdmeilBcw&index=6)，以及[Sushain Cherivirala 关于 remote caching 与执行优化的文章](https://stripe.com/blog/fast-secure-builds-choose-two)，也欢迎通过 [Slack](https://buildbuddy.slack.com/) 或[邮件](mailto:hello@buildbuddy.io)联系我们。能读到这里并觉得这些问题有意思的话，[我们也在招聘](https://www.buildbuddy.io/careers)！

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
