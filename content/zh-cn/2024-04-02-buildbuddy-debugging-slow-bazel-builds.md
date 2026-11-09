---
layout: post
title: "[译] 我的 Bazel 构建为什么这么慢？"
Description: "从构建 flags、analysis cache、JVM 内存、action cache 和构建趋势入手，结合 timing profile 排查 Bazel 构建变慢的原因。"
date: 2026-11-09T09:30:12+08:00
publishDate: 2026-11-09T09:30:12+08:00
draft: false
slug: "buildbuddy-debugging-slow-bazel-builds"
tags: [Bazel, BuildBuddy, 翻译, 构建优化]
categories: ["软件工程"]
author: ["Maggie Lou"]
original_url: "https://www.buildbuddy.io/blog/debugging-slow-bazel-builds"
original_title: "Why is my Bazel build so slow?"
original_date: 2024-04-02T12:00:00.000Z
translation_engine: "Google Translate 初译，逐句校译并复核技术说明"
translation_status: "已完成译义、术语、代码与发布检查"
---

原文：[Why is my Bazel build so slow?](https://www.buildbuddy.io/blog/debugging-slow-bazel-builds)<br>
作者：Maggie Lou · 原文署名日期为 2024-04-02。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队。所译网页已包含 Bazel 8.7、9.1 等后续版本的补充说明，使用 flags 时请核对自己的 Bazel 版本。Bazel 专有名词、命令和代码保持英文；原文几处参数及缓存行为说明的修正见脚注。

Bazel 承诺的是快速构建。可构建还是很慢，该怎么办？去骂当初说服公司迁移到 Bazel 的开发者吗？当然不会！你肯定不会这么做，对吧？🙂

BuildBuddy 可以帮忙。Bazel 提供了大量排查构建耗时的信息，难的是知道该从哪里看起。

也许你连续运行了两次构建，本以为第二次会命中缓存，结果却依然很慢。也许你只运行了一次构建，想弄清时间究竟花在哪里。下面介绍几个排查起点，并结合我们自己的慢构建案例说明。

本文会多次用到 BuildBuddy UI。即使不用它，大部分步骤也能完成，只是需要自己从 Build Event Stream 中查找、解析信息，工作量会大一些。如果你还没有使用 BuildBuddy，可以给构建添加以下 flags，将 Build Events 免费发送到我们的服务器。完整设置步骤见[文档](https://www.buildbuddy.io/docs/cloud)。

`--bes_results_url=https://app.buildbuddy.io/invocation/`

`--bes_backend=grpcs://remote.buildbuddy.io`

添加后，构建日志中会出现类似 `Streaming build results to: https://app.buildbuddy.io/invocation/XXX` 的一行。打开这个链接，就能使用下文介绍的许多功能。

## 1）我使用了正确的 flags 吗？ {#1-am-i-using-the-right-set-of-flags}

⭐ Bazel 的配置选项很多，排查时可以先确认本次构建究竟应用了哪些 flags。下面这些 flags 值得检查：它们可能需要添加，也可能已经设置好了。

- `--nolegacy_important_outputs`
  - 去掉重复的文件引用，减少上传的 Build Event Stream 数据量。
- `--remote_build_event_upload=minimal`
  - 原文将它概括为不向缓存上传标记为 no-cache 的 blob，从而减少网络流量。具体的 BEP 上传范围见译注。[^bep-upload]
- `--remote_download_outputs`
  - 限制从缓存下载中间构建 artifacts，减少网络流量。这个 flag 需要指定取值，并非只写名称就会生效。[^download-outputs]
- `--experimental_remote_cache_async`
  - 在后台进行缓存 I/O，改善 remote cache 性能。
- `--noremote_upload_local_results`
  - 不向 remote cache 上传本地执行的 action 输出，减少上传量。这会降低后续构建的 cache hit rate；但上传速度受限时，例如网络连接较差，可能值得这样取舍。
- `--remote_cache_compression`
  - 压缩缓存中的 blob，提高 remote cache 吞吐量。
- `--experimental_remote_cache_chunking`
  - remote cache 支持该功能时，以 content-defined chunks 上传、下载大型输出，提高吞吐量。该功能适用于 Bazel 8.7 和 9.1+。
- `--digest_function=BLAKE3`
  - 使用更快的哈希算法，改善大文件的 digest 计算性能。该功能适用于 Bazel 6.4+。
- `--jobs`
  - 允许更多 actions 并行执行，提高执行吞吐量。我们建议从 `--jobs=50` 开始，再逐步调高。

如果希望每次构建都默认使用这些 flags，可以把它们写进 [.bazelrc 文件](https://bazel.build/run/bazelrc)。我们会把 .bazelrc 提交到 Git，让所有开发者使用统一的构建选项。

.bazelrc

```txt
# Example of a .bazelrc that will configure every Bazel build to use these flags
common --nolegacy_important_outputs
common --remote_build_event_upload=minimal
...
```

⭐ UI 顶部的详情适合做初步核对。比较两次构建时，我通常先检查两个 invocation 页面顶部的信息，确认它们是否一致。

有一次，我排查慢构建时发现自己忘了设置 `--remote_download_minimal`。那次构建从缓存下载的 artifacts 比平时多得多，性能下降的原因也就找到了。

![](/images/buildbuddy/ui-details-23e03042b75ac3bcb4128e5ae519ebaa-1722ce3e0b96.webp)

*上方的 invocation 没有启用 `--remote_download_minimal`，这可能影响构建性能。*

## 2）构建使用的是 warm Bazel 实例吗？ {#2-did-my-build-use-a-warm-bazel-instance}

要进一步了解构建过程，可以查看 timing profile。它记录了这次 invocation 中 Bazel 各项工作的耗时。

![](/images/buildbuddy/timing-profile-overview-22e1e5bb054546da7262b9f47bc3d813-5ae88ac79bf3.webp)

⭐ 信息很多，可以先看 [analysis phase](https://bazel.build/reference/glossary#analysis-phase)。构建慢，常常是因为使用了 cold Bazel 实例。

第一次运行 Bazel 构建时，Bazel 会启动本地 server，完成初始化、加载依赖，并构建项目的 dependency graph。项目较大时，这些工作可能需要几分钟。

只要这个本地 server 没有被终止，后续构建就能复用它，也能复用第一次构建中完成的大量计算，因此会快得多。

timing profile 中有一些名为 `skyframe evaluator 0`、`skyframe evaluator execution-0` 的区域。`evaluator` 表示评估 build graph、确定待执行任务所花的时间；`evaluator execution` 则表示实际执行 actions 的耗时。原文把这些执行区域的总数与 `--jobs` 联系起来；排查 analysis 并发时，还需要区分加载、分析与执行各自的线程设置。[^analysis-threads]

要看 analysis phase 的时间花在哪里，应重点检查 `evaluator` 区域。你可能需要滚动到 timing profile 底部才能找到它们。

![](/images/buildbuddy/timing-profile-analysis-a56328301c6d0d880670194306773a55-dd94b418be15.webp)

在这个示例中，analysis phase 消耗了大量时间和计算资源。把鼠标悬停在具体事件上，可以看到更多信息。

![](/images/buildbuddy/timing-profile-npm-8278d776510d4d912854c171479f9bc5-0cf719be27bf.webp)

例如，npm 安装相关的 actions 花了不少时间。

![](/images/buildbuddy/timing-profile-gazelle-68b431bf546fbbbd392487c07b147804-6eece6f2309e.webp)

设置 gazelle 相关的 actions 也有很多。

你还可能看到 `package creation`，原文用它指代拉取 WORKSPACE 文件中声明的外部依赖；或者看到 `MerkleTree.build`。原文把后者概括为构建依赖图，严格来说，它涉及 action 输入的 Merkle tree，不能直接等同于项目的 dependency graph。[^merkle-tree]

这类初始化工作越多，就越有可能说明本次构建没有复用 warm Bazel 实例，在 analysis phase 上花了大量时间。可以从下面几个问题继续查：

- 这台机器上的 analysis cache 初始化过吗？
  - 即使使用 remote cache 和 remote execution，analysis phase 仍在发起构建的机器上运行。也就是说，从笔记本电脑发起构建，analysis phase 就在笔记本电脑上完成，与 remote execution 在哪里运行无关。你以前在这台机器上构建过这个 repository 吗？
- 机器上的内存状态丢失了吗？
  - analysis cache 完全保存在 Bazel server 进程的内存中。内存状态一旦丢失，缓存也就丢失了。例如，机器重启，或者你运行 `bazel clean` 主动使 analysis cache 失效。
- Bazel 是否因为配置变化而丢弃了 analysis cache？
  - 为保证正确性，构建选项或配置变化可能让 Bazel 丢弃 analysis cache。发生这种情况时，日志中会出现类似 `WARNING: Build option --compilation_mode has changed, discarding analysis cache` 的提示。
  - 例如，前几次构建使用 `--compilation_mode fastbuild`，后来改为 `--compilation_mode opt`，后一次构建就可能变慢：server 丢弃了 analysis cache，需要重新完成 analysis phase。

在 CI 中使用 Bazel 时，要在远程 CI runners 的多次运行之间保存 analysis cache，并不容易。我们的 CI 产品 [BuildBuddy Workflows](https://www.buildbuddy.io/blog/meet-buildbuddy-workflows) 通过克隆 CI runners 保留 analysis cache，避免丢失内存状态。更多实现细节可以看我们的 [BazelCon 演讲](https://www.youtube.com/watch?v=YycEXBlv7ZA&list=PLxNYxgaZ8Rsefrwb_ySGRi_bvQejpO_Tj&index=10)。

⭐ 如果耗时主要来自获取外部依赖，可以检查 [repository cache](https://sluongng.hashnode.dev/bazel-caching-explained-pt-3-repository-cache)。执行 clean build 时，Bazel 会获取 WORKSPACE 中引用的外部依赖，把下载的 blob 保存到 repository cache。两次构建之间依赖没有变化，就不必重新下载。

repository cache 默认启用，可以通过 `--repository_cache` 指定位置。原文称它不会被 `bazel clean` 清除，但会被 `bazel clean --expunge` 清除；后半句不适用于默认的 repository cache 路径，具体范围见译注。[^repository-cache]

⭐ 还可以检查有多少线程在进行 analysis 和依赖获取。分配更多 CPU、提高并行度，可能改善性能。

上面的截图中，只有两个线程在进行 analysis。Bazel 会根据机器的可用 CPU 核心数选择默认并发设置。原文建议手动调整 `--jobs`；它控制并发 jobs，而 loading/analysis 的线程数应另查 `--loading_phase_threads`。[^analysis-threads]

## 3）Bazel 有足够的内存吗？ {#3-does-bazel-have-enough-memory}

Bazel 对内存的需求很大。这一节很短，讨论的却是我们在客户环境中经常遇到的问题。

⭐ 内存不足时，Bazel 会淘汰一部分 analysis cache，拖慢后续构建。即使复用了 warm Bazel 实例，如果 timing profile 中仍有大量 `MerkleTree.build` 事件，或出现频繁的垃圾回收，可以考虑通过 `--host_jvm_args` 增大 JVM heap，让 Bazel 使用更多 RAM。例如，`--host_jvm_args=-Xmx6g` 会把 JVM heap 上限设为 6 GB。

`--host_jvm_args` 是 startup option，要放在 Bazel command 之前；`--jobs` 等非 startup option 则放在 command 之后。例如：`bazel --host_jvm_args=-Xmx6g build --jobs=50`。原文此处把参数名写成了 `--host_jvm`，这里已更正。[^startup-option]

![](/images/buildbuddy/debugging-slow-gc-c28764ea0231.webp) *这次构建的 timing profile 显示了大量垃圾回收活动。调大后续构建的 heap 上限后，内存压力减轻，构建耗时也缩短了。*

## 4）两次构建成功复用了缓存中的 artifacts 吗？ {#4-are-your-builds-successfully-sharing-cached-artifacts}

Bazel 的一大优势是缓存构建输出。例如，一次构建编译源代码后，会把编译得到的二进制文件存入缓存。后续构建可以直接从缓存下载这些文件，无需重新编译。

能否复用这些缓存，是发挥 Bazel 性能优势的重要条件。如果多次构建没有成功共享缓存中的 artifacts，就可能解释为什么构建总是很慢。

targets 在 execution phase 中构建。要仔细检查这个阶段，可以在 timing profile 中找到执行相关的线程，例如 `skyframe evaluator execution-X`。

![](/images/buildbuddy/timing-profile-execution-ef3c2480ad847593a75cadd075293ceb-a87290f37152.webp)

最上方一行显示运行了哪些 actions，例如 `Compiling absl/container/internal/raw_hash_set.cc`。

下方各行提供更细的任务分解。上图有多个 `download outputs` 区域，表明这次构建有不少 remote cache hits：Bazel 可以直接下载缓存中的输出，不必执行 action 来生成它们。

下面这个例子则有多个 `upload missing input` 和 `execute remotely` 事件，说明远端缺少需要的输入，必须先上传再执行。输入文件越大，这部分耗时就越值得注意。

![](/images/buildbuddy/timing-profile-execution-not-cached-3cabc6e4f01c98461ee8fd42a4425d2f-0c73b891fb28.webp)

如果第一次构建这个 target，需要把输入上传到 remote execution 环境再执行，并不奇怪。可如果已经构建过多次，本以为这个 target 会命中缓存，就值得继续查原因了。

⭐ 要了解 target 为什么没有命中缓存，可以查看 UI 中的 Cache 选项卡。

![](/images/buildbuddy/cache-tab-overview-a155a0ac6a3e036709a3659cde6d934d-d35a0c4ee192.webp)

页面顶部汇总了本次构建的信息。在这个例子中，构建上传、下载了约 30 GB 数据，还有大量 action cache misses，这些都可能解释构建为什么耗时较长。

Cache 选项卡底部的 `Cache requests` 表格，可以帮助排查具体某个 action 没有命中缓存的原因。比较两次构建时，如果想知道第一次构建的 action 为什么不能在第二次中复用，这个表格尤其有用。

先在第二次构建中，找一个原本预期会复用第一次结果的 action。可以在表格中过滤 `AC Misses`，再从结果中选一个。

![](/images/buildbuddy/cache-requests-table-d3c51d79d1422b95bc7e0bd7903f9107-1ac6a8bef09e.webp)

点击该行，会进入 `Action details` 页面。要在两次构建之间复用 action 的缓存结果，页面上的大部分信息都必须一致，包括输入、参数、环境变量和 platform properties。

![](/images/buildbuddy/action-details-1-31895b894a0c70d5c8be39c1bf665317-d9788b035650.webp) ![](/images/buildbuddy/action-details-2-878af44cae0ca34255e0ecfe555052bf-8382c3d05e42.webp)

例如，图中的两个 actions 有不同的 digest，因此不能复用结果。排查时，可以先确认输入是否相同。页面用颜色标记输入，方便比较；图中两次构建的输入确实一致，对应的 input root digest 也一样，符合预期。

这个例子中，digest 不同是由 platform properties 的差异造成的：两次 action 使用了不同的容器镜像。

遇到类似情况，可以检查两次构建的配置：

- .bazelrc 是否不同，导致应用了不同配置？
- 两次构建之间，BUILD 文件是否发生变化？

这些变化都可能让后续构建变慢。

关于如何用 cache requests 面板排查慢构建，还有更多例子可参考[这篇文章](https://www.buildbuddy.io/blog/bazel-remote-cache-debugging)。

## 5）项目中的变化能否解释构建耗时增长？ {#5-was-there-a-change-in-my-project-that-could-explain-increasing-build-times}

有些构建耗时增长，反映的是项目更深层的结构性问题。单改某个配置 flag 解决不了这些问题；代码结构本身不利于高效构建，换什么构建配置都难以奏效。

BuildBuddy 的 Trends 页面有助于发现构建耗时的长期变化。它包含每一次发送到 BuildBuddy 的构建数据，确实可以查询所有构建。例如，可以查看构建次数、耗时分位数和 cache hits 的图表。

![](/images/buildbuddy/trends-page-overview-630979191445645222957ce3405ac6cd-79aaac3d2454.webp)

图中 P99 构建耗时有一些尖峰，P90 也有类似情况。例如，从 8 月 30 日到 9 月 13 日的几周内，P99 耗时从约 20 分钟增加到了约 40 分钟。

⭐ `drilldown` 选项卡可以帮助查找慢构建的共同点。选中一组慢构建后，页面会显示它们有哪些共同维度。

![](/images/buildbuddy/trends-heatmap-f2c49b44b4a27757c1d1f632871030d8-181544bc8f84.webp)

上图中，我们选中了热力图右上方一组绿色的慢构建。`Drilldown dimensions` 用绿色显示选中构建的特征，用紫色显示未选中构建，也就是速度较快的那些构建的特征。

可以看到，两组构建在 `pattern` 这一项上的分布差异很大。

![](/images/buildbuddy/trends-drilldown-pattern-dde91f7dee62711351fa6846af128a88-98ecc9a0242e.webp)

慢构建中，75% 匹配 `Baremetal tests` 这个 pattern；基线中匹配它的构建却只有 13.8%。

点击 pattern 图中的绿色长条，drilldown 页面就会添加过滤条件，只显示这个 pattern。页面还会列出匹配的所有 invocations，便于逐个打开，寻找共同原因。

![](/images/buildbuddy/debugging-slow-drilldown-3187571112b6.webp)

点开其中几个 invocations 后，问题就清楚了：一个 flaky test 导致 CI workflows 多次重跑同一个 test target，明显拖慢了 CI。

如果你的构建也出现类似的整体变慢，可以继续追查根本原因。

- 某项改动让项目不再那么 hermetic 了吗？
  - action 中如果包含时间戳或其他随机值，例如构建 ID，就会降低 cache hit rate，增加执行耗时。
- 项目中有构建瓶颈吗？
  - 如果许多 targets 依赖一个经常修改的组件，这个组件每次变化都会让 build graph 中大量节点失效，迫使许多 targets 重新构建。如果你的 repository 也是如此，可以考虑重构这个核心组件，使其对外 API 更稳定。

关于 Drilldowns 选项卡的演示，可以观看我们的 [BazelCon 演讲](https://www.youtube.com/watch?v=37C5zvQHnZI)。

## 祝排查顺利！ {#happy-debugging}

熟悉 Bazel 的读者可能觉得这些步骤很基础，但我们希望它们能成为排查慢构建的起点。如果你需要帮助理解更复杂的问题，或者想反馈本文的内容，欢迎到我们的 Slack 频道联系，或发送邮件至 [hello@buildbuddy.io](mailto:hello@buildbuddy.io)。

[^bep-upload]: 译注：按 [Bazel 9.2 参数参考](https://bazel.build/versions/9.2.0/reference/command-line-reference)，minimal 会省去 BEP 引用的大部分本地输出上传，但保留 test logs、timing profile 等必要文件；不能只用 no-cache 标签概括它的行为。

[^download-outputs]: 译注：该参数取值为 all、minimal 或 toplevel。minimal 仍会下载本地 actions 必需的输出，toplevel 还下载顶层 targets 的输出。具体行为见 [Bazel 参数参考](https://bazel.build/versions/9.2.0/reference/command-line-reference)。

[^analysis-threads]: 译注：`--jobs` 限制并发 jobs；`--loading_phase_threads` 设置 loading/analysis phase 的并行线程数。查看 profile 时应区分不同阶段。参见 [Bazel 参数参考](https://bazel.build/versions/9.2.0/reference/command-line-reference)。

[^merkle-tree]: 译注：Bazel 文档将 Merkle tree 与 action 的 input root、input mappings 关联，参见 [Bazel 8.3 参数参考](https://bazel.build/versions/8.3.0/reference/command-line-reference)。这与项目的 dependency graph 不是同一个概念。

[^repository-cache]: 译注：`clean --expunge` 清除整个 output base；默认 repository cache 位于 output user root 下的 cache/repos/v1，通常在其范围之外。自定义路径放在 output base 内时另当别论。参见 [clean 的范围](https://bazel.build/versions/9.2.0/docs/user-manual#cleaning-build-outputs)及 [repository cache 配置](https://bazel.build/versions/9.2.0/reference/command-line-reference)。

[^startup-option]: 译注：正确的 startup option 名称是 `--host_jvm_args`，原文写作 `--host_jvm`。参见 [Bazel 用户手册](https://bazel.build/versions/9.2.0/docs/user-manual#host-jvm-argsstring)。

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
