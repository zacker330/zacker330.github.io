---
layout: post
title: "[译] 使用 Podman 和 SOCI Snapshotter 按需拉取容器镜像"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-image-streaming"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Iain Macdonald"]
original_url: "https://www.buildbuddy.io/blog/image-streaming"
original_title: "Lazily Pulling Container Images with Podman and SOCI Snapshotter"
original_date: 2023-11-15T12:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Lazily Pulling Container Images with Podman and SOCI Snapshotter](https://www.buildbuddy.io/blog/image-streaming)<br>
作者：Iain Macdonald · 原文发表于 2023-11-15。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

> 译注：缓存淘汰一节原文末句中的“only require re-indexing except after”疑有笔误。结合上文关于缓存访问与淘汰的说明，本译文将其理解为：经常使用的镜像通常只在容器 registry 中更新后才需要重新建立索引。

我们很高兴地宣布 podman 的性能改进，使在 BuildBuddy 的托管执行服务上拉取容器镜像的速度提高了约十倍，减少了客户 构建 和测试时间，并提高了我们自动扩展 BuildBuddy executor 池的能力。请继续阅读以了解具体细节。

## 容器化 {#containerization}

在 BuildBuddy，我们使用容器来隔离 actions 并支持在我们托管的 remote execution 服务上执行任意代码。在生产中，我们使用 Podman 作为默认容器运行时，但我们也支持 Docker 和 Firecracker。我们在容器设置中遇到的一个重大挑战是，在 cold 启动后拉取容器镜像可能会非常慢。我们的 executor 镜像约为 1 GB，在我们的 GCP 生产环境中提取它们通常需要大约 30 秒的时间。一些客户提供的镜像超过 10GB，并且可能需要几分钟的时间来拉取和提取。

显着的镜像拉取延迟不仅会直接减慢客户的构建和测试速度，还会限制我们自动扩展 executor 池和响应重负载的能力。当新的 BuildBuddy executors 启动时，它们会根据需要拉取容器镜像。这意味着 executor 首次运行使用某镜像的 action 时，要先等待镜像拉取。队列中使用同一镜像的其他 actions 也会被阻塞。因此，我们提取容器镜像的速度越快，我们就能更快地启动新的 executors 并开始运行客户提交的 actions。我们可以通过始终运行更多的 executors 来解决这个问题，或者在高峰时段抢先扩展 executor 池，但这些技巧最多只能部分解决这个问题，并且还有其他缺点。

[按需分发镜像](https://medium.com/nttlabs/startup-containers-in-lightning-speed-with-lazy-image-distribution-on-containerd-243d94522361)提供了一种更有希望的方案。它基于这样一个前提：对大多数容器运行而言，镜像的大部分内容都用不到。因此，容器运行时可以按需获取镜像层中的部分内容，无需提前拉取整个镜像。[stargz-snapshotter](https://github.com/containerd/stargz-snapshotter) 基于自定义的 eStargz 镜像格式实现按需获取。对于无法或不愿转换镜像格式的用户，[soci-snapshotter](https://github.com/awslabs/soci-snapshotter) 提供了基于 OCI 规范的方案。

## SOCI Snapshotter {#soci-snapshotter}

SOCI Snapshotter 相当于本地容器层存储，containerd 可以从中获取镜像层，代替直接访问远程 registry。按需获取镜像需要先建立索引：为每个镜像层创建 zip table of contents（ZToC），再用名为 SOCI Index 的 JSON 文件把这些 ZToC 与对应镜像层关联起来。给定镜像后，`soci create` 工具会生成这些 artifacts。大多数 snapshotter 用户会把生成的 ZToC 和 SOCI Index 作为 artifacts 推送到远程容器 registry，通过 referrers API 或以 tag 为基础的备用机制，将它们关联到容器镜像。其他 SOCI Snapshotter 实例便可以获取 SOCI Index 和 ZToC，确定容器文件系统中的位置对应各层 targz 文件的什么位置，进而按需获取层文件的部分内容。

![](/images/buildbuddy/soci-snapshotter-dd9b960d8c21cadbf2f44559f0e683fe-a5b02a18993d.webp) *典型的 soci-snapshotter 配置。SOCI artifacts 保存在容器 registry 中，按需读取，用来延迟拉取镜像的部分内容。*

## BuildBuddy + SOCI Snapshotter {#buildbuddy--soci-snapshotter}

我们有一些注意事项，阻止我们将 SOCI Snapshotter 与 BuildBuddy executors 开箱即用。首先，我们希望继续使用 Podman 作为我们的默认容器运行时，其次，我们希望支持只读注册表中容器镜像的惰性镜像分发 - 要求我们的客户向我们提供对其容器注册表的写访问权限或在其镜像部署中添加额外的镜像索引步骤对我们来说是不可能的。

我们通过将 stargz-snapshotter 中的 Podman 支持移植到 soci-snapshotter 解决了第一个问题。这涉及在 SOCI Snapshotter、`soci-store` 中创建一个新的二进制文件，并将其连接起来以运行 [store/fs.go](https://github.com/containerd/stargz-snapshotter/blob/main/store/fs.go) 文件系统实现。

第二个问题带来了更大的挑战。我们需要一种不同的机制来存储 SOCI 索引、ZToC 以及容器镜像与其 SOCI 索引之间的关联。对我们来说幸运的是，SOCI artifacts（索引和 ZToC）是内容可寻址的，并且我们知道如何存储 [内容可寻址 blob](https://bazel.build/remote/caching)！最后一部分，即镜像与其 SOCI 索引之间的关联，不是内容可寻址的，它只是字符串到字符串的映射。但 BuildBuddy 缓存还支持存储由哈希键控的非内容可寻址内容。因此，我们通过对镜像标识符进行加盐和散列来存储镜像到索引的映射，以支持版本控制，并在该键下添加一个缓存条目，该条目的值包含 SOCI 索引的摘要，该摘要可从 content-addressable store 检索。

为了支持所有这些修改，我们向快照程序添加了一些逻辑，尝试在远程注册表之前从本地文件系统检索 artifacts，并支持从特殊目录下的本地文件系统读取镜像到索引映射，同样由镜像标识符键入。最后，我们设置应用程序和 executor 在缓存中查找所有这些 artifacts，如果它们不存在则生成它们，并将它们存储在本地文件系统上，以便快照器可以执行其操作。

修改后的 soci-snapshotter 可在 [github.com/buildbuddy-io/soci-snapshotter](https://github.com/buildbuddy-io/soci-snapshotter) 上获取。

![](/images/buildbuddy/soci-snapshotter-buildbuddy-087b5c103c0a18dec7b4bb12f40278c7-4254a3510dce.webp) *BuildBuddy 与 soci-snapshotter 配合使用。SOCI artifacts 在 App 中按需生成，保存在缓存中，由 Executor 按需获取。*

## 授权 {#authorization}

我们客户的许多容器镜像在容器注册表中都受到密码保护。我们在 executors 和 soci-snapshotter 之间共享用户提供的注册表凭据，以便快照程序可以根据需要获取注册表 artifacts，但这些凭据会在短时间内过期。此处描述的设置不允许对容器镜像或其派生的 artifacts 进行任何未经授权的访问。 SOCI artifacts 仅针对授权镜像拉取操作生成和检索，就像标准 `podman pull` 请求一样。

## Cache Eviction {#cache-eviction}

我们持续从 BuildBuddy 缓存中淘汰长时间未使用的 artifacts，为新数据腾出空间，SOCI artifacts 也不例外。对大多数客户而言，被淘汰条目的平均最后访问时间（包括读取）已经相当久，因此受影响的通常只是那些很少拉取的容器镜像所对应的 artifacts。经常用于 remote execution 或 CI 的容器镜像，通常只有在容器 registry 中更新后才需要重新建立索引。

## 遇到的 bug {#bugs}

最初将惰性镜像分发到我们的 executors 后，我们看到间歇性的 构建 和由于 `Input/output errors` 在容器内运行二进制文件而导致的测试失败。我们将此问题追溯到containerd docker 授权库中的[a bug](https://github.com/containerd/containerd/issues/6377)，该错误导致它过于急切地重用过期的身份验证令牌。幸运的是，当我们等待 [上游修复](https://github.com/containerd/containerd/pull/8735/files) 时，有一个非常简单的 [解决方法](https://github.com/buildbuddy-io/soci-snapshotter/pull/2) 。

我们还发现，开发和生产环境中的 soci-store 偶尔会发生 panic。为收集更多信息，我们在开发环境中连续几周运行启用了 Go race detector 的版本，最终找到了两个原因。首先，内存 inode 中缓存的数据存在未受保护的多线程访问。为这些访问加上互斥锁就解决了问题，我们也已将修改 [提交上游](https://github.com/awslabs/soci-snapshotter/pull/833)。之所以比上游维护者更早发现，是因为我们的 executor 启动时会并发拉取两个容器镜像，有时两次拉取的间隔不到一毫秒，放大了这类潜在的并发问题。其次，soci-store 和 SOCI Snapshotter 都受到 go-fuse 库中一个 bug 的影响，某些 `Lseek` 调用会返回错误的值，导致越界读取 soci-store 的内存文件并发生 panic。把 soci-store 的 go-fuse 依赖升级到合入 [github.com/hanwen/go-fuse/pull/488](https://github.com/hanwen/go-fuse/pull/488) 之后的版本，就修复了这个问题。有意思的是，该 bug 在 SOCI Snapshotter 中 [表现略有不同](https://github.com/awslabs/soci-snapshotter/issues/829)，但同一项修复解决了两种症状。这两个 bug 都不常出现，也很难复现，Go race detector 提供的额外信息帮了大忙。

最后，我们遇到了由于私有容器注册表凭据在运行中过期而导致的问题。我们能够通过将 SOCI Snapshotter 中的后台层获取器与新引入的 soci-store 二进制文件连接起来来解决这些问题，从而减少在提供的凭据过期后请求容器层部分的可能性。

## 性能 {#performance}

我们已经在我们的开发环境中使用这里描述的惰性镜像分发机制几个月了，并且观察到 cold 启动后镜像拉取延迟几乎减少了十倍，在 SOCI artifacts 在缓存中可用的常见情况下，我们的 executor 镜像从大约 30 秒减少到大约 4 秒。在 SOCI artifacts 不可用的极少数情况下，由于需要拉取镜像、为其建立索引并从 executor 获取 SOCI artifacts，容器镜像设置速度会慢约 10%。在开发中测试此设置后，我们分两个阶段将其推广给所有 BuildBuddy cloud 客户。今年夏天早些时候，我们为所有可公开拉取的容器镜像启用了延迟镜像分发，本月我们为存储在私有容器镜像注册表中的镜像启用了延迟镜像分发。我们观察到客户镜像的镜像拉取延迟几乎减少了十倍，而客户不需要 action。

由于惰性镜像分发将层获取从拉取时推迟到运行时，因此预计某些容器运行操作会稍微慢一些 - 具体来说，当需要层的一部分但本地不可用时，必须在运行时从远程注册表获取它。幸运的是，我们的容器操作吞吐量足够高，这种性能损失在我们的环境中并不明显。

在更多场景中按需获取远程资源，还有很大的应用空间。我们希望在这个项目积累的经验之上，继续构建和改进 BuildBuddy 的远程 execution platform。

如果您想了解有关 BuildBuddy 的 remote execution 服务或我们提供的任何其他功能的更多信息，或尝试一下，请查看我们的 [文档](https://www.buildbuddy.io/docs/introduction/)。如果这种工程挑战听起来很有趣，[我们正在招聘](https://www.buildbuddy.io/careers/)！

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
