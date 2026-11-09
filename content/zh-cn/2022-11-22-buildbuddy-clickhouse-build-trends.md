---
layout: post
title: "[译] 我们如何用 ClickHouse 分析数百万次构建的趋势"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-clickhouse-build-trends"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Lulu Zhang"]
original_url: "https://www.buildbuddy.io/blog/clickhouse-build-trends"
original_title: "How We Use ClickHouse to Analyze Trends Across Millions of Builds"
original_date: 2022-11-22T12:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[How We Use ClickHouse to Analyze Trends Across Millions of Builds](https://www.buildbuddy.io/blog/clickhouse-build-trends)<br>
作者：Lulu Zhang · 原文发表于 2022-11-22。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

使用 Buildbuddy 配合 Bazel 构建、测试软件时，Buildbuddy 会记录每次 Bazel invocation 的信息，包括构建次数、构建耗时和 remote cache 性能等。Buildbuddy 的 [Trends](https://app.buildbuddy.io/trends/) 页面会把这些数据随时间的变化展示出来。

![](/images/buildbuddy/trends-2-bbbcae75b1991b8423e69b75df0952d8-1d9e9282bb2c.png)

趋势页面能帮助你判断，所做的优化如何影响平均构建耗时及其他指标，也能暴露待改进的地方。比如，cache hit 率持续下降，可能是构建中存在结果不确定的构建 actions，也可能是新引入的依赖使缓存更频繁地失效。

当我们第一次创建趋势页面时，我们使用 MySQL 查询来聚合 构建 统计数据并生成我们想要显示的数据。有一段时间，这种方法效果很好，但我们很快就遇到了拥有大量构建的客户的性能问题。我们能够通过添加各种索引来暂时提高性能，尽管这有助于减少读取的行数，但这还不够。有些客户每月进行数百万次构建，这些客户的“趋势”页面（可以追溯到一年）需要超过 20 *分钟* 的加载时间。

趋势页面背后的查询需要多列的聚合，例如cache hits和cache misses。像 MySQL 这样的传统的基于行的数据库并不总是适合这种用例。在基于行的数据库中，数据是逐行存储的。聚合列时，比基于列的数据库需要更多的 I/O 查找，基于列的数据库将每列的数据存储在连续的块中。此外，基于列的数据库具有更高的压缩率，因为同一列的连续值具有相同的类型并且可能重复。

![](/images/buildbuddy/row-column-datastore-599977fd97a8b05de1e4267f50ac9f25-2a890150d8ff.png)

对于基于行的存储，我们可以从该图中看到，计算 cache hit 计数的总和需要我们加载块 1 和块 2。对于基于列的存储，所有 cache hits 数据都存储在同一块中。

因此，我们认为使用 ClickHouse（基于列的数据库）将提高趋势页面所需查询的性能。我们根据我们的用例验证了 ClickHouse 的性能：ClickHouse 处理 150 万行并计算统计数据花了 0.317 秒。相同的查询花费了 MySQL 大约 24 分钟。

我们数据迁移的目标之一是确保数据准确。在生产中启用双写后，我们添加了对MySQL和ClickHouse之间的监控和数据比较。不一致的根源之一是回填脚本和生产服务器都将数据插入到 ClickHouse 中。与传统数据库不同，ClickHouse的[ReplacingMergeTree](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replacingmergetree/)引擎仅在后台在不确定的时间删除重复数据。因此，在回填完成后，我们需要手动执行[OPTIMIZE](https://clickhouse.com/docs/en/sql-reference/statements/optimize/)操作来强制ClickHouse进行数据去重。在我们对数据一致性充满信心后，我们最终启用了趋势页面从 ClickHouse 读取。

## 接下来是什么 {#whats-next}

ClickHouse 让我们可以进一步分析构建、targets、测试和 remote execution。例如，可以用图表展示远程 actions 的时间主要花在哪些环节，帮助确定 remote execution 的优化方向。

我们很乐意听到您对您有兴趣查看哪些统计数据和图表的反馈。如果有任何问题、意见或想法，请加入我们的 [Slack 频道](https://community.buildbuddy.io/) 或发送电子邮件至 [hello@buildbuddy.io](mailto:hello@buildbuddy.io)。

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
