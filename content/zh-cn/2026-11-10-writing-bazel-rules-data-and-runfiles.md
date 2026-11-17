---
layout: post
title: "[译] 编写 Bazel rules（三）：data 和 runfiles"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-data-and-runfiles"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 3
original_url: "https://jayconrod.com/posts/108/writing-bazel-rules-data-and-runfiles"
original_title: "Writing Bazel rules: data and runfiles"
original_date: 2020-02-01
original_updated: 2025-09-08
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: data and runfiles](https://jayconrod.com/posts/108/writing-bazel-rules-data-and-runfiles)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2020-02-01，更新于 2025-09-08。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. **编写 Bazel rules（三）：data 和 runfiles**
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

Bazel 有一个很方便的功能，可以简化 test 和 executable 的许多工作：通过 `data` attribute，让数据文件在运行时可用。你可能见过这样的 rule：

```bazel
cc_library(
    name = "server_lib",
    srcs = ["server.cc"],
    data = ["private.key"],
)
```

文件被列入 `data` attribute，或行为与 `data` 类似的 attribute 后，Bazel 会让通过 `bazel run` 启动的 executable 在运行时能够访问这些文件。这可用于 plugin、配置文件、certificate、key、resource 等许多场景。

本文会为一直在完善的 [rules_go_simple](https://github.com/jayconrod/rules_go_simple) 中的 `go_library` 和 `go_binary` rule 加上 `data` attribute。代码放在 [`v3` branch](https://github.com/jayconrod/rules_go_simple/tree/v3)。这次不会花太久，每个 rule 只需要增加几行代码。

## Data 和 runfiles

先给 rule 加上 `data` attribute。下面是 `go_library` 的新声明，`go_binary` 中的写法类似。

```bazel
go_library = rule(
    implementation = _go_library_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = [".go"],
            doc = "Source files to compile",
        ),
        "deps": attr.label_list(
            providers = [GoLibraryInfo],
            doc = "Direct dependencies of the library",
        ),
        "data": attr.label_list(
            allow_files = True,
            doc = "Data files available to binaries using this library",
        ),
        "importpath": attr.string(
            mandatory = True,
            doc = "Name by which the library may be imported",
        ),
        "_stdlib": attr.label(
            allow_single_file = True,
            default = "//internal:stdlib",
            doc = "Hidden dependency on the Go standard library",
        ),
    },
    doc = "Compiles a Go archive from Go sources and dependencies",
)
```

Bazel 用 [`runfiles`](https://docs.bazel.build/versions/master/skylark/lib/ctx.html#runfiles) 对象跟踪运行时应该提供的文件。调用 [`ctx.runfiles`](https://docs.bazel.build/versions/master/skylark/lib/ctx.html#runfiles) 可以创建新的 `runfiles` 对象。这个函数与 depset 很相似，都接收一个 direct file 列表和一个 transitive file 列表。

为了收集 `go_library` 的 runfiles，我们先添加一个 helper function，因为 `go_binary` 也要做同样的事。

```bazel
def _collect_runfiles(ctx, direct_files, indirect_targets):
    """Builds a runfiles object for the current target.

    Args:
        ctx: analysis context.
        direct_files: list of Files to include directly.
        indirect_targets: list of Targets to gather transitive runfiles from.
    Returns:
        A runfiles object containing direct_files and runfiles from
        indirect_targets. The files from indirect_targets won't be included
        unless they are also included in runfiles.
    """
    return ctx.runfiles(
        files = direct_files,
        transitive_files = depset(
            transitive = [target[DefaultInfo].default_runfiles.files for target in indirect_targets],
        ),
    )
```

在 `go_library` 中这样调用它：

```bazel
    runfiles = _collect_runfiles(
        ctx,
        direct_files = ctx.files.data,
        indirect_targets = ctx.attr.data + ctx.attr.deps,
    )
```

要让这些文件真正可用，还需要设置 rule 返回的 [`DefaultInfo`](https://docs.bazel.build/versions/master/skylark/lib/DefaultInfo.html) provider 中的 `runfiles` field。回想一下，`DefaultInfo` 用于列出 rule 生成的输出文件和 executable。

下面是 `go_library` 创建 `DefaultInfo` provider 的方式，`go_binary` 中同样采用类似写法。

```bazel
return [
    DefaultInfo(
        files = depset([archive]),
        runfiles = runfiles,
    ),
    ...
]
```

如果需要合并来自依赖的多个 `runfiles` 对象，可以调用 [`runfiles.merge`](https://bazel.build/rules/lib/builtins/runfiles.html#merge) 或 [`runfiles.merge_all`](https://bazel.build/rules/lib/builtins/runfiles.html#merge_all)。例如，在 provider 中返回 `runfiles` 对象时，可能会遇到这种需求。不过，在简单场景下，直接使用 `DefaultInfo` provider 的 `default_runfiles` field 就够了，上面的代码正是这样做的。

不要使用 `ctx.runfiles` 的 `collect_data` 和 `collect_default` 参数。这些 flag 会让 `ctx.runfiles` 自动从特定 attribute 中收集文件，但现在已经不推荐这样做。本教程的早期版本曾在这些 flag 被弃用之前使用过它们。

## 测试 data 和 runfiles

我们用一个依赖 library 的简单 binary 来测试新增的 runfiles 支持。Binary 和 library 各自有数据文件，test 会验证这些文件是否存在。

```bazel
sh_test(
    name = "data_test",
    srcs = ["data_test.sh"],
    args = ["$(location :list_data_bin)"],
    data = [":list_data_bin"],
)

go_binary(
    name = "list_data_bin",
    srcs = ["list_data_bin.go"],
    deps = [":list_data_lib"],
    data = ["foo.txt"],
)

go_library(
    name = "list_data_lib",
    srcs = ["list_data_lib.go"],
    data = ["bar.txt"],
    importpath = "rules_go_simple/tests/list_data_lib"
)
```

运行 `bazel test //tests/...` 即可执行这个 test。

## 跨平台访问 runfiles

应该用 library 来查找和打开 runfiles，尤其是在 test 中。在 Unix 上，Bazel 执行 binary 时会建立一棵 symbolic link tree，指向这个 binary 的 runfiles。如果代码始终只在 Unix 上运行，可以按 runfile 在 workspace 中的相对路径打开它。

但 Bazel 在 Windows 上处理 runfiles 的方式不同，因此这种做法通常不够稳妥。大约 2019 年以前的 Windows 版本要求管理员权限才能创建 symbolic link。即便现在，也需要先开启 Developer Mode，而开启它仍需要管理员权限。Windows 上的小文件操作，包括 symbolic link 操作，也格外慢。为避免这些问题，Bazel 使用了另一种 strategy：创建 manifest file，将逻辑上的 runfile path 映射到 Bazel cache 中真实文件的 absolute path。Test 运行时设置的 `RUNFILES_MANIFEST_FILE` environment variable 指向这个 manifest。通过 `bazel run` 运行 binary 时，没有变量指向 manifest，不过，在 binary 的初始 working directory 中应该能找到名为 `MANIFEST` 的文件。顺带一提，使用 Bazel flag `--enable_runfiles` 可以覆盖这种行为，强制使用 symbolic link。

如果所用语言已有 runfiles library，最好直接使用，不要自己解析 manifest file。Bazel 的 runfiles semantics 会随时间变化，Bzlmod 又带来了变化；使用 library 可以让代码继续正常工作。大多数语言都有这样的 library：

- C++：`@bazel_tools//tools/cpp/runfiles`
- Bash：`@bazel_tools//tools/bash/runfiles`
- Java：`@bazel_tools//tools/java/runfiles`
- Python：`@rules_python//python/runfiles`
- Go：`@io_bazel_rules_go//go/runfiles`
- Rust：`@rules_rust//tools/runfiles`

想进一步了解，可以观看 Fabian Meumertzheim 在 BazelCon 2022 的精彩演讲 [Runfiles and where to find them](https://www.youtube.com/watch?v=5NbgUMH1OGo)。
