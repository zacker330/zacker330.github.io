---
layout: post
title: "[译] 编写 Bazel rules（一）：simple binary rule"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-simple-binary-rule"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 1
original_url: "https://jayconrod.com/posts/106/writing-bazel-rules-simple-binary-rule"
original_title: "Writing Bazel rules: simple binary rule"
original_date: 2018-07-31
original_updated: 2025-09-08
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: simple binary rule](https://jayconrod.com/posts/106/writing-bazel-rules-simple-binary-rule)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2018-07-31，更新于 2025-09-08。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. **编写 Bazel rules（一）：simple binary rule**
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

Bazel 是 Google 开发的开源 build tool。它很适合大型项目，原因包括高度并行的 remote build 和 execution、remote caching、对多种语言的成熟支持，以及扩展到数十亿行代码规模的 monorepo 的能力。

与 Make 这类简单的 build tool，或 Maven 这类面向特定语言的工具相比，Bazel 的学习曲线可能相当陡峭，尤其是你想扩展 Bazel、让它做一些新事情的时候。

这是编写 Bazel rules 系列教程的第一篇。如果你想让 Bazel 支持一种新的语言或工具，可以从这里开始。本文会编写一个 Bazel rule，用来构建一个简单的 Go binary。后续文章还会介绍 library、test、toolchain、module 等内容。

我假定你已经了解 Bazel 的基本概念。如果你刚接触 Bazel，可以先看 [Getting Started](https://bazel.build/start)，按自己熟悉的语言完成其中的 _First build guides_。

## Bazel 如何工作

这个系列的每篇文章都会介绍一些 Bazel 的工作原理。既然这是第一篇，我们就从基础讲起。

### Starlark

Starlark 是 Bazel 的配置和扩展语言。可以把它看成去掉了一些高级特性的 Python：Starlark 没有 class、exception 或 generator，module system 也很不一样。Starlark 在运行时禁止 recursion，并且只允许遍历大小固定的数据结构，以此避免成为 Turing complete 的语言。完整的[差异列表](https://docs.bazel.build/versions/master/skylark/language.html#differences-with-python)可以在 [Bazel 文档](https://docs.bazel.build/versions/master/skylark/language.html)和 [language spec](https://docs.bazel.build/versions/master/skylark/spec.html) 中找到。这些限制可以防止 Starlark 扩展变得过于复杂；大部分复杂逻辑应该交给外部工具处理。

**题外话：** Starlark 也可以脱离 Bazel 单独使用。Facebook 的 Buck build tool 同样使用 Starlark。Alan Donovan 在 [GothamGo 2017 的 Starlark 演讲](https://www.youtube.com/watch?v=9P_YKVhncWI)中，举了用 Starlark 配置 Web server 的例子。他还发布了一个[用 Go 编写、可嵌入其他程序的 Starlark interpreter](https://github.com/google/skylark)。

### 基本概念：rule、package 等

要让 Bazel 构建东西，需要编写 build file，文件名为 `BUILD` 或 `BUILD.bazel`。例如：

```bazel
load("@rules_go//go:def.bzl", "go_binary", "go_library", "go_test")

go_library(
    name = "fetch_repo_lib",
    srcs = [
        "fetch_repo.go",
        "module.go",
        "vcs.go",
    ],
    importpath = "github.com/bazelbuild/bazel-gazelle/cmd/fetch_repo",
    visibility = ["//visibility:private"],
    deps = ["@org_golang_x_tools_go_vcs//:vcs"],
)

go_binary(
    name = "fetch_repo",
    embed = [":fetch_repo_lib"],
    visibility = ["//visibility:public"],
)

go_test(
    name = "fetch_repo_test",
    srcs = ["fetch_repo_test.go"],
    embed = [":fetch_repo_lib"],
    deps = ["@org_golang_x_tools_go_vcs//:vcs"],
)
```

一个 build file 包含若干 _target_，写法是 Starlark function call。这种语法是 declarative 的：你描述想构建什么，不用说明具体怎么构建。上例定义了一个 Go library（`"fetch_repo_lib"`），它包含几个源文件；一个 binary（`"fetch_repo"`）由这个 library 构建而来；还有一个 test（`"fetch_repo_test"`），由这个 library 和另一个源文件（`"fetch_repo_test.go"`）构建而来。

定义 target 时调用的东西称为 _rule_，上例中的 `go_binary` 就是其中之一。一个 rule 有若干 _attribute_，例如 `srcs` 和 `deps`，用来描述 target。它还有一个 implementation function，稍后会介绍。这个函数告诉 Bazel：构建 target 时需要运行哪些命令，以及预期得到哪些输出文件。

每个 build file 都隐式定义了一个 Bazel package。一个 _package_ 包括 build file 中声明的 target，以及该 package 目录和子目录中的所有文件，但不包括其他 package 的子目录中定义的 target 和文件。Visibility 限制通常作用于 package 这一层；glob，也就是匹配源文件的通配符模式，也只匹配当前 package 中的文件。通常一个目录对应一个 package，但并非总是如此。

Target 和文件使用 _label_ 命名，例如 `"@rules_go//go:def.bzl"`。一个 label 有三个部分：repository 名称（`rules_go`）、package 名称（`go`），以及文件或 target 名称（`def.bzl`）。引用同一个 repository 或 package 中的内容时，可以省略对应的 repository 名称和 package 名称。

### Loading、analysis 和 execution phases

Bazel 分三个阶段构建 target：loading、analysis 和 execution。实际过程更复杂一些，不过，编写简单的 rule 时，了解这些就够了。

在 _loading phase_，Bazel 读取并求值 build file，建立 target 及其依赖的 graph。例如，构建上面的 `fetch_repo_test` 时，Bazel 会建立一个包含 `fetch_repo_test` 节点的 graph。这个节点分别通过 `srcs`、`embed` 和 `deps` 这些 edge，依赖 `fetch_repo_test.go`、`:fetch_repo_lib` 和 `@org_golang_x_tools_go_vcs//:vcs`。

在 _analysis phase_，Bazel 对 target graph 中的 rule 求值。每个 rule 的 implementation function 会声明输出文件，以及生成这些文件的 action。这个阶段得到的是 file-action graph。

在 _execution phase_，Bazel 运行 file-action graph 中生成输出文件所需的 action。Bazel 有多种运行 action 的 strategy。默认情况下，action 在 sandbox 中运行，只能看到已声明的输入，其他文件会被隐藏。这样更容易实现 hermetic build，因为构建过程不容易意外依赖那些在不同机器上有所差异的系统文件。Bazel 也可以在 remote build server 上运行 action，这种环境会自动提供相应的隔离。

要注意，rule 在 loading phase 和 analysis phase 不能直接执行任何 I/O。Rule 只是告诉 Bazel 应该执行什么命令来构建 target。只有命令本身才能在 execution phase 读写文件。这意味着 rule 无法根据源文件的内容作决定。Build file 必须显式声明依赖，rule 不能在构建过程中自动发现依赖。

## 建立 `rules_go_simple`

今天的原理就讲到这里，接下来看代码。我们要编写 `rules_go_simple`，也就是 [rules_go](https://github.com/bazel-contrib/rules_go) 的简化版。不懂 Go 也不用担心，它只是用来举例的。今天我们不会编写任何 Go 代码。

我在 [github.com/jayconrod/rules_go_simple](https://github.com/jayconrod/rules_go_simple) 建了一个示例 repository。本文使用 [`v1` branch](https://github.com/jayconrod/rules_go_simple/tree/v1)。后面的文章会在版本号更高的 branch 中逐步加入新功能。

首先需要一个 `MODULE.bazel` 文件。每个 Bazel 项目的根目录都应该有这个文件。`MODULE.bazel` 声明构建和测试项目所需的其他 Bazel module，也就是 external dependency。本例只有一个依赖 `bazel_skylib`。这个 module 提供了几个用于编写和测试 rule 的 Starlark library，我们会用它来给 shell command 中的字符串加上正确的 quoting。

下面是 [`MODULE.bazel`](https://github.com/jayconrod/rules_go_simple/blob/v1/MODULE.bazel)，已省略大部分注释。

```bazel
module(name = "rules_go_simple")

# bazel_skylib is a common library for writing and testing Bazel rules.
bazel_dep(name = "bazel_skylib", version = "1.7.1")
```

声明一个 repository 后，Bazel 会下载它的 `MODULE.bazel` 文件，但不会下载源代码。只有真正用到 repository 中的内容时，Bazel 才会下载它。

第一次运行 build command 时，Bazel 会生成 `MODULE.bazel.lock`，这是一个 JSON 文件，包含一些依赖相关的 metadata。应该把它提交到 version control 中，不过不需要手动编辑。对于 `bazel_skylib`，其中包含 `MODULE.lock` 和 `source.json` 的 SHA256。记录这些 hash 很重要，可以用于发现 module 后来是否遭到篡改；Bazel module 的某个版本一旦发布，就不能再修改。运行 `bazel mod tidy` 可以完整填充 `MODULE.bazel.lock`，并删除不再需要的 metadata。

### 声明 `go_binary` rule

为了定义 binary rule，我们新建 [`internal/rules.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v1/internal/rules.bzl) 文件，先写下这样的声明：

```bazel
go_binary = rule(
    implementation = _go_binary_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = [".go"],
            doc = "Source files to compile for the main package of this binary",
        ),
        "_stdlib": attr.label(
            allow_single_file = True,
            default = "//internal:stdlib",
        ),
    },
    doc = "Builds an executable program from Go source code",
    executable = True,
)
```

阅读时可以参照 Bazel 的 [`rule`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#rule) 和 [`attr`](https://docs.bazel.build/versions/master/skylark/lib/attr.html) 文档。这里内容不少，逐项来看。

- 将 `rule` 函数的返回值赋给 `go_binary`，就定义了一个名为 `go_binary` 的新 rule。Rule 是一个 callable value，但它实际上不是 function。
- `go_binary` 的实现是 `_go_binary_impl` 函数，也就是这里传入的第一个参数。对于参与本次构建的每个 `go_binary` target，Bazel 都会在 analysis phase 调用这个函数。Implementation function 负责声明输出文件和 action。
- `go_binary` 有一个名为 `srcs` 的 attribute，类型是 [`label_list`](https://docs.bazel.build/versions/master/skylark/lib/attr.html#label_list)。`srcs` 可以列出若干以 `".go"` 结尾的文件。
- `go_binary` 必须生成一个 executable file。
- `rule` constructor 有一个 `doc` 参数，`attr.label_list` 等 attribute constructor 也一样。这样就能把文档写在结构明确的位置。[Stardoc](https://github.com/bazelbuild/stardoc) 可以根据这些参数生成文档。
- `_stdlib` 是一个 hidden attribute，名称以 `_` 开头。它指向 `//internal:stdlib` target，用来编译 Go standard library。这是后来补进本系列的内容；在 Go 1.20 之前，standard library 会预先编译好，可以假定它已随 Go 安装。现在不必太在意这些细节，介绍 toolchain 时还会讲到。

所有 rule 都自动支持一组 [common attributes](https://docs.bazel.build/versions/master/be/common-definitions.html#common-attributes)，例如 `name`、`visibility` 和 `tags`，不需要再显式声明。

## 实现 `go_binary`

接下来看 implementation function。

```bazel
def _go_binary_impl(ctx):
    # Declare an output file for the main package and compile it from srcs.
    main_archive = ctx.actions.declare_file("{name}.a".format(name = ctx.label.name))
    go_compile(
        ctx,
        srcs = ctx.files.srcs,
        importpath = "main",
        stdlib = ctx.file._stdlib,
        out = main_archive,
    )

    # Declare an output file for the executable and link it.
    executable = ctx.actions.declare_file(ctx.label.name)
    go_link(
        ctx,
        main = main_archive,
        stdlib = ctx.file._stdlib,
        out = executable,
    )

    # Return the DefaultInfo provider. This tells Bazel what files should be
    # built when someone asks to build a go_binary rule. It also says which
    # file is executable (in this case, there's only one).
    return [DefaultInfo(
        files = depset([executable]),
        executable = executable,
    )]
```

Implementation function 只有一个参数，也就是 [`ctx`](https://docs.bazel.build/versions/master/skylark/lib/ctx.html) 对象。它提供访问 rule attribute、声明文件和 action 的 API，也暴露了不少有用的 metadata。

首先编译 `main` package。不熟悉 Go 的读者可以把 package 理解为 compilation unit：多个 `.go` 源文件可以编译成一个 `.a` package 文件。我们用 [`ctx.actions.declare_file`](https://docs.bazel.build/versions/master/skylark/lib/actions.html#declare_file) 声明 `main.a` 输出文件，这个调用返回一个 [`File`](https://docs.bazel.build/versions/master/skylark/lib/File.html) 对象。然后调用 `go_compile` 声明 compile action，稍后会介绍它。

接着，将 `main.a` 链接成独立的 executable。先声明 executable 文件，再调用 `go_link`；这个函数也会在后面定义。

最后，返回一个 provider 列表，告诉 Bazel 刚才做了什么。Provider 是 rule 返回的 [`struct`](https://docs.bazel.build/versions/master/skylark/lib/struct.html) 值，携带其他 rule 和 Bazel 本身需要的信息。[`DefaultInfo`](https://docs.bazel.build/versions/master/skylark/lib/DefaultInfo.html) 是一种特殊的 provider，所有 rule 都应该返回它。这里保存了两项有用的信息。`files` 是一个 [`depset`](https://docs.bazel.build/versions/master/skylark/lib/depset.html)，关于 depset 后面再讲。它列出其他 rule 依赖当前 rule，或有人对当前 rule 运行 `bazel build` 时应该构建的文件。没人关心 `main.a`，所以这里只返回 binary 文件。`executable` 则指向 executable 文件；对这个 rule 运行 `bazel run` 时，Bazel 应该执行的就是它。

## `go_compile` 和 `go_link` actions

我把 `go_compile` 和 `go_link` action 定义在了单独的函数中。它们完全可以直接写进上面的 rule，但 action 经常需要在多个 rule 之间复用。后面定义 `go_library` 和 `go_test` 时，还需要编译更多 package，并链接一种新的 binary。我们不能在这些 rule 中调用 `go_binary`，所以，把 action 提取到 [`actions.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v1/internal/actions.bzl) 的函数中很合适。

下面是 `go_compile`。

```bazel
def go_compile(ctx, *, srcs, importpath, stdlib, out):
    """Compiles a single Go package from sources.

    Args:
        ctx: analysis context.
        srcs: list of source Files to be compiled.
        importpath: the path other libraries may use to import this package.
        stdlib: a File for the compiled standard library directory.
        out: output .a File.
    """

    cmd = r"""
    importcfg=$(mktemp)
    pushd {stdlib} >/dev/null
    for file in $(find -L . -type f); do
      without_suffix="${{file%.a}}"
      pkg_path="${{without_suffix#./}}"
      abs_file="$PWD/$file"
      printf "packagefile %s=%s\n" "$pkg_path" "$abs_file" >>"$importcfg"
    done
    popd >/dev/null
    go tool compile -o {out} -p {importpath} -importcfg "$importcfg" -- {srcs}
    """.format(
        stdlib = shell.quote(stdlib.path),
        out = shell.quote(out.path),
        importpath = shell.quote(importpath),
        srcs = " ".join([shell.quote(src.path) for src in srcs]),
    )
    ctx.actions.run_shell(
        mnemonic = "GoCompile",
        outputs = [out],
        inputs = srcs + [stdlib],
        command = cmd,
        env = {"GOPATH": "/dev/null"},  # suppress warning
        use_default_shell_env = True,
    )
```

这个函数先构造一条调用 compiler 的 Bash command，再调用 [`ctx.actions.run_shell`](https://docs.bazel.build/versions/master/skylark/lib/actions.html#run_shell)，声明一个执行该命令的 action。`run_shell` 接收命令本身、需要在 sandbox 中提供的输入文件列表，以及 Bazel 预期得到的输出文件列表。不必太纠结这段 Bash command，它主要处理 Go 特有的细节，后面的文章会把它整理干净。

`go_link` 的写法类似。

```bazel
def go_link(ctx, *, main, stdlib, out):
    """Links a Go executable.

    Args:
        ctx: analysis context.
        main: archive file for the main package.
        stdlib: a File for the compile standard library directory.
        out: output executable file.
    """
    cmd = r"""
    importcfg=$(mktemp)
    pushd {stdlib} >/dev/null
    for file in $(find -L . -type f); do
      without_suffix="${{file%.a}}"
      pkg_path="${{without_suffix#./}}"
      abs_file="$PWD/$file"
      printf "packagefile %s=%s\n" "$pkg_path" "$abs_file" >>"$importcfg"
    done
    popd >/dev/null
    go tool link -o {out} -importcfg "$importcfg" -- {main}
    """.format(
        stdlib = shell.quote(stdlib.path),
        main = shell.quote(main.path),
        out = shell.quote(out.path),
    )
    ctx.actions.run_shell(
        mnemonic = "GoLink",
        outputs = [out],
        inputs = [main, stdlib],
        command = cmd,
        env = {"GOPATH": "/dev/null"},  # suppress warning
        use_default_shell_env = True,
    )
```

为了不让这篇文章长得太离谱，我选择了简单的写法，没有完全按照规范的方式来做。一般来说，我不建议在 Bazel action 中使用任何 Bash command，原因有下面几个。

- 很难写出 portable command。macOS 和 Linux 上的大多数 shell command 版本不同，flag 也不一样。在 Windows 上，还得全部改写成 PowerShell 或 Batch。
- 很难处理好 quoting 和 escaping。一定要用 `@bazel_skylib` 提供的 [`shell.quote`](https://github.com/bazelbuild/bazel-skylib/blob/main/docs/shell_doc.md#shellquote)。
- 不能假定 host environment 已安装大多数命令。本文假定 `go` 已安装，但通常不应该依赖这一点，后面的文章会解决这个问题。
- 为了让 action 尽量与 host environment 隔离，Bazel 会清除大部分 environment variable，并通过 sandbox 隐藏文件。为了让上面的代码工作，我们设置了 `use_default_shell_env = True`，将 `PATH` 和少数其他 environment variable 传给 action。这有一个很大的缺点：`PATH` 一变，cache 就会失效，所有内容都得重新构建。

更好的做法是用 Bazel 编译工具，再使用这些工具，而不是编写 Bash command。这样就可以用自己选择的语言编写更复杂、也更 hermetic 的 action。

## 暴露 public interface

把所有 public symbol 的声明放在一个文件中很有用。这样重构 rule 时，就不需要让使用者更新项目中的 `load` statement。`load` statement 会将其他 `.bzl` 文件中的 public symbol 导入当前文件，因此，只需创建一个文件，加载所有 public symbol 就行了，这个文件就是 [def.bzl](https://github.com/jayconrod/rules_go_simple/blob/v1/def.bzl)。

```bazel
load("//internal:rules.bzl", _go_binary = "go_binary")

go_binary = _go_binary
```

在很早的 Bazel 版本中，只要在 `.bzl` 文件中加载一个 symbol，其他文件就能继续加载它。现在的版本要求先定义 symbol，才能让其他文件加载。把 public definition 放在一个文件中仍然是好习惯，只是需要多做一步。上面的代码先把内部的 `go_binary` 加载为 `_go_binary`，再重新定义为 `go_binary`。

## 测试 `go_binary` rule

要测试 `go_binary`，可以定义一个 `sh_test` rule，运行 `go_binary` rule 生成的程序，并检查输出。下面是 build file [`tests/BUILD.bazel`](https://github.com/jayconrod/rules_go_simple/blob/v1/tests/BUILD.bazel)：

```bazel
load("//:def.bzl", "go_binary")

sh_test(
    name = "hello_test",
    srcs = ["hello_test.sh"],
    args = ["$(rootpath :hello)"],
    data = [":hello"],
)

go_binary(
    name = "hello",
    srcs = [
        "hello.go",
        "message.go",
    ],
)
```

这里的 `go_binary` 有两个源文件，分别是 `hello.go` 和 `message.go`。它只输出 `"Hello, world!"`。Test 通过 `data` 依赖 `hello` binary，因此运行 test 时，Bazel 会构建 `hello`，并让 test 能够访问它。为了不在 test 中写死 binary 的路径，我们把路径作为参数传入。具体机制见 [Predefined source/output path variables](https://bazel.build/reference/be/make-variables#location)。

下面是 test script：

```bash
#!/bin/bash

set -euo pipefail

program="$1"
got=$("$program")
want="Hello, world!"

if [ "$got" != "$want" ]; then
  cat >&2 <<EOF
got:
$got

want:
$want
EOF
  exit 1
fi
```

运行 `bazel test //tests:hello_test` 就能试一试。

对于更复杂的 rule，Skylib 还提供了 [`unittest` module](https://github.com/bazelbuild/bazel-skylib/blob/main/docs/unittest_doc.md)、[`build_test`](https://github.com/bazelbuild/bazel-skylib/blob/main/docs/build_test_doc.md) 和 [`analysis_test`](https://github.com/bazelbuild/bazel-skylib/blob/main/docs/analysis_test_doc.md) rule。不过，目前没有统一的 framework 来运行那些需要调用 Bazel 的 end-to-end tests。
