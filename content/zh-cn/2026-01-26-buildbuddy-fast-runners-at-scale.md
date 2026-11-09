---
layout: post
title: "[译] Snapshot、Chunk、Clone：大规模部署快速 runner"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-fast-runners-at-scale"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Maggie Lou"]
original_url: "https://www.buildbuddy.io/blog/fast-runners-at-scale"
original_title: "Snapshot, Chunk, Clone: Fast Runners at Scale"
original_date: 2026-01-26T12:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Snapshot, Chunk, Clone: Fast Runners at Scale](https://www.buildbuddy.io/blog/fast-runners-at-scale)<br>
作者：Maggie Lou · 原文发表于 2026-01-26。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

在 BuildBuddy，我们的核心使命是加快构建速度。我们使用 Firecracker 快照来按需保持预热 workers 的可用性。

只需一个curl请求，您就可以在warm worker中运行任何bash命令。

## 背景 {#painting-the-scene}

想象一下，每天早上您都必须从头开始重新初始化笔记本电脑上的开发环境，重新安装工具并克隆 git 存储库。接着还得下载容器映像并启动各种应用程序。一想到这些时间和精力我就感到不寒而栗。

不仅设置会很慢，而且所有初始工作负载也会更慢。应用程序和内核必须重新填充各种内存和磁盘缓存，并下载工具和依赖项。

Cold start 是计算系统中常见的问题。GitHub Actions 等 CI 平台会为每次任务初始化新的 worker，AI 编程 agent 也通常运行在尚未预热的 cold runners 上。这样能让环境保持干净、一致，并与其他客户的任务隔离，但每次任务也往往需要多花几分钟。

借助可创建 snapshot 的 runners，只需承担一次初始化 cold worker 的耗时，后续任务就能直接克隆已经预热的 worker。

这些 workers 具有许多有价值的特性：

-   **灵活性**：每个worker都有自己的内核，提高安全性并支持需要Docker或自定义映像的复杂工作负载。
-   **写入时复制**：可以从共享基线克隆并行workers，同时在写入时复制更改，从而允许不同的工作负载运行而不会产生干扰。
-   **可扩展性**：能通过网络克隆，为我们提供可持续扩展的快速 runners 集群。
-   **持久性**：可以保存到磁盘，让 workers 在机器重启或自动伸缩后仍能恢复。
-   **高容量**：可以处理需要高达100GB磁盘和大量内存的大型工作负载，这对于单一存储库或运行ML模型等内存密集型任务通常是必需的。
-   **增量更新**：可以随着每个工作负载进行增量更新，从而减少环境偏差，甚至在数周的开发过程中也是如此。
-   **内存持久性**：可以跨工作负载保留内存中状态，允许重复使用昂贵的初始化工作（例如Bazel的分析图和JVM堆状态）。

在我们的代码库中，一次完全命中缓存的 Bazel 构建 大约需要 6 分钟。在 GitHub Actions 上，初始化 worker 就要花 3.5 分钟，包括安装工具、对 GitHub repository 做 sparse checkout，以及在 构建 开始前生成 Bazel 的 analysis graph。这意味着，仅准备工作就占了 CI 时间的三分之一以上！

使用快照 runners，我们的 CI 运行中值现在只有 30 秒！对于较小的存储库，我们看到测试在 6 秒内运行。

这种基于 snapshot 的 runner 架构，同时支撑我们的 CI 产品 **BuildBuddy Workflows** 和通用远程 runners 产品 **Remote Bazel**。（注意：虽然产品名 Remote Bazel 中有 bazel，但这些支持 snapshot 的 runners 可以运行任意 bash 命令。）

展望未来，我们特别高兴能够将 **Remote Bazel** 与 AI 编码代理集成。由于代理使开发人员更快，我们的 runners 将使代理本身更快。

## Firecracker 的限制 {#limitations-with-firecracker}

Firecracker 是一种虚拟化技术，可以为运行中的 VM 创建 snapshot。snapshot 会把整台机器序列化到文件中，包含磁盘、内存以及内核内部状态。

（从技术上讲，snapshot 文件仅包含内存和内核状态，但为了简单起见，我们指的是 VM 内存和磁盘的内容，因为两者都必须以类似的方式进行序列化、缓存和传输。）

如果您在不同的 Firecracker 进程中恢复 snapshot 文件，您将获得原始 VM 的精确副本，并且原始 VM 不会受到影响。从那时起，原始虚拟机及其克隆都是唯一的，并且可以用于不同的目的。

克隆 Firecracker VM 可以很好地解决 cold 启动问题。当工作负载到达 warm runner 时，它们通常会快几分钟。

不过，管理 snapshot 文件很快就成了一项挑战。

假设您的工作负载需要 20GB 内存和 80GB 磁盘（常见于 Bazel 版本）。这直接转换为 20GB 内存 snapshot 文件和 80GB 文件支持的磁盘映像。在运行虚拟机的整个生命周期内，所有 100GB 数据都必须存在于主机上。如果您想在另一台机器上运行此 snapshot，则需要通过网络传输所有 100GB 的数据。

从同一个 snapshot 文件恢复多个工作负载是另一个技术挑战。我们的主机使用 ext4 文件系统，它不支持写时复制。我们需要将工作负载彼此隔离，因此我们无法直接修改磁盘映像。但为每个克隆复制 80GB 磁盘映像的成本也高得令人望而却步。

## 分块快照来救援！ {#chunked-snapshots-to-the-rescue}

我们意识到，如果我们可以将每个 snapshot 拆分为更小的 chunks，管理起来就会容易得多。我们可以将 chunks 存储在 remote cache 中，并轻松地在多台机器上共享它们。我们可以压缩 chunks 以提高存储效率，跨区域复制它们以实现冗余，并跨工作负载删除重复数据。

创建 snapshot 时，我们将内存和磁盘文件拆分为chunks。我们还维护从 snapshot 文件中的地址到标识每个 chunk 数据的唯一哈希值的映射。

例如，内存 snapshot 的元数据可能如下所示：

```text
- Hash `abc` => \{ memory addresses 0x00 - 0x100 }
- Hash `def` => \{ memory addresses 0x101 - 0x200 }
- …
```

磁盘 snapshot 的元数据可能如下所示：

```text
- Hash `111` => \{ offsets 0 - 100 }
- Hash `222` => \{ offsets 101 - 200 }
- …
```

在snapshot生成时，chunks被压缩并保存在remote cache中。稍后，当克隆尝试读取此 snapshot 数据时，每个 chunk 都会被延迟下载。与提前下载整个 snapshot 文件相比，这可以更快地启动。

当然，保存分块数据只是成功的一半。内核期望内存和磁盘以某种方式呈现。默认情况下，Firecracker 期望整个内存和磁盘 snapshot 文件在 VM 启动时驻留在磁盘上。它并不期望做一些奇特的事情，比如从 remote cache 提供压缩内存。

我们意识到，必须自己管理磁盘和内存访问。大约就在这时，我们读到了 Code Sandbox 关于 Userfaultfd（UFFD）的 [一组精彩文章](https://codesandbox.io/blog/how-we-clone-a-running-vm-in-2-seconds)。UFFD 允许用户实现自己的内存管理处理程序。借助 UFFD，我们可以从任何所需的位置加载内存数据！同样，我们也可以通过 FUSE 实现自定义的磁盘访问处理程序。

## 回顾内存管理 {#trip-down-memory-lane}

通常，当进程请求内存时，内核会为其分配 *虚拟内存* 。不保证该内存存在于 RAM 中。通常，它的内容会保存在磁盘上，让机器“使用比 RAM 芯片的物理限制更多的内存”，而 RAM 芯片通常比磁盘贵得多。

当进程尝试访问不在 RAM 中的虚拟内存时，内核的工作就是将数据从磁盘加载到 RAM 中。此过程称为 *缺页异常* 。

例如，假设一个进程尝试访问不在 RAM 中的内存页 0x100：

1.  内核收到地址 0x100 的缺页异常通知。
2.  内核将使用内部数据结构将该地址映射到磁盘上的某个位置。然后它将从磁盘读取数据。
3.  内核会将数据从磁盘复制到 RAM 中。
4.  现在该进程可以从 RAM 读取数据或将数据写入 RAM。

当从 Firecracker snapshot 恢复时，情况看起来大多相似。通常，当进程访问 RAM 之外的内存时，内核会从之前存储在磁盘上的位置加载它。当从 Firecracker snapshot 恢复时，内核将直接从 snapshot 文件加载数据。

使用上面的相同示例：

1.  内核收到地址 0x100 的缺页异常通知。
2.  该地址将映射到 snapshot 文件内的位置。
3.  内核会将位于磁盘上的 snapshot 文件中的数据复制到 RAM 中。
4.  现在该进程可以从 RAM 读取数据或将数据写入 RAM。

## 使用 UFFD 进行自定义内存管理 {#custom-memory-management-with-uffd}

UFFD 是 userfault file descriptor 的缩写，是一种允许用户自定义缺页处理行为的内核功能。

换句话说，开发人员可以编写加载内存数据的自定义程序，而不是依赖默认的内核行为来处理缺页异常。我们的 UFFD 处理程序不是从磁盘上的 snapshot 文件加载内存数据，而是从 remote cache 加载分块和压缩的内存数据。

Firecracker 内置支持从带有 UFFD 的 snapshot 恢复。当您配置 Firecracker 以使用 UFFD 时，会发生以下情况：

1.  Firecracker 将创建一个 UFFD 文件描述符，注册用于 VM 使用的内存范围。

-   假设虚拟机使用从地址 0x100 开始的 1GB 内存。
-   Firecracker 将使用带有参数 { `start=0x100`, `len=1e9` } 的 UFFDIO\_REGISTER ioctl 来初始化 UFFD。
-   这段内存范围内一旦触发缺页异常，内核就会交给自定义 UFFD handler 处理，而非采用默认处理方式。

2.  Firecracker 将通过配置的 Unix 套接字发送 UFFD 文件描述符。

在我们这边，我们运行一个充当 UFFD 处理程序的 Go 程序：

1.  该处理程序侦听 Firecracker 在配置的 Unix 套接字上发送的 UFFD 文件描述符。
2.  收到后，它会轮询文件描述符以查找缺页异常事件。

-   每个事件都表示 VM 在访问某个内存地址时触发了缺页异常，并携带对应的缺页地址。

3.  现在，处理程序负责向来宾提供请求的内存数据。
4.  使用 [snapshot 元数据文件](#chunked-snapshots-to-the-rescue) ，处理程序会将故障地址映射到 snapshot chunk。

-   在上面的示例中，地址 `0x100` 映射到 chunk `abc`。

5.  然后，它从 remote cache 中获取并解压缩请求的 chunk。
6.  然后，它使用 `UFFDIO_COPY` 操作将数据复制到故障内存地址。

-   `UFFDIO_COPY` 把用户态缓冲区中的数据复制到触发缺页的地址，从而完成缺页处理。
-   数据复制完成后，内核会唤醒原先因缺页而阻塞的进程，让它继续执行。

7.  现在进程可以从 RAM 中读取请求的数据了！

-   从虚拟机的角度来看，这看起来与内核处理的正常缺页异常完全相同。

在步骤 #5 中，snapshot chunks 缓存在主机本地。同一主机上的其他虚拟机可以重复使用这些 chunks，而无需重新下载它们，从而提高性能。

内存写入不必由 UFFD 处理程序显式处理。解决缺页异常后，该页面将归 VM 所有。然后，VM 可以自由读取和写入该页面，而不会触发其他缺页异常，并且 UFFD 处理程序不再参与管理该内存地址。

## 用于磁盘管理的 FUSE {#fuse-for-disk-management}

磁盘访问使用 FUSE，这项内核功能允许自定义文件系统操作的处理方式。

Firecracker 期望磁盘映像作为文件附加。例如，如果不使用 FUSE，您可以将磁盘映像文件 `rootfs.img` 附加到 VM 上的 <code>/dev/vdx </code> 。从 VM 上的 `/dev/vdx` 进行的任何读取都将从 `rootfs.img` 文件中读取基础数据。

如果您希望多个克隆以相同的磁盘内容启动，则可以将 `rootfs.img` 连接到每个虚拟机。

请记住，传输和复制大量磁盘映像文件的成本非常高。因此，我们不是在虚拟机上附加整体磁盘映像文件，而是附加 FUSE 支持的虚拟磁盘。只要 FUSE 设备遵循文件接口（即支持 `Read`、`Write` 和 `Fsync`），Firecracker 就允许这样做。

初始化 FUSE 支持的磁盘时，您可以配置它应附加的路径和 FUSE 处理程序。我们的 FUSE 处理程序是一个实现 `Reader` 和 `Writer` 接口的 Go 程序。

假设 FUSE 块设备连接在 `/dev/vdx`，并且 VM 中的进程尝试从 `/dev/vdx` 的偏移量 150 处读取：

1.  由于`/dev/vdx`配置了FUSE，因此内核将请求转发到FUSE服务器。
2.  FUSE 服务器调用配置的 FUSE 处理程序 - 一个实现 `Read` 方法的 Go 程序。

`Read(ctx context.Context, p []byte, off int64) (res fuse.ReadResult, errno syscall.Errno) \{...}`

3.  在 `Read` 中，处理程序使用 [snapshot 元数据文件](#chunked-snapshots-to-the-rescue) 将偏移量映射到 snapshot chunk。

-   在我们之前的元数据示例中，偏移量 150 对应于 chunk `222`。

4.  它从 remote cache 中获取并解压缩请求的 chunk。
5.  然后，它将请求的数据填充到读取缓冲区中（上面函数签名中的 `p`）。

对于写入，我们使用 *copy-on-write 语义* 来避免修改原始的 snapshot chunk，这可能会被并行运行的其他克隆使用。

假设一个进程尝试写入 `/dev/vdx` 上的偏移量 150：

1.  由于`/dev/vdx`配置了FUSE，因此内核将请求转发到FUSE服务器。
2.  FUSE 服务器调用配置的 FUSE 处理程序 - 一个实现 `Write` 方法的 Go 程序。

`Write(ctx context.Context, p []byte, off int64) (uint32, syscall.Errno) \{...}`

3.  在 `Write` 中，处理程序使用 snapshot 元数据文件将偏移量映射到 snapshot chunk。

-   在我们之前的元数据示例中，偏移量 150 对应于 chunk `222`。

4.  它从 remote cache 中获取并解压缩请求的 chunk。
5.  处理程序不是直接写入获取的 chunk，而是将 chunk 复制到带有 `.dirty` 后缀的新 chunk。

-   Chunk `222` 将复制为 `222.dirty`。

6.  新数据写入`.dirty` chunk，原始chunk 保持不变。
7.  该处理程序跟踪所有 `.dirty` chunks，并确保所有将来对此偏移量的读取和写入都使用 `.dirty` chunk。

工作负载结束、再次创建 snapshot 时，只有脏的 chunks 才会上传到缓存。为每个脏的 chunk 生成一个新的哈希值，并相应地更新元数据文件。未修改的chunks不会重新上传，最大限度地减少网络传输。

## 克隆的网络配置 {#network-configuration-for-clones}

难题的最后一部分是网络。 VM snapshot 包含固定的网络配置（例如 IP 地址和接口名称）。如果您在同一台主机上从同一个 snapshot 文件运行两个克隆，它们会遇到 IP 和路由冲突。每个虚拟机都需要唯一的网络标识，而无需更改底层 snapshot 文件。

根据 Firecracker 文档中的建议，我们使用 *Linux 网络命名空间* 来处理此问题。每个网络命名空间都有自己的网络接口、路由表、iptables rules 和端口空间，全部由主机内核管理。

尽管每个克隆的虚拟机都使用共享 snapshot 中的相同 IP 地址和接口配置，但每个虚拟机都在单独的网络命名空间中运行。从虚拟机的角度来看，它是网络上唯一的机器。网络配置将保持完全隔离并且不会发生冲突。

为了支持外部网络连接，我们在主机上启用 NAT 伪装。 NAT 伪装允许多个虚拟机共享主机的公共 IP 地址以进行出站流量，从而无需为每个虚拟机分配唯一的公共 IP。主机内核使用名为 *conntrack* 的连接表来跟踪这些连接，这确保返回流量被路由回正确的虚拟机和网络命名空间。

## 我该如何使用这个？ {#how-do-i-use-this}

在快照的 Firecracker runner 上运行命令就像发出 CURL 请求一样简单。

首先，可以在[这里](https://www.buildbuddy.io/)创建免费的 BuildBuddy 账号，生成 API key。一个 CURL 请求示例如下：

```text
curl --data '{
"steps": [{ "run": "echo ‘HELLO WORLD!!!’" }]
}' \
--header 'x-buildbuddy-api-key: YOUR_API_KEY' \
--header 'Content-Type: application/json' \
https://app.buildbuddy.io/api/v1/Run
```

`run`块中的bash脚本将在VM中执行。

如果再发送第二个 CURL 请求，或并行发送多个后续 CURL 请求，它们会复用第一个请求创建的同一个 runner。

我们支持在 runners 上配置操作系统、架构、机器大小（核心数、磁盘大小和内存）、容器映像等。

只要机器配置保持不变，未来的请求将使用相同的快照 runner。 Runners 甚至可以在需要相同启动环境的团队成员之间共享。

我们有两种基于 snapshot 架构构建的产品：

借助我们的 CI 产品 [BuildBuddy Workflows](https://www.buildbuddy.io/docs/workflows-setup/)，您可以在每次向 GitHub repository 推送和拉取请求时在快照 runners 上运行命令。

[Remote Bazel](https://www.buildbuddy.io/docs/remote-bazel/)，上面展示的通用远程runner产品，更加灵活。您可以通过 CURL 请求或使用我们的 `bb` CLI 在快照的 runner 上运行命令。

## 接下来是什么？ {#whats-next}

我们特别兴奋的一个领域是教导 AI 编码代理使用 Remote Bazel 运行昂贵的命令，这些命令将从 warm workspaces 中受益。

Remote Bazel 有助于克服在本地或在 AI providers 提供的资源受限的 runners 上运行构建的限制。

通过将 CURL 请求包含在代理的 [技能文件](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview?utm_source=chatgpt.com) 中或开发发出 CURL 请求的轻量级 MCP 服务器，可以教会代理使用 Remote Bazel。我希望将来能写一篇博客文章来概述如何做到这一点。

如果您对我们如何采用这项技术有任何疑问、意见或反馈，请联系我们！特别是如果您对将其与人工智能代理集成的最佳方式有想法，我很想听听您的意见。

对于视听学习者，我还在几次会议上谈到了这项技术。以下是 [技术概述](https://www.youtube.com/watch?v=k30xZfiRZYo&list=PLbzoR-pLrL6rUiqylH-kumoZCWntG1vjp&index=33) ，介绍了我们如何实现快照 Firecracker runners，这里是 [产品概述](https://www.youtube.com/watch?v=BM2gsH2Ao04&list=PLbzoR-pLrL6ptKfAQNZ5RS4HMdmeilBcw&index=14) ，其中包含有关如何利用该技术的更多示例。

您可以在我们的开源 Slack 频道 @maggie 上找到我，或者发送电子邮件至 [maggie@buildbuddy.io](mailto:maggie@buildbuddy.io)。

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
