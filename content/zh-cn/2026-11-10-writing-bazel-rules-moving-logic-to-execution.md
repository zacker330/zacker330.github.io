---
layout: post
title: "[译] 编写 Bazel rules（四）：将逻辑移到 execution phase"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-moving-logic-to-execution"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 4
original_url: "https://jayconrod.com/posts/109/writing-bazel-rules-moving-logic-to-execution"
original_title: "Writing Bazel rules: moving logic to execution"
original_date: 2018-12-26
original_updated: 2025-09-09
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: moving logic to execution](https://jayconrod.com/posts/109/writing-bazel-rules-moving-logic-to-execution)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2018-12-26，更新于 2025-09-09。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. **编写 Bazel rules（四）：将逻辑移到 execution phase**
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

本文会把新的逻辑放进 execution phase，进一步扩展这套 Bazel rules 的能力。跟着动手的读者可以在 [rules_go_simple](https://github.com/jayconrod/rules_go_simple) 的 [v4 branch](https://github.com/jayconrod/rules_go_simple/tree/v4) 找到新代码。

你可能还记得，Bazel 的工作分为[三个阶段](https://docs.bazel.build/versions/master/guide.html#phases)：

- **Loading phase：** Bazel 读取并求值 build file，找出用户要求构建的 target，并递归加载这些 target 的依赖所对应的 build file。这些工作在调用 Bazel 的机器上进行，target graph 会缓存在内存中。
- **Analysis phase：** Bazel 对 target 及其依赖的 rule implementation function 求值。Implementation function 声明待生成的文件、生成文件所需的 action，以及 action 的输入。和 loading phase 一样，这些工作也在调用 Bazel 的机器上完成，action graph 会缓存在内存中。
- **Execution phase：** Bazel 找出哪些文件已经过期，并执行生成这些文件所需的 action。Action 可以在本地 sandbox 中执行，也可以通过 execution service 远程执行。输出文件会缓存在本地，或存入 remote caching service。

Ruleset 作者可以为任意一个阶段编写代码，同一个问题也往往有多种解决办法。不过，execution phase 有许多优势。在这个阶段执行的代码可以完整地通过 I/O 访问源文件，因此能做更灵活的判断；可以用任意语言编写，因此可能比 Starlark 更快，也更灵活；工作还能分散到多台机器上执行，结果可以持久缓存，因此能让大型开发团队的构建更快。

一般来说，应该让 loading phase 和 analysis phase 中的 Starlark 代码尽量简单，尽可能把复杂逻辑移到 execution phase。

## 这次要做什么

本文会为 rules_go_simple 增加几项功能。

- 用 `go_test` rule 构建 Go test。这需要解析 test 源文件，并为 `main` package 生成代码。没有通用工具能直接做这件事，所以我们会自己写一个。
- 支持 [Go build constraints](https://pkg.go.dev/go/build#hdr-Build_Constraints)，通过 `//go:build linux` 之类的注释筛选面向特定平台的源文件。
- 用 Go 重写生成 importcfg 的代码。Compiler 和 linker 用这些文件，将 import string 映射到编译后的 package 文件。用 Bash 生成它们很麻烦，我们更愿意用能力更强的语言。

实现这些功能需要读取源文件，所以我们会把工作放进一个新编写的 Go builder binary，让它在 execution phase 运行。所有 action 都通过这个 builder binary 执行。当然，也可以为每个 action 分别写一个 binary，不过，合用一个通常更好。对使用者来说，只构建一个 binary 更快；而它的变化还没有频繁到需要认真考虑局部 cache invalidation 的程度。

为了编译和链接 builder，我们会定义一个新的 internal rule，叫作 `go_tool_binary`。之所以需要它，是因为 `go_binary` 将依赖 builder，而我们不能用 builder 来构建它自己。

最后，更新 `go_binary` 和 `go_library`，并引入 `go_test`，让它们都依赖 builder。

## Builder binary

Builder binary 中有不少逻辑，大部分与 Go 程序的构建方式有关，这里不展开介绍。感兴趣的话，可以查看 [//internal/builder](https://github.com/jayconrod/rules_go_simple/tree/v4/internal/builder) 中的源码。

[builder.go](https://github.com/jayconrod/rules_go_simple/blob/v4/internal/builder/builder.go) 定义了 `main` 函数。`main` 检查第一个 command-line argument，也就是 verb，并据此调用相应的函数。Verb 可以是 `compile`、`link` 或 `test`。

`compile` command 将一组源文件编译成 package 文件。首先，按照 Go build constraints 筛掉属于其他平台的源文件。Go 已经有 standard package 处理这件事，不需要再写 parser。然后，列出 standard library 中的 package，并加上当前待编译 package 的 direct dependencies，也就是 `deps` attribute 中的内容，写出 importcfg 文件。最后调用 Go compiler。

`link` command 将一组编译后的 archive 文件链接成 executable。过程很简单：将 `main` package 直接或间接 import 的每个 archive 文件的信息写进 importcfg，再对 `main` package 文件调用 Go linker。

`test` command 更复杂。Go test 应该放在以 `_test.go` 结尾的文件中。这些文件可以与被测试的 library 一起编译，从而访问 private symbol，也可以单独编译。随后生成一个 test main 源文件，负责初始化 test framework，并调用每个 test function。Test main 文件会编译成第三个 archive。`test` action 负责安排好这些步骤，按需写出 importcfg 文件，并调用 compiler 和 linker。

## Internal rules

为了编译和链接 builder binary，我们在 [rules.bzl](https://github.com/jayconrod/rules_go_simple/blob/v4/internal/rules.bzl) 中新增 `go_tool_binary` rule。它负责把一个小程序编译并链接成 binary，不支持 standard library 之外的依赖，也不支持 build constraints，不过，对小工具来说已经够用。

```bazel
def _go_tool_binary_impl(ctx):
    # Declare the output executable file.
    executable = ctx.actions.declare_file(ctx.label.name)

    # List other input files needed.
    stdlib_dir = ctx.file._stdlib
    inputs = [stdlib_dir] + ctx.files.srcs

    # Run the script to compile and link the binary. The order of arguments
    # is important!
    arguments = ([executable.path, "go", stdlib_dir.path] +
                 [src.path for src in ctx.files.srcs])
    ctx.actions.run(
        mnemonic = "GoToolBinary",
        executable = ctx.executable._script,
        arguments = arguments,
        inputs = inputs,
        outputs = [executable],
        use_default_shell_env = True,
    )

    return [DefaultInfo(
        files = depset([executable]),
        executable = executable,
    )]

go_tool_binary = rule(
    implementation = _go_tool_binary_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = [".go"],
            mandatory = True,
            doc = "Source files to compile for the main package of this binary",
        ),
        "_stdlib": attr.label(
            default = "//internal:stdlib",
            allow_single_file = True,
            doc = "Hidden dependency on the Go standard library",
        ),
        "_script": attr.label(
            allow_single_file = True,
            executable = True,
            cfg = "exec",
            default = ":tool_binary.sh",
            doc = "Script that compiles and links a builder binary",
        ),
    },
    doc = """Builds an executable program for the Go toolchain.

go_tool_binary is a simple version of go_binary. It is separate from go_binary
because go_binary depends on the Go toolchain, and the toolchain uses a binary
built with this rule to do most of its work.

This rule does not support dependencies or build constraints. All source files
will be compiled, and they may only depend on the standard library.
""",
    executable = True,
)
```

和 `go_binary` 一样，这里设置了 `executable = True`，Bazel 因此要求 `go_tool_binary` 生成一个 executable。

你可能注意到了 `_stdlib` attribute，它也出现在 `go_binary` 和 `go_library` 中。名称以 `_` 开头的 attribute 是 hidden attribute，必须有 `default` 值，不能在 build file 中显式设置。这里的 `_stdlib` 指向 `//internal:stdlib`，这个 target 使用 `go_stdlib` rule 编译 Go standard library。原本这个系列没有它，但从 Go 1.20 开始，Go distribution archive 不再包含预编译的 standard library，Bazel rule 也就不能再假定编译后文件的位置，所以必须补上。`go_stdlib` 用 Bash script 实现，是其他所有编译和链接 Go 代码的 rule 的 implicit dependency。

`go_tool_binary` 同样用 Bash script 实现，不过调用脚本的是 `ctx.actions.run`，而非 `ctx.actions.run_shell`。为了简洁，这里不贴出完整脚本。要注意，`go_tool_binary` 会在 `//internal` package 之外使用，因此需要在 `internal/BUILD.bazel` 中加入下面这段代码：

```bazel
# An exports_files declaration makes this source file available in other
# packages. It's an implicit dependency of go_tool_binary.
exports_files(
    ["tool_binary.sh"],
    visibility = ["//visibility:public"],
)
```

最后编写 [//internal/builder:BUILD.bazel](https://github.com/jayconrod/rules_go_simple/blob/v4/internal/builder/BUILD.bazel)，其中只包含新 rule 的一个实例。

```bazel
load("//internal:rules.bzl", "go_tool_binary")

# builder is a tool used to perform various tasks related to building Go code,
# such as compiling packages, linking executables, and generating
# test sources.
go_tool_binary(
    name = "builder",
    srcs = [
        "builder.go",
        "compile.go",
        "flags.go",
        "importcfg.go",
        "link.go",
        "sourceinfo.go",
        "test.go",
    ],
    visibility = ["//visibility:public"],
)
```

## 使用 builder

复杂的工作都已经放进 builder，`go_binary`、`go_library` 和 `go_test` 就可以简化了。它们只需要声明执行 builder command 的 action，并传入必要的 command-line argument。

下面是 [rules.bzl](https://github.com/jayconrod/rules_go_simple/blob/v4/internal/rules.bzl) 中的 `go_test` 定义。`go_binary` 和 `go_library` 的定义类似，这里就不贴了。

```bazel
go_test = rule(
    implementation = _go_test_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = [".go"],
            doc = ("Source files to compile for this test. " +
                   "May be a mix of internal and external tests."),
        ),
        "deps": attr.label_list(
            providers = [GoLibraryInfo],
            doc = "Direct dependencies of the test",
        ),
        "data": attr.label_list(
            allow_files = True,
            doc = "Data files available to this test",
        ),
        "importpath": attr.string(
            default = "",
            doc = "Name by which test archives may be imported (optional)",
        ),
        "_builder": attr.label(
            default = "//internal/builder",
            executable = True,
            cfg = "exec",
        ),
        "_stdlib": attr.label(
            default = "//internal:stdlib",
            allow_single_file = True,
            doc = "Hidden dependency on the Go standard library",
        ),
    },
    doc = """Compiles and links a Go test executable. Functions with names
starting with "Test" in files with names ending in "_test.go" will be called
using the go "testing" framework.""",
    test = True,
)
```

这里需要对 `_builder` 和 `_stdlib` 建立 implicit dependency。`_builder` 设置了 `cfg = "exec"`，这意味着 Bazel 会为 execution platform 构建它。Cross-compiling 时，execution platform 可能与 target platform 不同。另外，`go_test` 生成的 test 要由 Bazel 执行，因此需要设置 `test = True`。这个设置已隐含 `executable = True`，不用再单独设置。

Implementation 中只调用 `go_build_test`，由它承担主要工作：

```bazel
def _go_test_impl(ctx):
    executable = ctx.actions.declare_file(ctx.label.name)
    go_build_test(
        ctx,
        importpath = ctx.attr.importpath,
        srcs = ctx.files.srcs,
        stdlib = ctx.file._stdlib,
        builder = ctx.executable._builder,
        deps = [dep[GoLibraryInfo] for dep in ctx.attr.deps],
        out = executable,
        rundir = ctx.label.package,
    )

    runfiles = _collect_runfiles(
        ctx,
        direct_files = ctx.files.data,
        indirect_targets = ctx.attr.data + ctx.attr.deps,
    )
    return [DefaultInfo(
        files = depset([executable]),
        runfiles = runfiles,
        executable = executable,
    )]
```

我们把 `go_build_test` 与 `go_compile`、`go_link` 一起定义在 [actions.bzl](https://github.com/jayconrod/rules_go_simple/blob/v4/internal/actions.bzl) 中。

```bazel
def go_build_test(ctx, *, srcs, stdlib, builder, deps, rundir, importpath, out):
    """Compiles and links a Go test executable.

    Args:
        ctx: analysis context.
        srcs: list of source Files to be compiled.
        stdlib: a File for the compiled standard library directory.
        builder: an executable File for the builder tool.
        deps: list of GoLibraryInfo objects for direct dependencies.
        importpath: import path of the internal test archive.
        rundir: directory the test should change to before executing.
        out: output executable file.
    """
    direct_dep_infos = [d.info for d in deps]
    transitive_dep_infos = depset(transitive = [d.deps for d in deps]).to_list()
    inputs = (srcs +
              [stdlib] +
              [d.archive for d in direct_dep_infos] +
              [d.archive for d in transitive_dep_infos])

    args = ctx.actions.args()
    args.add("test")
    args.add("-stdlib", stdlib.path)
    args.add_all(direct_dep_infos, before_each = "-direct", map_each = _format_arc)
    args.add_all(transitive_dep_infos, before_each = "-transitive", map_each = _format_arc)
    if rundir != "":
        args.add("-dir", rundir)
    if importpath != "":
        args.add("-p", importpath)
    args.add("-o", out)
    args.add_all(srcs)

    ctx.actions.run(
        outputs = [out],
        inputs = inputs,
        executable = builder,
        arguments = [args],
        use_default_shell_env = True,
        mnemonic = "GoTest",
    )
```

和 `go_tool_binary` 一样，这里使用 [`ctx.actions.run`](https://bazel.build/rules/lib/builtins/actions#run)，而非 [`ctx.actions.run_shell`](https://bazel.build/rules/lib/builtins/actions#run_shell)。两个函数有许多相同的参数。`run` 告诉 Bazel 直接调用命令，`run_shell` 则通过 `sh -c` 调用 shell command。`run` 更高效，更不容易出错，因为不需要处理 quoting，也较少依赖具体 OS。因此，只要能用 `run`，就应该优先使用它。

我们用 [`Args`](https://docs.bazel.build/versions/master/skylark/lib/Args.html) 构造 argument list，这个对象由 [`ctx.actions.args`](https://docs.bazel.build/versions/master/skylark/lib/actions.html#args) 创建。与直接拼 string list 相比，`Args` 有几个好处。第一，更方便，不必自己将 `File` 转换成 string，也有好用的方法来格式化 option list。第二，将通过 [`ctx.actions.declare_directory`](https://docs.bazel.build/versions/master/skylark/lib/actions.html#declare_directory) 创建的目录传给 [`Args.add_all`](https://docs.bazel.build/versions/master/skylark/lib/Args.html#add_all) 时，目录中的文件会展开为独立的 argument，前提是 `expand_directories = True`，而这就是默认值。第三，给 `Args.add_all` 传入 `depset` 后，只有 action 真正执行时，Bazel 才会遍历这个 depset。Dependency graph 很大的构建可以因此获得性能收益。如果 action 命中了 cache，就没有必要构造它的 command line。

## 结语

这篇就讲到这里。我还是尽量把重点放在 Bazel rule 的基础机制上。如果想了解 Go 特有的细节，可以查看 builder 目录中的代码。[//tests](https://github.com/jayconrod/rules_go_simple/tree/v4/tests) 中有一些使用这些 Go rule 的例子。

归纳一下，Bazel rule 应该尽可能把工作放到 execution phase。Analysis phase 的职责是声明文件和 action，Starlark rule 应该用尽量少的逻辑完成这件事。如果发现 rule 声明了不必要的文件，例如内部 temporary file，或不必要的 action，例如总是一起执行的多个 action，就试着把它们合并。简化 Starlark rule 可以加快 analysis，也能更好地利用 remote caching 和 execution 提供的并行能力。
