---
layout: post
title: "[译] 理解 Bazel 的 Remote Caching 与 Remote Execution"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-bazels-remote-caching-and-remote-execution-explained"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Brentley Jones"]
original_url: "https://www.buildbuddy.io/blog/bazels-remote-caching-and-remote-execution-explained"
original_title: "Bazel's Remote Caching and Remote Execution Explained"
original_date: 2022-03-16T12:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Bazel's Remote Caching and Remote Execution Explained](https://www.buildbuddy.io/blog/bazels-remote-caching-and-remote-execution-explained)<br>
作者：Brentley Jones · 原文发表于 2022-03-16。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

> 译注：本文的 flag 名称和默认行为对应写作时的 Bazel 5.0；相关文档与代码链接也指向该版本。文中保留这些历史名称，以便与原文的执行流程和脚注对应。

Bazel 著名的 remote caching 和 remote execution 功能可以改变游戏规则，但如果您不熟悉它们的工作原理，它们可能会有点神秘。

别担心。我会从基础讲起，介绍 remote caching 和 remote execution，再深入到具体细节，也就是 actions 和 spawns 😄，带你了解 Bazel 的远程能力。

## Actions {#actions}

对于一次请求的 构建，[构建 graph](https://docs.bazel.build/versions/5.0.0/glossary.html#build-graph) 中的每个 [rule target](https://docs.bazel.build/versions/5.0.0/glossary.html#rule)，都会在 [analysis phase](https://docs.bazel.build/versions/5.0.0/glossary.html#analysis-phase) 生成零个或多个 [actions](https://docs.bazel.build/versions/5.0.0/glossary.html#action)。这些 actions 组成 [action graph](https://docs.bazel.build/versions/5.0.0/glossary.html#action-graph)，表示 [execution phase](https://docs.bazel.build/versions/5.0.0/glossary.html#execution-phase) 期间需要执行的全部 actions。

![](/images/buildbuddy/action-graph-baae4ebd49d1df74b6f39951baa33250-37424f94fecc.svg)

示例 action graph。 Actions 按创建它们的 targets 进行分组。箭头连接 actions，显示它们之间的依赖关系。

在 execution phase，Bazel 会遍历 action graph，逐个判断 action 是否需要执行。如果 output base 的 [action cache](https://docs.bazel.build/versions/5.0.0/glossary.html#action-cache) 中没有对应的 [action 结果](https://github.com/bazelbuild/bazel/blob/5.0.0/src/main/java/com/google/devtools/build/lib/actions/ActionResult.java#L26-L28)，或者 [output base](https://docs.bazel.build/versions/5.0.0/glossary.html#output-base) 中的输出与 action 结果记录的输出不一致，就需要执行。

## Spawns {#spawns}

如果 Bazel 需要执行一个 action，就会创建一个 [spawn](https://github.com/bazelbuild/bazel/blob/5.0.0/src/main/java/com/google/devtools/build/lib/actions/Spawn.java#L25-L30)，其中包含执行该 action 所需的全部信息，包括 spawn 的 [strategy](https://github.com/bazelbuild/bazel/blob/5.0.0/src/main/java/com/google/devtools/build/lib/actions/SpawnStrategy.java#L18-L28)<a id="user-content-fnref-1-7879ad"></a>[1](#user-content-fn-1-7879ad)。strategy 会决定多种行为，例如 spawn 是否使用 remote caching 或 remote execution，以及具体如何使用。

spawn 的 strategy 会决定，Bazel 是否需要在本地执行 action 之前、之后或代替本地执行时做额外的工作。例如，执行采用 `remote-cache` strategy 的 spawn 时，Bazel 可能先检查外部缓存的 action cache 中是否已有 action 结果。如果有，就可能直接下载列出的输出，而不执行 action。我会在 [后文](#remote-caching) 详细说明。

无论输出是下载的还是在本地生成的，一个 action 的输出一旦在 output base 中就绪，action graph 中依赖它的 actions 就可以启动。

### 并行性 {#parallelism}

<a id="local_cpu_resources-flag"></a>

本地能够同时执行的 actions 数量由 [`--local_cpu_resources`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--local_cpu_resources) flag 限制，能够同时执行的 spawn 数量则由 [`--jobs`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--jobs) flag 限制。spawn 的执行相比 action 的本地执行，可能包含更多或不同的工作，因此把 `--jobs` 设得比 `--local_cpu_resources` 更大可能有益。这种情况下，spawn 尝试在本地执行 action 时，可能会阻塞，等待 CPU 资源释放。这时 [remote execution](#remote-execution) 就能发挥作用。

## Remote caching {#remote-caching}

Bazel 所说的 [remote cache](https://docs.bazel.build/versions/5.0.0/remote-caching.html)，可能指机器本地的 disk cache，也可能指通过网络协议访问、通常不在本机上的 remote cache。为避免混淆，本文把这两类缓存统称为 external cache，因为它们都位于 output base 之外。

使用外部缓存，Bazel 会使用外部缓存的 action cache (AC) 和 content-addressable storage (CAS) 来增强其 output base。这意味着如果 Bazel 想要执行的 action 的 action 结果不在 output base 的 action cache 中，则 Bazel 可以检查 AC 是否有它。 action 的输出也是如此；如果 output base 没有预期的输出，则 Bazel 可以检查 CAS 是否有预期的输出。

### `remote-cache` {#remote-cache}

Bazel 通过 `remote-cache` spawn strategy 实现这种行为，并同时使用一种本地 strategy，例如 `sandbox`、`worker` 或 `local` 等。

一个采用 `remote-cache` strategy 的 spawn 包含以下步骤：

-   如果action的action结果不在output base的action cache中，尝试从AC检索它([`ActionCache.GetActionResult`](https://github.com/bazelbuild/remote-apis/blob/3e816456ee28f01ab2e0abf72306c1f340c7b229/build/bazel/remote/execution/v2/remote_execution.proto#L145-L159))<a id="user-content-fnref-2-7879ad"></a>[2](#user-content-fn-2-7879ad)
-   如果从任一缓存检索到 action 结果...
    -   并且 action 的输出已经位于 output base 中，spawn 就完成了
    -   否则，尝试从 CAS ([`ByteStream.Read`](https://github.com/googleapis/googleapis/blob/885183fcec1a9b3a812055c209fa61f391c9042c/google/bytestream/bytestream.proto#L50-L53)) 检索它
-   如果成功取得输出，spawn 就完成了
-   否则，action在本地执行
-   如果 action 成功完成，则 action 的输出将上传至 CAS ([`ByteStream.Write`](https://github.com/googleapis/googleapis/blob/885183fcec1a9b3a812055c209fa61f391c9042c/google/bytestream/bytestream.proto#L55-L77))，其 action 结果将上传至 AC ([`ActionCache.UpdateActionResult`](https://github.com/bazelbuild/remote-apis/blob/3e816456ee28f01ab2e0abf72306c1f340c7b229/build/bazel/remote/execution/v2/remote_execution.proto#L161-L182))<a id="user-content-fnref-3-7879ad"></a>[3](#user-content-fn-3-7879ad)
    -   如果使用了 [`--experimental_remote_cache_async`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--experimental_remote_cache_async)<a id="user-content-fnref-4-7879ad"></a>[4](#user-content-fn-4-7879ad)，spawn 就完成了；上传继续在后台进行，依赖它的 actions 可以启动
    -   否则，必须先完成上传，依赖它的 actions 才能启动

### Flags {#flags}

<a id="disk_cache-flag"></a> <a id="remote_cache-flag"></a>

设置 [`--disk_cache`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--disk_cache) 标志会导致 Bazel 使用文件系统上的该目录作为外部缓存。设置 [`--remote_cache`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_cache) 标志会导致 Bazel 通过 HTTP(S)、gRPC(S) 或 UNIX 套接字连接到外部缓存。设置这两个标志会导致 Bazel 同时使用 disk cache 和 remote cache，形成“组合缓存”。

combined cache 同时读写 disk cache 和 remote cache，整体按 remote cache 对待，除非设置 [`--incompatible_remote_results_ignore_disk`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--incompatible_remote_results_ignore_disk) flag。设置后，disk cache 仍按 local cache 的方式工作：即使设置了 [`--noremote_accept_cached`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_accept_cached)，它也可以返回结果；即使设置了 [`--noremote_upload_local_results`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_upload_local_results)，它也可以保存结果；带有 [`no-remote-cache`/`no-remote`](https://docs.bazel.build/versions/5.0.0/be/common-definitions.html#common.tags) 标记的 actions 也可以读写其中的结果。<a id="user-content-fnref-5-7879ad"></a> [5](#user-content-fn-5-7879ad)

<a id="experimental_guard_against_concurrent_changes-flag"></a>

设置 [`--experimental_guard_against_concurrent_changes`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--experimental_guard_against_concurrent_changes) 标志有助于保护外部缓存免受 构建 期间发生的输入文件更改的破坏。如果开发人员启用了外部缓存，我强烈建议设置此标志，即使它只是 disk cache。

<a id="remote_instance_name-flag"></a>

大多数 remote cache 实现会根据 [`--remote_instance_name`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_instance_name) flag 的值隔离 AC，有些也会隔离 CAS。这样做可以区分项目，也可以临时缓解非 hermetic toolchains 带来的问题。

<a id="remote_cache_header-flag"></a>

[`--remote_cache_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_cache_header) 标志导致 Bazel 将请求中的额外标头发送到外部缓存。通过多次指定标志可以传递多个标头。相同名称的多个值将转换为逗号分隔的列表。可以使用 [`--remote_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_header) 标志来代替将 `--remote_cache_header` 和 `--remote_exec_header` 设置为相同的值。

## Remote execution {#remote-execution}

Bazel 可以通过 [remote execution](https://docs.bazel.build/versions/5.0.0/remote-execution.html)，在远程 executor 上执行 actions。由于这些 actions 不消耗本地资源，可远程并行执行的 actions 数量只受 `--jobs` 和可用远程资源限制，不受 `--local_cpu_resources` 限制。如果构建有足够的并行度，就可能更快完成。[并行性一节](#parallelism)有更详细的说明。

### `remote` {#remote}

Bazel 通过 `remote` spawn strategy 实现远程执行 actions。它包含 [`remote-cache`](#remote-cache) strategy 的大部分行为，并且会代替本地 strategy，例如 `sandbox`、`worker` 或 `local` 等。

一个采用 `remote` strategy 的 spawn 包含以下步骤：

-   如果action的action结果不在output base的action cache中，尝试从AC检索它([`ActionCache.GetActionResult`](https://github.com/bazelbuild/remote-apis/blob/3e816456ee28f01ab2e0abf72306c1f340c7b229/build/bazel/remote/execution/v2/remote_execution.proto#L145-L159))<a id="user-content-fnref-6-7879ad"></a>[6](#user-content-fn-6-7879ad)
-   如果从任一缓存检索到 action 结果...
    -   并且 action 的输出已经位于 output base 中，spawn 就完成了
    -   否则，尝试从 CAS ([`ByteStream.Read`](https://github.com/googleapis/googleapis/blob/885183fcec1a9b3a812055c209fa61f391c9042c/google/bytestream/bytestream.proto#L50-L53)) 检索它
-   如果成功取得输出，spawn 就完成了
-   否则，确定是否需要上传 action 的任何输入（[`ContentAddressableStorage.FindMissingBlobs`](https://github.com/bazelbuild/remote-apis/blob/3e816456ee28f01ab2e0abf72306c1f340c7b229/build/bazel/remote/execution/v2/remote_execution.proto#L318-L329)），然后上传它们（[`ByteStream.Write`](https://github.com/googleapis/googleapis/blob/885183fcec1a9b3a812055c209fa61f391c9042c/google/bytestream/bytestream.proto#L55-L77)）
-   然后远程执行action（[`Execution.Execute`](https://github.com/bazelbuild/remote-apis/blob/3e816456ee28f01ab2e0abf72306c1f340c7b229/build/bazel/remote/execution/v2/remote_execution.proto#L45-L115)）
-   如果 action 成功完成，请从 CAS 下载 action 的输出 ([`ByteStream.Read`](https://github.com/googleapis/googleapis/blob/885183fcec1a9b3a812055c209fa61f391c9042c/google/bytestream/bytestream.proto#L50-L53))

### Disk cache {#disk-cache}

[从 Bazel 5.0](https://github.com/bazelbuild/bazel/commit/cf57d036c2e1b608ca902267fbbdfeb7ee5aa166) 开始，disk cache（或更具体地说，组合缓存）可与 remote execution 一起使用。在 Bazel 5.0 之前，如果您还想在本地缓存内容，则必须设置 remote cache 代理 sidecar。

### Dynamic execution {#dynamic-execution}

Bazel 支持 remote execution 的一种模式，称为 ["dynamic execution"](https://docs.bazel.build/versions/5.0.0/dynamic-execution.html)，其中同一 action 的本地和 remote execution 并行启动，使用第一个完成的分支的输出，并取消另一个分支。

为了完整起见，我想提及它，因为如果调整得当，它可以比单独使用本地执行或 remote execution 更快地构建。但是，它可能无法与 [Remote Build without the Bytes](#remote-build-without-the-bytes) 配合良好，因为本地执行分支可能需要下载先前远程完成的 actions 的输出，如果调整不当，可能会导致构建速度变慢。

### Flags {#flags-1}

#### `--remote_executor` {#remote_executor-flag}

设置 [`--remote_executor`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_executor) 标志会导致 Bazel 通过 gRPC(S) 或 UNIX 套接字连接到远程 executor。如果未设置 `--remote_cache`，则默认为为 `--remote_executor` 设置的值。大多数 remote execution 设置将在同一端点具有 remote cache 和远程 executor。

[`--remote_instance_name`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_instance_name) flag 除了[影响 remote cache](#flags)，还可能决定 构建 使用哪个 remote execution 集群。有些 actions 可能需要特定硬件或软件，因此要把 target 指向 executors 的特定子集，这可以通过[平台属性](https://docs.bazel.build/versions/5.0.0/platforms-intro.html#common-platform-properties)实现。

#### `--remote_default_exec_properties` {#remote_default_exec_properties-flag}

平台属性可以用 [`--remote_default_exec_properties`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_default_exec_properties) flag 全局设置，但前提是尚未在 [platform](https://docs.bazel.build/versions/5.0.0/be/platform.html#platform.exec_properties) 或 [target](https://docs.bazel.build/versions/5.0.0/be/common-definitions.html#common.exec_properties) 层面设置。action cache 中保存的 action 结果包含平台属性，因此这些属性会影响 action cache 的命中率。如果只在某些条件下启用 remote execution，又需要设置平台属性，可以考虑始终设置相同属性，以便复用缓存的 action 结果。有些 remote execution 实现允许通过 [`--remote_exec_header`](#remote_exec_header-flag) flag 设置全局平台属性，避免这类 cache misses。

#### `--remote_timeout` {#remote_timeout-flag}

[`--remote_timeout`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_timeout) flag 控制 Bazel 等待 remote cache 操作完成的时间。这个超时不适用于 `Execution.Execute` 调用<a id="user-content-fnref-7-7879ad"></a> [7](#user-content-fn-7-7879ad)，但 remote execution 可能需要上传或下载本地 构建 无需传输的 artifacts，因此默认的 60 秒可能不够。

#### `--remote_retries` {#remote_retries-flag}

[`--remote_retries`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_retries) 标志控制 Bazel 在发生瞬时错误（例如超时）时重试远程操作的次数。该标志默认为 `5`，并且根据您计划如何使用 remote execution，您可能希望将其增加到更大的值。 Bazel 使用指数退避进行重试，但目前将调用之间的延迟限制为 5 秒。

#### `--remote_exec_header` {#remote_exec_header-flag}

[`--remote_exec_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_exec_header) 标志导致 Bazel 将请求中的额外标头发送到远程 executor。通过多次指定标志可以传递多个标头。相同名称的多个值将转换为逗号分隔的列表。可以使用 [`--remote_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_header) 标志来代替将 `--remote_cache_header` 和 `--remote_exec_header` 设置为相同的值。

## 远程 Build without the Bytes {#remote-build-without-the-bytes}

Bazel 对 remote caching 和 remote execution 都支持 [Remote Build without the Bytes](https://github.com/bazelbuild/bazel/issues/6862)（BwtB）。启用后，Bazel 只下载指定 targets 的直接输出（[`--remote_download_toplevel`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_download_toplevel)），或完成 构建 所必需的最少输出（[`--remote_download_minimal`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_download_minimal)）。这样能大幅减少网络流量，也可能加快构建。

这个功能也有局限。按本文写作时的实现，BwtB 要求 remote cache [永不淘汰输出](https://github.com/bazelbuild/bazel/issues/8250)。下载集中到某个阶段可能拖慢构建。它也不支持指定下载其他输出，等等。和 [dynamic execution](#dynamic-execution) 类似，BwtB 在使用得当时可以加快构建，但不能盲目启用。

## 补充话题：Build Event Service {#bonus-topic-build-event-service}

Bazel 可以将 构建 结果（特别是 [build event protocol](https://docs.bazel.build/versions/5.0.0/build-event-protocol.html) (BEP)）传输到[build event service](https://docs.bazel.build/versions/5.0.0/build-event-protocol.html#build-event-service) (BES)。根据服务的功能，这可以带来很多好处。

以下列出了各种 BES 产品（包括 BuildBuddy！）提供的一些优势：

-   轻松分享构建日志
-   查看历史 构建 数据，包括聚合和趋势
-   查看终端未展示的细节，例如无需使用 [`--announce_rc`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--announce_rc)，就能查看所用的全部命令行 flag，以及设置的全部环境变量。
-   查看action时序数据（同[`--experimental_generate_json_trace_profile`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--experimental_generate_json_trace_profile)）
-   可视化查询
-   查看错误和测试日志
-   下载 action 输出
-   查看 remote cache 统计数据
-   查看remote execution相关数据
    -   actions 已执行列表
    -   各个 action 详细信息（例如命令行参数、环境变量、平台属性、计时数据以及下载输入和输出）

### Flags {#flags-2}

<a id="bes_backend-flag"></a>

设置 [`--bes_backend`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--bes_backend) 标志会导致 Bazel 通过 gRPC(S) 连接到 BES 后端并将 构建 结果流式传输到它。设置 [`--bes_results_url`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--bes_results_url) 标志会导致 Bazel 将正在进行的 构建 的 BES UI 的 URL 输出到终端。

使用 BES，Bazel 将上传BEP中引用的所有文件，除非[`--experimental_build_event_upload_strategy=local`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--experimental_build_event_upload_strategy)<a id="user-content-fnref-8-7879ad"></a>[8](#user-content-fn-8-7879ad) 已设置。或者，如果您设置 [`--incompatible_remote_build_event_upload_respect_no_cache`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--incompatible_remote_build_event_upload_respect_no_cache)<a id="user-content-fnref-9-7879ad"></a>[9](#user-content-fn-9-7879ad)，并且 actions 标记为[`no-cache`/`no-remote-cache-upload`/`no-remote-cache`/`no-remote`](https://docs.bazel.build/versions/5.0.0/be/common-definitions.html#common.tags)，那么这些 actions 的输出仍将被排除在上传之外。

<a id="bes_timeout-flag"></a>

[`--bes_timeout`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--bes_timeout) flag 控制 构建 和测试结束后，Bazel 等待 BES 上传完成的时间。默认没有超时，这可能不符合你的需求。如果保留默认值，可以考虑调整 [`--bes_upload_mode`](https://github.com/bazelbuild/bazel/blob/5.0.0/src/main/java/com/google/devtools/build/lib/buildeventservice/BuildEventServiceOptions.java#L145-L154) flag：它控制 Bazel 是否等待 BES 上传完成才结束 构建（默认行为），或让上传在后台继续。

<a id="bes_header-flag"></a>

[`--bes_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--bes_header)<a id="user-content-fnref-10-7879ad"></a> [10](#user-content-fn-10-7879ad) flag 让 Bazel 在发送到 BES 后端的请求中附加额外 header。其行为与 [`--remote_header`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_header) 相同。

## 就这样吧，现在 {#thats-it-for-now}

希望有了这些信息，Bazel 的 remote caching 和 remote execution 功能就不那么神秘了。

## 脚注 {#footnote-label}

1.  <a id="user-content-fn-1-7879ad"></a>

    Julio 写了一篇很好的 [spawn strategy 概述](https://jmmv.dev/2019/12/bazel-strategies.html)，强烈建议阅读。[↩](#user-content-fnref-1-7879ad)

2.  <a id="user-content-fn-2-7879ad"></a>

    除非设置了 [`--noremote_accept_cached`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_accept_cached)。请参阅 [标志部分](#flags) 。 [↩](#user-content-fnref-2-7879ad)

3.  <a id="user-content-fn-3-7879ad"></a>

    除非 action 标记为 `no-remote-cache-upload`，或者可能设置了 [`--noremote_upload_local_results`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_upload_local_results)。请参阅 [标志部分](#flags) 。 [↩](#user-content-fnref-3-7879ad)

4.  <a id="user-content-fn-4-7879ad"></a>

    适用于 [Bazel 5.0](https://github.com/bazelbuild/bazel/commit/7f08b7841fcf4c7d7d09b69f9ec1f24969aba8a1)。 [↩](#user-content-fnref-4-7879ad)

5.  <a id="user-content-fn-5-7879ad"></a>

    适用于 [Bazel 5.0](https://github.com/bazelbuild/bazel/commit/46c3f1711b90c648baf3d15d6df2890c8a12f67c)。 [↩](#user-content-fnref-5-7879ad)

6.  <a id="user-content-fn-6-7879ad"></a>

    除非设置了 [`--noremote_accept_cached`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--remote_accept_cached)。 [↩](#user-content-fnref-6-7879ad)

7.  <a id="user-content-fn-7-7879ad"></a>

    如果设置 [`--experimental_remote_execution_keepalive`](https://docs.bazel.build/versions/5.0.0/command-line-reference.html#flag--experimental_remote_execution_keepalive) flag，`Execution.Execute` 和 `Execution.WaitExecute` 调用会以[更复杂的方式](https://docs.google.com/document/d/1NgDPsCIwprDdqC1zj0qQrh5KGK2hQTSTux1DAvi4rSc)考虑 `--remote_timeout` 和 `--remote_retries` 的值。即使设置了这个 flag，目标仍是不限制执行时间，因为不同 action 所需的执行时间可能相差很大。[↩](#user-content-fnref-7-7879ad)

8.  <a id="user-content-fn-8-7879ad"></a>

    但警告：设置 `--experimental_build_event_upload_strategy=local` 将阻止上传一些好东西，例如计时配置文件或测试日志。 [↩](#user-content-fnref-8-7879ad)

9.  <a id="user-content-fn-9-7879ad"></a>

    适用于 [Bazel 5.0](https://github.com/bazelbuild/bazel/commit/bfc24139d93f8643686d91596ba347df2e01966a)。 [↩](#user-content-fnref-9-7879ad)

10.  <a id="user-content-fn-10-7879ad"></a>

     适用于 [Bazel 5.0](https://github.com/bazelbuild/bazel/commit/ef42d1365d0f508d3d817997b5049639a72100ab)。 [↩](#user-content-fnref-10-7879ad)

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
