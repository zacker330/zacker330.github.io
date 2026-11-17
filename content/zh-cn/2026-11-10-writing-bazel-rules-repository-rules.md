---
layout: post
title: "[译] 编写 Bazel rules（五）：repository rules"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-repository-rules"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 5
original_url: "https://jayconrod.com/posts/110/writing-bazel-rules-repository-rules"
original_title: "Writing Bazel rules: repository rules"
original_date: 2019-11-09
original_updated: 2025-09-10
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: repository rules](https://jayconrod.com/posts/110/writing-bazel-rules-repository-rules)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2019-11-09，更新于 2025-09-10。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. **编写 Bazel rules（五）：repository rules**
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

前几篇文章中，我们写出了一套功能不多、但已经实用的 Bazel rules。不过，它们有一个大问题：依赖 host system 上安装的工具。这样一来，开发者就必须安装一些本来可能用不着的工具。团队成员最终很可能用着不同版本，构建出不同的 binary，程序也可能在一台机器上正常、换一台就不行。这还会破坏 remote execution 和 caching，因为 host 的 toolchain 未必存在于 remote platform。

本文会先解决其中一部分问题。我们将定义一个 repository rule，下载 Go toolchain，并为 `go_stdlib` 和 `go_tool_binary` target 生成自定义 build file。暂时还不会让其他 rule 使用新 toolchain；那部分比较复杂，会放到本系列的下一篇介绍。

## 什么是 repository rule？

_Repository rule_ 是用 Starlark 编写的 Bazel 扩展，用于定义 _repo_。Repo 是一个包含源代码和 build file 的目录，内容通常从外部获取。例如，[`http_archive`](https://bazel.build/rules/lib/repo/http#http_archive) 和 [`git_repository`](https://bazel.build/rules/lib/repo/git#git_repository) 都是 Bazel 内置的 repository rule。Repository rule 只能用在项目的 `MODULE.bazel` 中，不能放进 `BUILD.bazel`。

通过 `bazel_dep` 声明的 _module_ dependency 也会创建 repo 目录，不过机制有所不同。Module 从 module registry 下载，通常是 Bazel Central Registry，并且必须预先发布。后面的文章会介绍 module。

_Module extension_ 也能创建 repo 目录，不过它是调用 repository rule 来完成的。Module extension 适合用来对接外部 package management system，或进行 toolchainization。后面也会介绍。

现在先专注于 repository rule。它是基础构件，使用起来也相对简单。

补充一点历史背景：Bazel 引入 Bzlmod 和 `MODULE.bazel` 之前，external dependency 都在 `WORKSPACE` 中声明。在 workspace mode 下，repository rule 是获取外部代码的唯一方式。Bazel 在这种模式下的 [evaluation model 非常复杂](https://jayconrod.com/posts/115/organizing-bazel-workspace-files)，所以我很高兴它将在 Bazel 9 中被移除。不过，repository rule 在 module mode 下仍然有用。

定义 repository rule 与定义普通 rule 很相似：调用特殊函数 [`repository_rule`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#repository_rule)，传入 implementation function 和若干 attribute。定义完成后，可以在 `MODULE.bazel` 中通过 [`use_repo_rule`](https://bazel.build/rules/lib/globals/module#use_repo_rule) 加载它。

先来看一个小例子。从空目录开始，新建 `repo.bzl` 文件，写入下面的 `hello_repo` repository rule。它会创建一个 repo，其中有一个 `hello.txt` 文件，内容是一条自定义消息。

```bazel
def _hello_repo_impl(ctx):
    ctx.file("hello.txt", ctx.attr.message)
    ctx.file("BUILD.bazel", 'exports_files(["hello.txt"])')

hello_repo = repository_rule(
    implementation = _hello_repo_impl,
    attrs = {
        "message": attr.string(
            mandatory = True,
        ),
    },
)
```

在同一目录中创建一个空的 `BUILD.bazel`。它只是用来定义 package，以便加载 `repo.bzl`。

再创建 `MODULE.bazel`，通过 `hello_repo` 声明一个 repo。注意这里的语法：`use_repo_rule` 与 `load` statement 不同，必须将返回值赋给一个变量。

```bazel
hello_repo = use_repo_rule("//:repo.bzl", "hello_repo")

hello_repo(
    name = "hello",
    message = "Hello, world!",
)
```

运行 `bazel build @hello//:hello.txt`。Bazel 会对 repository rule 求值，在自己的 cache 中建立一棵目录树。想看结果，可以先运行 `bazel info output_base` 得到主输出目录，再查看其中的 `external/+_repo_rules+hello` 子目录。

```bash
$ cd $(bazel info output_base)/external/+_repo_rules+hello
$ ls
BUILD.bazel  hello.txt  REPO.bazel
$ cat hello.txt
Hello, world!
```

Repository rule 与普通 rule 有几项重要区别。它的 `ctx` 参数是 [`repository_ctx`](https://docs.bazel.build/versions/master/skylark/lib/repository_ctx.html)，API 很不一样。`repository_ctx` 可以下载文件、执行命令，以及访问 file system。

另一个重要区别是，repository rule 在 loading phase 求值，而不是 analysis phase。这带来了许多影响，其中之一是 repository rule 不能创建 action，也不能依赖普通 action 生成的文件。如果 implementation 需要自定义工具，就必须下载预先构建的 binary，或者在 repository rule 中自行构建工具，不能使用普通 action。

## `go_download` rule

下面定义一个 rule，下载 Go distribution，再生成自定义 build file。它放在 [rules_go_simple](https://github.com/jayconrod/rules_go_simple) 的新文件 [`internal/repo.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v5/internal/repo.bzl) 中，与 `rules.bzl` 分开。Repository rule 几乎总应该单独放在一个文件中，尽量减少所需的 `load` statement；一旦它们依赖其他 repository rule 先被调用，事情就会变得很复杂。

先看 rule 声明：

```bazel
go_download = repository_rule(
    implementation = _go_download_impl,
    attrs = {
        "urls": attr.string_list(
            mandatory = True,
            doc = "List of mirror URLs where a Go distribution archive can be downloaded",
        ),
        "sha256": attr.string(
            mandatory = True,
            doc = "Expected SHA-256 sum of the downloaded archive",
        ),
        "goos": attr.string(
            mandatory = True,
            values = ["darwin", "linux", "windows"],
            doc = "Host operating system for the Go distribution",
        ),
        "goarch": attr.string(
            mandatory = True,
            values = ["amd64", "arm64"],
            doc = "Host architecture for the Go distribution",
        ),
        "_build_tpl": attr.label(
            default = "//internal:BUILD.bazel.go_download.tpl",
        ),
    },
    doc = "Downloads a standard Go distribution and installs a build file",
)
```

这个定义引用了 implementation function `_go_download_impl`，稍后会看到它，同时声明了几个 attribute。

- `urls` 列出 Go distribution 的下载地址。通常最好也在自己的 mirror 上保存一份依赖，防止上游内容消失。
- `sha256` 是用于校验下载内容的 cryptographic hash，可以发现损坏或篡改。它也让 Bazel 能够跨本地 workspace 复用下载 cache，因为 Bazel 的 download cache 以 SHA-256 为 key。
- `goos` 和 `goarch` 用于生成 build file。
- `_build_tpl` 是生成 build file 所用 template 的 label。它是 hidden attribute，名称以 `_` 开头，因此必须提供 default 值。这里指向 [//internal:BUILD.bazel.go_download.tpl](https://github.com/jayconrod/rules_go_simple/blob/v5/internal/BUILD.bazel.go_download.tpl)。

再看 implementation function。为了简洁，这里省略了生成 constraint 的代码；下一篇介绍 platform 和 toolchain 时会讲到。

```bazel
def _go_download_impl(ctx):
    # Download the Go distribution.
    ctx.report_progress("downloading")
    ctx.download_and_extract(
        ctx.attr.urls,
        sha256 = ctx.attr.sha256,
        strip_prefix = "go",
    )

    # Add a build file to the repository root directory.
    # We need to fill in some template parameters, based on the platform.
    ctx.report_progress("generating build file")
    os_constraint = _GOOS_TO_CONSTRAINT.get(ctx.attr.goos)
    if os_constraint == None:
        fail("unsupported goos: " + ctx.attr.goos)
    arch_constraint = _GOARCH_TO_CONSTRAINT.get(ctx.attr.goarch)
    if arch_constraint == None:
        fail("unsupported goarch: " + ctx.attr.goarch)
    constraints = [os_constraint, arch_constraint]
    constraint_str = ",\n        ".join(['"%s"' % c for c in constraints])

    substitutions = {
        "{goos}": ctx.attr.goos,
        "{goarch}": ctx.attr.goarch,
        "{exe}": ".exe" if ctx.attr.goos == "windows" else "",
        "{exec_constraints}": constraint_str,
        "{target_constraints}": constraint_str,
    }
    ctx.template(
        "BUILD.bazel",
        ctx.attr._build_tpl,
        substitutions = substitutions,
    )
```

首先调用 [`ctx.download_and_extract`](https://docs.bazel.build/versions/master/skylark/lib/repository_ctx.html#download_and_extract)。它会下载 archive，校验 SHA-256，再将内容解压到 workspace 目录中。Archive 可以是 `.zip`、`.tar.gz`，也可以是其他几种格式。

接着调用 [`ctx.template`](https://docs.bazel.build/versions/master/skylark/lib/repository_ctx.html#template)。它会加载一个 template，可以是文件，也可以是 string，执行一组 string substitution，再把内容写入文件。如果只是想复制文件，也可以调用 `ctx.template`，不提供任何 substitution。

这样就完成了。这是一个比较小的 rule，这是好事，因为 repository rule 中的复杂逻辑，比构建过程中其他位置的复杂逻辑更难处理。理想情况下，所有 rule 都应该这么小，但实际很少如此。比如，要向 private server 进行 authentication，或者通过自定义 protocol 通信时，可能需要构建并执行自定义 binary。既要跨平台，又不依赖其他 toolchain，还不能破坏 reproducibility，实现起来很有挑战。有时，最好的办法是把预先编译好的自定义 binary 提交到 version control 中，直接运行它。

现在还不会真正用上这个下载工具的 rule，那是[下一篇文章](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)的内容。

## 需要留意的事

**不要依赖 host system。** 要求 host 提供某个工具或 library，就等于要求开发者在 repository 之外安装额外内容，这会提高新成员上手的门槛。它也可能破坏 remote execution，因为 remote execution platform 上未必存在这些 host tool 或 library。应该在 repository rule 中构建工具，或下载预先编译的 binary。

**保持 reproducible 和 deterministic。** `repository_ctx` API 允许 rule 在没有 sandbox 的情况下直接访问 host system。要避免把 host 的信息带进构建，例如目录名、environment variable 或 timestamp。

**了解 repository rule 如何执行。** Repository rule 可以通过 [`ctx.path`](https://docs.bazel.build/versions/master/skylark/lib/repository_ctx.html#path) 将 label 转换成 path，动态构造的 label 也可以。不过要小心，这会带来很多复杂性。通过 repository rule 声明的 repo，在不同 module 中属于不同的 namespace；在 module extension 中使用时，情况又有所不同。通常，通过 attribute 注入依赖，例如上面的 `_build_tpl`，比直接使用 `ctx.path` 更好。官方文档的 [External dependencies overview](https://bazel.build/external/overview) 有简要说明；想更深入了解，可以阅读 Mike Bland 的 [Migrating to Bazel Modules (a.k.a.) Bzlmod](https://blog.engflow.com/2024/06/27/migrating-to-bazel-modules-aka-bzlmod---the-easy-parts/)。

**测试并不容易。** bazel-skylib 的 [Starlark unit testing toolchain](https://github.com/bazelbuild/bazel-skylib/blob/master/lib/unittest.bzl) 可以帮助测试复杂函数。不过，要对 repository rule 有足够信心，仍然需要好的 integration test：建立一个使用这个 rule 的 Bazel workspace，在测试中递归调用 Bazel，再验证结果。[rules_bazel_integration_test](https://github.com/bazel-contrib/rules_bazel_integration_test) 提供了一些相关工具。rules_go 的 [`go_bazel_test`](https://github.com/bazelbuild/rules_go/tree/master/go/tools/bazel_testing) rule 可以为 Go 做这件事，但不能直接用于其他语言。

## 结语

Repository rule 可以下载代码、直接在 host system 上执行命令，并动态生成 build file。这些能力很强大，但构建过程的其他部分限制这些能力，是有原因的。下载的数据可能损坏，必须校验；在 host system 上执行的命令，在不同平台上可能行为不同，甚至根本无法工作；也没人愿意调试层层动态生成的 build file。

即便如此，repository rule 仍然是获取外部代码、生成 build file 的实用手段。后面会看到，它还可以与 module extension 配合，对接 Go modules、Maven、npm 等其他 dependency management system。写得好的 repository rule 能给使用者带来很多价值，不过，动手时还是要谨慎。
