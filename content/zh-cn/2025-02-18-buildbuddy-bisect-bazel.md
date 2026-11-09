---
layout: post
title: "[译] 用 Git Bisect 排查 Bazel 构建问题"
date: 2026-11-09T08:00:59+08:00
publishDate: 2026-11-09T08:00:59+08:00
draft: false
slug: "buildbuddy-bisect-bazel"
tags: [Bazel, BuildBuddy, 翻译]
categories: ["软件工程"]
author: ["Son Luong Ngoc"]
original_url: "https://www.buildbuddy.io/blog/bisect-bazel"
original_title: "Troubleshooting Bazel with Git Bisect"
original_date: 2025-02-18T12:00:00.000Z
translation_engine: "Google Translate，整段上下文重译，保留术语与既有技术修正"
translation_status: "已完成本轮风格建议、重点技术复核及结构检查"
---

原文：[Troubleshooting Bazel with Git Bisect](https://www.buildbuddy.io/blog/bisect-bazel)<br>
作者：Son Luong Ngoc · 原文发表于 2025-02-18。

> 译注：文中的“我们”指原作者或 BuildBuddy 团队，时效性表述以原文发布日期为准。Bazel 专有名词保留英文，代码和命令未作翻译。

> 译注：本文保留 2025 年 2 月使用 Bazel 8.0.1、8.1.0 和 rules_go 排查回归的案例。版本号、commit 和日志均是当时的记录，用来演示二分定位方法。

升级 Bazel 和相关依赖项有时会导致意外问题。这些问题的范围从 构建 故障到运行时错误，而且通常很难排除故障。

今天我们来看看，依赖升级后出现 构建 失败，如何用 `git bisect` 找出根因。

## 升级 Bazel 后 构建 失败 {#build-failed-after-upgrading-bazel}

如果您像我一样，您会喜欢在项目中拥有最新、最好的工具。而我使用最多的工具是Bazel，所以随着最近`8.1.0`版本的发布，我决定升级我们的BuildBuddy repository来使用它。

```bash
$ echo '8.1.0' > .bazelversion

$ bazel test --config=remote-minimal //...
...
ERROR: /root/workspace/output-base/external/bazel_tools/tools/build_defs/repo/http.bzl:137:45: An error occurred during the fetch of repository 'rules_cc+':
   Traceback (most recent call last):
        File "/root/workspace/output-base/external/bazel_tools/tools/build_defs/repo/http.bzl", line 137, column 45, in _http_archive_impl
                download_info = ctx.download_and_extract(
Error in download_and_extract: com.google.devtools.build.lib.remote.common.CacheNotFoundException: Missing digest: abc605dd850f813bb37004b77db20106a19311a96b2da1c92b789da529d28fe1/178823
...
```

哎呀！将 Bazel 升级到 `8.1.0` 后，构建 似乎失败了。返回到 `8.0.1` 问题就消失了，这意味着问题是在 Bazel `8.1.0` 中引入的。

接下来我们应该做什么？

#### 使用 bazelisk 自动二分排查 {#auto-bisect-with-bazelisk}

幸运的是，Bazel 团队在 `bazelisk` 内部为我们提供了一个神奇的标志，可以帮助我们解决这个问题。

[\--bisect](https://github.com/bazelbuild/bazelisk?tab=readme-ov-file#--bisect) flag 会自动列出两个 Bazel 版本之间的提交，帮助我们做二分排查。用法如下：

```bash
alias bazel=bazelisk

# Usage:
#   bazelisk --bisect=<good commit hash>..<bad commit hash> test //foo:bar_test
$ BAZELISK_CLEAN=1 bazelisk --bisect=8.0.1..8.1.0 test --config=remote-minimal //...
```

**说明**：最后一个已知正常的版本是 `8.0.1`，出现问题的版本是 `8.1.0`。Bazelisk 会通过 Github API 获取这两个版本之间的提交列表，然后开始二分查找。对于二分过程中选中的每个提交，它都会从 Google Cloud Storage 存储桶下载对应版本预先编译好的 Bazel 二进制文件，再运行测试命令。这些运行会忽略 `.bazelversion` 文件。

问题与外部依赖下载有关，所以整个 Bazelisk 二分排查过程都设置了 `BAZELISK_CLEAN=1`。这样，每次测试之间都会执行 `bazel clean --expunge`，清理 Bazel 的 output base 并关闭 Bazel JVM 进程，确保能在干净的环境中复现问题。Bazelisk 支持的其他环境变量可以在[这里](https://github.com/bazelbuild/bazelisk/blob/740e1b91b5b2e86730b6bb12aaf211fc19f388a5/README.md?plain=1#L162)查看。

由于我们知道问题是由 `@rules_cc` 的外部下载引起的，因此我们可以将测试命令缩小到仍会触发相同下载的 `bazel query`。这应该有助于加快每次二分运行并减少 flakiness 的机会。

```bash
$ BAZELISK_CLEAN=1 bazelisk --bisect=8.0.1..8.1.0 query --config=remote-minimal @rules_cc//:all
```

这是结果：

```bash
--- Getting the list of commits between 8.0.1 and 8.1.0
Found 95 commits between (24cba660a7231786405ac40335c2e7e5bd4d6859, 8.1.0]
--- Verifying if the given good Bazel commit (24cba660a7231786405ac40335c2e7e5bd4d6859) is actually good
--- Start bisecting
--- Testing with Bazel built at c5cf63199b3964b4a188da73a6c24599468131e9, 95 commits remaining...
--- Succeeded at c5cf63199b3964b4a188da73a6c24599468131e9
--- Testing with Bazel built at 040769767613287a0f1b5ceed41b9d7729126983, 47 commits remaining...

2025/02/18 10:56:29 Using unreleased version at commit 040769767613287a0f1b5ceed41b9d7729126983
2025/02/18 10:56:29 Downloading https://storage.googleapis.com/bazel-builds/artifacts/macos_arm64/040769767613287a0f1b5ceed41b9d7729126983/bazel...
2025/02/18 10:56:29 Skipping basic authentication for storage.googleapis.com because no credentials found in /Users/sluongng/.netrc
2025/02/18 10:56:29 could not run Bazel: could not download Bazel: failed to download bazel: failed to download bazel: HTTP GET https://storage.googleapis.com/bazel-builds/artifacts/macos_arm64/040769767613287a0f1b5ceed41b9d7729126983/bazel failed with error 404
```

这里，Bazelisk 找到了 `8.0.1` 对应的提交 `24cba660a`，并验证了该提交运行正常。随后，它开始在 `24cba660a` 和 `8.1.0` 之间二分排查。第一个选中的提交 `c5cf63199b` 运行正常，第二个提交 `0407697676` 对应的 Bazel 二进制文件却无法从 Google Cloud Storage（GCS）存储桶下载。这与我们原先调查的问题不同，该如何继续呢？

#### 使用 git bisect 手动二分排查 {#manual-bisect-with-git-bisect}

如果 Bazelisk 提供 flag，能把某些已知提交标为 SKIP，这里就好办了，可惜它没有。我知道 `git bisect` 支持这个功能，于是改用手动二分排查。

```bash
# My personal working directory
$ cd ~/work/bazelbuild/

# Clone the Bazel repository
$ git clone https://github.com/bazelbuild/bazel.git
$ cd bazel

# Start bisecting
$ git bisect start --no-checkout --first-parent 8.1.0 8.0.1
Bisecting: 47 revisions left to test after this (roughly 6 steps)
[8afe16e0396be93cc5d9bc2108aab2e45dfcb2bd] [8.1.0] Fix docs link rewriting for rules_android (#25018)
```

Bazel 团队在 GCS 存储桶提供了预先编译的二进制文件，我们无需自己 构建 Bazel，因此可以用 `--no-checkout` flag 加快二分排查。使用 `--no-checkout` 时，当前待测试的提交保存在 `.git/BISECT_HEAD` 文件中。`--first-parent` 让二分过程只沿提交的第一个父提交前进，通常对应代码库 `master/main` 分支上的合并提交。`bazel.git` 的历史本身很线性，这里其实无需 `--first-parent`。我仍保留它，方便读者和以后的自己直接复制使用。

```bash
$ cat .git/BISECT_HEAD
8afe16e0396be93cc5d9bc2108aab2e45dfcb2bd
```

那么我们如何告诉 Bazelisk 使用属于此提交的 GCS 存储桶中的预构建二进制文件呢？幸运的是，我们可以出于这个原因设置环境变量 `USE_BAZEL_VERSION`。

```bash
$ USE_BAZEL_VERSION=7.1.0 bazel version
version
Bazelisk version: 1.25.0
Extracting Bazel installation...
Build label: 7.1.0
Build target: @@//src/main/java/com/google/devtools/build/lib/bazel:BazelServer
Build time: Mon Mar 11 17:55:51 2024 (1710179751)
Build timestamp: 1710179751
Build timestamp as int: 1710179751
```

这样，我们就可以手动在 `~/work/bazelbuild/bazel` 和 `~/work/buildbuddy-io/buildbuddy` 两个目录之间交替运行测试命令并将提交标记为好或坏。

```bash
# Copy the new bisect commit to the clipboard
$ export USE_BAZEL_VERSION=$(cat .git/BISECT_HEAD)

# Verify the commit
$ cd ~/work/buildbuddy-io/buildbuddy
$ bazel ... query ...
...

$ cd ~/work/bazelbuild/bazel
# $ git bisect good
# $ git bisect bad
# $ git bisect skip

# Repeat
```

不过，只写手动操作还算不上一篇好文章。我们再多做一点，写个脚本，借助 `git bisect run` 自动完成二分排查。

```bash
$ cat test-buildbuddy.sh
#!/bin/bash

export USE_BAZEL_VERSION='8.0.1'
# export USE_BAZEL_VERSION=$(cat .git/BISECT_HEAD)

function cleanup()
{
  (
    cd ~/work/buildbuddy-io/buildbuddy
    bazel clean --expunge
  )
}
trap cleanup EXIT

(
  cd ~/work/buildbuddy-io/buildbuddy
  STDERROUT=$(bazel 2>&1 query --repository_cache='' --config=remote-minimal @bazel_features//:all)
  BAZEL_EXIT_CODE=$?
  # If stderr contains 'could not download Bazel' then return with code 125
  # to skip the current commit during bisect.
  if [[ $BAZEL_EXIT_CODE -ne 0 && $STDERROUT == *"could not download Bazel"* ]]; then
    echo "Bazel download failed. Skipping commit $USE_BAZEL_VERSION."
    exit 125
  fi
  if [[ $BAZEL_EXIT_CODE -ne 0 ]]; then
    echo "Bazel query failed with exit code $BAZEL_EXIT_CODE."
  fi
  exit $BAZEL_EXIT_CODE
)
```

**解释**：

首先，把环境变量 `USE_BAZEL_VERSION` 设为当前待测提交的 hash 并导出，让 Bazelisk 使用 GCS 存储桶中与该提交对应的预编译二进制文件。不过，我们先不读取 BISECT\_HEAD，而是先检查脚本能否正常工作。`8.0.1` 是最后一个已知正常的版本，可以先把 `USE_BAZEL_VERSION` 设为这个版本来验证。

接下来，由于我们没有使用 Bazelisk 二分排查功能，因此 `BAZELISK_CLEAN` 的自动清理功能将不起作用。相反，我们将在每次使用 `bazel clean --expunge` 测试运行后手动清理 workspace，以获得类似的结果。

之后，我们希望确保处理下载问题，因为 GCS 存储桶中可能会丢失一些提交。 `git bisect run` 允许我们通过返回退出代码 `125` 来跳过当前提交。

> 当无法测试当前源代码时，应使用特殊退出代码 125。如果脚本以此代码退出，则将跳过当前修订版本

因此，我们检查 Bazel 查询是否失败并显示错误消息 `could not download Bazel` 并返回退出代码 `125` 以跳过当前提交。否则，我们将返回 Bazel 查询命令的退出代码。

现在让我们验证我们的脚本是否可以在 `8.0.1` 上运行：

```bash
$ ./test-buildbuddy.sh
Starting local Bazel server (no_version) and connecting to it...
...
@rules_cc//:empty_lib
@rules_cc//:link_extra_lib
@rules_cc//:link_extra_libs
Loading: 1 packages loaded
```

现在修改脚本，读取 `BISECT_HEAD` 文件，将其中的提交 hash 赋给 `USE_BAZEL_VERSION`，再启动二分排查：

```bash
$ cat test-buildbuddy.sh
#!/bin/bash

# export USE_BAZEL_VERSION='8.0.1'
export USE_BAZEL_VERSION=$(cat .git/BISECT_HEAD)
...

$ git bisect run ./test-buildbuddy.sh
running './run.sh'
Bisecting: 23 revisions left to test after this (roughly 5 steps)
[11e85a4dc73f93ef25809e7d5f0409aaca7d42f1] [8.1.0] Respect comprehension variable shadowing in Starlark debugger output (#25139)
running './run.sh'
Bazel download failed. Skipping commit 11e85a4dc73f93ef25809e7d5f0409aaca7d42f1.
2025/02/18 13:18:12 Using unreleased version at commit 11e85a4dc73f93ef25809e7d5f0409aaca7d42f1
2025/02/18 13:18:12 Downloading https://storage.googleapis.com/bazel-builds/artifacts/macos_arm64/11e85a4dc73f93ef25809e7d5f0409aaca7d42f1/bazel...
2025/02/18 13:18:12 Skipping basic authentication for storage.googleapis.com because no credentials found in /Users/sluongng/.netrc
2025/02/18 13:18:12 could not download Bazel: failed to download bazel: failed to download bazel: HTTP GET https://storage.googleapis.com/bazel-builds/artifacts/macos_arm64/11e85a4dc73f93ef25809e7d5f0409aaca7d42f1/bazel failed with error 404
Bisecting: 23 revisions left to test after this (roughly 5 steps)
[12a3fc001b6629b52f5b24dce6018884222a0608] [8.1.0] See and use more than 64 CPUs on Windows (#25140)
running './run.sh'
Bisecting: 10 revisions left to test after this (roughly 4 steps)
[af6307bc6832d66cce772c5170961b4ff4521e48] [8.1.0] Configure `--run_under` target for the test exec platform (#25184)
running './run.sh'
Bisecting: 4 revisions left to test after this (roughly 3 steps)
[14219c4698e112a03ebe62eed7cb324f625f13c8] [8.1.0] Use digest function matching the checksum in gRPC remote downloader (#25225)
running './run.sh'
Bazel query failed with exit code 1.
Bisecting: 2 revisions left to test after this (roughly 2 steps)
[5f3a083d5649715dc0bed811ef41f53b91539d1d] [8.1.0] Update to use coverage_output_generator-v2.8 (#25202)
running './run.sh'
Bisecting: 1 revision left to test after this (roughly 1 step)
[a40a0cd9947dd73ec07f2394d108eb7e98745161] [8.1.0] Add version selector buttons to repo rule docs (#25211)
running './run.sh'
Bisecting: 0 revisions left to test after this (roughly 0 steps)
[aa4531d5a2116f85b80a753c53528032ed3cda71] [8.1.0] Don't suggest updates to private repo rule attributes (#25213)
running './run.sh'
14219c4698e112a03ebe62eed7cb324f625f13c8 is the first bad commit
commit 14219c4698e112a03ebe62eed7cb324f625f13c8
Author: bazel.build machine account <ci.bazel@gmail.com>
Date:   Fri Feb 7 12:07:48 2025 +0100

    [8.1.0] Use digest function matching the checksum in gRPC remote downloader (#25225)

    Fixes https://bazelbuild.slack.com/archives/CA31HN1T3/p1738763759125489

    Closes #25206.

    PiperOrigin-RevId: 724267755
    Change-Id: Ia23bdae310231bd0ee5763311b948f3465aa8ed0

    Commit
    https://github.com/bazelbuild/bazel/commit/ef45e02bfb4af1124bb9ad1ef94f36c70c82ce48

    Co-authored-by: Fabian Meumertzheim <fabian@meumertzhe.im>

 .../remote/downloader/GrpcRemoteDownloader.java    | 23 ++++++++++++++--------
 .../downloader/GrpcRemoteDownloaderTest.java       | 23 +++++++++++++---------
 2 files changed, 29 insertions(+), 17 deletions(-)
bisect found first bad commit
```

瞧！我们找到了引入该问题的提交。它是`14219c4698e112a03ebe62eed7cb324f625f13c8`，在Bazel `8.1.0`中引入。

本文不展开这个问题的具体细节，感兴趣的话可以阅读[回退该改动的 PR #25320](https://github.com/bazelbuild/bazel/pull/25320)。我们预计即将发布的 Bazel 8.1.1 会修复这个问题。

## 升级依赖后 构建 失败 {#build-failed-after-upgrading-a-dependency}

同样的二分排查方法，也适用于升级 Bazel 依赖后出现的问题。比如，最近我们尝试把 repository 中的 `@rules_go` 从 `v0.51.0` 升级到 `v0.53.0`，结果 构建 失败了。

```bash
$ bazel build server
...
ERROR: /private/var/tmp/_bazel_sluongng/06e573a93bc2d6a9cad4ad41f00b4310/external/bazel_gazelle/internal/go_repository_cache.bzl:30:17: An error occurred during the fetch of repository 'bazel_gazelle_go_repository_cache':
   Traceback (most recent call last):
	File "/private/var/tmp/_bazel_sluongng/06e573a93bc2d6a9cad4ad41f00b4310/external/bazel_gazelle/internal/go_repository_cache.bzl", line 30, column 17, in _go_repository_cache_impl
		fail('gazelle found more than one suitable Go SDK ({}). Specify which one to use with gazelle_dependencies(go_sdk = "go_sdk").'.format(", ".join(matches)))
Error in fail: gazelle found more than one suitable Go SDK (go_host_compatible_sdk_label, go_sdk_darwin_arm64). Specify which one to use with gazelle_dependencies(go_sdk = "go_sdk").
ERROR: no such package '@@org_golang_google_grpc//reflection': gazelle found more than one suitable Go SDK (go_host_compatible_sdk_label, go_sdk_darwin_arm64). Specify which one to use with gazelle_dependencies(go_sdk = "go_sdk").
ERROR: /Users/sluongng/work/buildbuddy-io/buildbuddy/cli/cmd/sidecar/BUILD:3:11: //cli/cmd/sidecar:sidecar depends on @@org_golang_google_grpc//reflection:reflection in repository @@org_golang_google_grpc which failed to fetch. no such package '@@org_golang_google_grpc//reflection': gazelle found more than one suitable Go SDK (go_host_compatible_sdk_label, go_sdk_darwin_arm64). Specify which one to use with gazelle_dependencies(go_sdk = "go_sdk").
ERROR: Analysis of target '//cli:cli' failed; build aborted: Analysis failed
...
```

这次，我们可以使用相同的二分排查技术来识别引入问题的提交。为了让 `git bisect` 不那么乏味，我们使用 `@rules_go` 的本地副本，而不是由 Bazel 管理的副本。

```bash
$ cd ~/work/bazelbuild
$ git clone https://github.com/bazel-contrib/rules_go.git
$ cd rules_go
$ git checkout v0.51.0
```

这样，我们可以将以下行添加到 `.bazelrc` 中，以告诉 Bazel 使用我们的本地副本，而不是由 Bazel 管理的副本。

```bash
$ cd ~/work/buildbuddy-io/buildbuddy
$ tail -n 5 .bazelrc
## BZLMOD
common --override_module=rules_go=/Users/sluongng/work/bazelbuild/rules_go

## WORKSPACE
common --override_repository=io_bazel_rules_go=/Users/sluongng/work/bazelbuild/rules_go
```

**Pro 提示：** 这些标志非常方便，因此我建议将它们保留在 `.bazelrc` 文件中作为注释以供将来使用。

现在我们可以在 `@rules_go` repository 中开始二分排查过程。

```bash
$ cd ~/work/bazelbuild/rules_go
$ cat test-rules-go.sh
#!/bin/bash

(
  cd ~/work/buildbuddy-io/buildbuddy
  bazel build server
)
$ chmod +x test-rules-go.sh
```

这里使用的是 `@rules_go` 的本地副本，不必像前一个脚本那样处理下载问题。我们也预计 构建 不会因外部因素失败，因此无需设置 `BAZELISK_CLEAN`，也无需自行清理。每轮二分测试都可以复用同一个 Bazel JVM 进程，利用已经预热的 analysis cache 加快构建。

现在让我们开始二分排查过程：

```bash
$ cd ~/work/bazelbuild/rules_go
$ git bisect start --first-parent v0.53.0 v0.51.0
```

请注意，这里我们不想使用 `--no-checkout` 标志，因为存储库的工作副本用于二分排查运行，因此需要更新。

```bash
$ git bisect run ./test-rules-go.sh
running './test-rules-go.sh'
Bisecting: 8 revisions left to test after this (roughly 3 steps)
[4f5202adf56521b3048536d04eef12690557fa7c] Mention `dev_dependency` in `go_sdk.host` error (#4246)
running './test-rules-go.sh'
Bisecting: 4 revisions left to test after this (roughly 2 steps)
[66477c1b41b2449c8102f4338d011f07e4df04b6] Update documentation reference (#4237)
running './test-rules-go.sh'
Bisecting: 1 revision left to test after this (roughly 1 step)
[5eb06119c49b97f16aa79d53cdcd99f95b1000bf] Allow .so files to have more extensions (#4232)
running './test-rules-go.sh'
Bisecting: 0 revisions left to test after this (roughly 0 steps)
[d25e4e75f0ce8e419593a5c633f852ff1c08e292] Use same Go SDK as Gazelle for `go_bazel_test` (#4231)
running './test-rules-go.sh'
d25e4e75f0ce8e419593a5c633f852ff1c08e292 is the first bad commit
commit d25e4e75f0ce8e419593a5c633f852ff1c08e292
Author: Fabian Meumertzheim <fabian@meumertzhe.im>
Date:   Thu Jan 16 08:13:09 2025 +0100

    Use same Go SDK as Gazelle for `go_bazel_test` (#4231)

    **What type of PR is this?**

    Bug fix

    **What does this PR do? Why is it needed?**

    **Which issues(s) does this PR fix?**

    Fixes #4228

    **Other notes for review**

 MODULE.bazel                       |  2 +-
 go/private/repositories.bzl        | 11 +++++++++++
 go/tools/bazel_testing/BUILD.bazel |  9 ++++++---
 3 files changed, 18 insertions(+), 4 deletions(-)
bisect found first bad commit
```

这样就定位到了问题！它来自 `@rules_go` repository 中的提交 `d25e4e75f0ce8e419593a5c633f852ff1c08e292`，该提交随 `v0.53.0` 引入。Fabian 也很快通过 rules\_go 的 [PR #4264](https://github.com/bazel-contrib/rules_go/pull/4264) 修复了问题。

## 结论 {#conclusion}

升级 Bazel 或其依赖后，如果出现 构建 失败，可以用 `git bisect` 定位到引入问题的具体提交。

定位到具体提交后，就更容易采取措施。比如，确认问题来自 rules\_go@v0.53.0 后，我们改为升级到 v0.52.0，并向上游开源项目报告修复情况。也可以继续升级，同时在外部依赖中加入补丁，回退引入问题的那次提交。

我希望本指南对您有所帮助，并且您可以使用它来解决将来的外部依赖项升级问题。

---

本文译自 BuildBuddy 博客，原文及译文依据 [MIT 许可](/licenses/buildbuddy-MIT.txt) 提供。Copyright (c) 2020-present Iteration, Inc.
