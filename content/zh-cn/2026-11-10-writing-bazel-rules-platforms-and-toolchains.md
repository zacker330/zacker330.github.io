---
layout: post
title: "[译] 编写 Bazel rules（六）：platform 和 toolchain"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-platforms-and-toolchains"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 6
original_url: "https://jayconrod.com/posts/111/writing-bazel-rules-platforms-and-toolchains"
original_title: "Writing Bazel rules: platforms and toolchains"
original_date: 2019-12-07
original_updated: 2025-09-10
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: platforms and toolchains](https://jayconrod.com/posts/111/writing-bazel-rules-platforms-and-toolchains)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2019-12-07，更新于 2025-09-10。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. **编写 Bazel rules（六）：platform 和 toolchain**
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

Bazel 最重要的优势之一，是能将构建与 host system 隔离。这使 reproducible build 和 remote execution 成为可能，也让 Bazel 能扩展到巨型项目。但隔离并不完全自动：host platform、execution platform 和 target platform 可能各不相同，rule 必须与 Bazel 配合，确保使用正确的工具。

[上一篇文章](/zh-cn/writing-bazel-rules-repository-rules/)定义了一个 repository rule，用来下载并校验 Go toolchain。这次会让这套[简单的 rules](https://github.com/jayconrod/rules_go_simple) 使用它。完成后，rule 将几乎完全不再依赖 host system，使用者无需自行安装 Go，就能 checkout 并构建 Go 项目。

## 基本概念

看代码之前，先过一遍 platform 和 toolchain 的术语。这次概念不少，也可以同时阅读官方的 [Platforms](https://docs.bazel.build/versions/master/platforms.html) 和 [Toolchains](https://docs.bazel.build/versions/master/toolchains.html) 文档。

_Platform_ 描述软件可以在哪里运行，使用 [`platform`](https://docs.bazel.build/versions/master/be/platform.html#platform) rule 定义。_Host platform_ 是 Bazel 自身运行的平台。_Execution platform_ 是 action 运行的平台，通常与 host platform 相同，但使用 remote execution 时可能不同。_Target platform_ 是待构建的软件将要运行的平台，默认也与 host platform 相同，不过 cross-compiling 时可以不同。

Platform 由一组 constraint value 描述，这些值通过 [`constraint_value`](https://docs.bazel.build/versions/master/be/platform.html#constraint_value) rule 定义。一个 _constraint value_ 表示关于 platform 的某个事实，例如 CPU 是 x86_64，或 OS 是 Linux。[`platforms`](https://registry.bazel.build/modules/platforms) module 已经定义了不少 constraint value。Bazel 本身也依赖这个 module，不过，如果你的项目用到了它，仍应该在 `MODULE.bazel` 中用 `bazel_dep` 自行声明依赖，以得到可预期的 minimum version。运行 `bazel query @platforms//...` 可以列出其中的 constraint。也可以定义自己的 constraint。

_Constraint setting_ 是 constraint value 的分类。对于同一个 platform，一个 setting 中最多只能有一个 value 成立。Constraint setting 通过 [`constraint_setting`](https://docs.bazel.build/versions/master/be/platform.html#constraint_setting) rule 定义。最常需要关注的是 `@platforms//os:os` 和 `@platforms//cpu:cpu`，当然也可以自定义。

_Toolchain_ 是一种特殊的 target，通过 [`toolchain`](https://docs.bazel.build/versions/master/be/platform.html#toolchain) rule 定义。它将一个 toolchain implementation 与 target platform、execution platform 各自的一组 constraint value 关联起来。

_Toolchain type_ 是通过 `toolchain_type` rule 定义的 target，它的名称标识一类 toolchain。

_Toolchain implementation_ 是代表实际 toolchain 的 target，其中列出 toolchain 包含的文件，例如 compiler 和 standard library，以及使用 toolchain 所需的代码。Toolchain implementation 必须返回 [`ToolchainInfo`](https://docs.bazel.build/versions/master/skylark/lib/ToolchainInfo.html) provider。

一下子讲了这么多，它们到底如何配合？

定义 toolchain 时，首先需要声明 `toolchain_type` target。它只是一个唯一的 symbol。

实际的 toolchain 通过指向 implementation 的 `toolchain` target 定义。这里会用 `go_toolchain` rule 实现它，也可以使用任何返回 `ToolchainInfo` provider 的 rule。

Rule 可以在 [`rule`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#rule) 声明中设置 `toolchains` 参数，按 type 请求 toolchain。之后，rule implementation 就能通过 [`ctx.toolchains`](https://docs.bazel.build/versions/master/skylark/lib/ctx.html#toolchains) 访问它。

使用者在 `MODULE.bazel` 中调用 [`register_toolchains`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#register_toolchains)，或在 command line 中传入 `--extra_toolchains` flag，注册想使用的 toolchain。

最后，Bazel 开始构建时，会检查 execution platform 和 target platform 的 constraint，选出一组与这些 constraint 兼容的 toolchain，再将它们的 `ToolchainInfo` 对象提供给请求这些 toolchain 的 rule。

……

都明白了吗？其实，我也不确定自己是不是完全明白。这个系统设计得很漂亮，但确实不容易理解。如果想看 Bazel 如何选择或排除已注册的 toolchain，可以使用 `--toolchain_resolution_debug` flag。

理解它的关键，是把 Bazel toolchain 看作一个动态的 dependency injection system。如果用过 [Dagger](https://github.com/google/dagger) 或 [Guice](https://github.com/google/guice)，你会发现概念很相似。Toolchain type 像 interface，toolchain 像带 `@Provides` annotation 的 static method，需要 toolchain 的 rule 则像带 `@Inject` annotation 的 constructor。系统依据 execution platform 和 target platform 的 constraint value，为每个需要注入的 interface 自动找到合适的 implementation。

## 将 rule 迁移到 toolchain

现在开始在 [`rules_go_simple`](https://github.com/jayconrod/rules_go_simple) 中使用 toolchain。代码位于 [`v5` branch](https://github.com/jayconrod/rules_go_simple/tree/v5)。

首先声明 `toolchain_type`。Rule 可以通过 label `@rules_go_simple//:toolchain_type` 请求它。

```bazel
toolchain_type(
    name = "toolchain_type",
    visibility = ["//visibility:public"],
)
```

`toolchain_type` 本质上相当于 interface，因此应该写清楚这个 interface 能做什么。Starlark 是 dynamically typed language，没有地方可以正式声明所需的 method 或 field name。我在 [`providers.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v5/internal/providers.bzl) 中声明了一个 dummy provider 来写文档，也可以写在 README，或项目中其他合适的地方。

接着创建 toolchain implementation rule，名为 `go_toolchain`。

```bazel
def _go_toolchain_impl(ctx):
    # Find important files and paths.
    go_cmd = find_go_cmd(ctx.files.tools)
    env = {"GOROOT": paths.dirname(paths.dirname(go_cmd.path))}

    # Return a ToolchainInfo provider. This is the object that rules get
    # when they ask for the toolchain.
    return [platform_common.ToolchainInfo(
        # Functions that generate actions. Rules may call these.
        # This is the public interface of the toolchain.
        compile = go_compile,
        link = go_link,
        build_test = go_build_test,

        # Internal data. Contents may change without notice.
        # Think of these like private fields in a class. Actions may use these
        # (they are methods of the class) but rules may not (they are clients).
        internal = struct(
            go_cmd = go_cmd,
            env = env,
            builder = ctx.executable.builder,
            tools = ctx.files.tools,
            stdlib = ctx.file.stdlib,
        ),
    )]

go_toolchain = rule(
    implementation = _go_toolchain_impl,
    attrs = {
        "builder": attr.label(
            mandatory = True,
            executable = True,
            cfg = "exec",
            doc = "Executable that performs most actions",
        ),
        "tools": attr.label_list(
            mandatory = True,
            doc = "Compiler, linker, and other executables from the Go distribution",
        ),
        "stdlib": attr.label(
            mandatory = True,
            allow_single_file = True,
            cfg = "target",
            doc = "Package files for the standard library compiled by go_stdlib",
        ),
    },
    doc = "Gathers functions and file lists needed for a Go toolchain",
)
```

`go_toolchain` 是一个返回 `ToolchainInfo` provider 的普通 rule。其他 rule 请求 toolchain 时，会得到其中一个 struct。它没有必填的 field，可以放入任意内容。这里放了三个“method”，实际上只是 function，分别是 `compile`、`link` 和 `build_test`。它们对应 rule 需要创建的 action，因此 rule 会调用这些函数，不再直接创建 action。另一个 field 是 `internal` struct，包含 private file 和 metadata。这些 method 可以访问 `internal`，但 toolchain 的使用者不应该访问，因为其中的值可能随时变化，不另行通知。

然后在 [`BUILD.bazel.go_download.tpl`](https://github.com/jayconrod/rules_go_simple/blob/v5/internal/BUILD.bazel.go_download.tpl) 中声明 `go_toolchain` 和 `toolchain` target。这个文件是 template，`go_download` repository rule 会将它展开成 build file。详情见[上一篇文章](/zh-cn/writing-bazel-rules-repository-rules/)。

```bazel
# toolchain_impl gathers information about the Go toolchain.
# See the GoToolchain provider.
go_toolchain(
    name = "toolchain_impl",
    builder = ":builder",
    stdlib = ":stdlib",
    tools = [":tools"],
)

# toolchain is a Bazel toolchain that expresses execution and target
# constraints for toolchain_impl. This target should be registered by
# calling register_toolchains in a WORKSPACE file.
toolchain(
    name = "toolchain",
    exec_compatible_with = [
        {exec_constraints},
    ],
    target_compatible_with = [
        {target_constraints},
    ],
    toolchain = ":toolchain_impl",
    toolchain_type = "@rules_go_simple//:toolchain_type",
)
```

`go_download` rule 根据 `goos` 和 `goarch` attribute，设置 `{exec_constraints}` 与 `{target_constraints}` template parameter。代码见 [`repo.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v5/internal/repo.bzl)。

为了完成 toolchain implementation，还要修改 `go_compile`、`go_link` 和 `go_build_test`。它们可以通过 [`ctx.toolchains`](https://docs.bazel.build/versions/master/skylark/lib/ctx.html#toolchains) 取得 toolchain。修改后的 `go_compile` 如下：

```bazel
def go_compile(ctx, *, srcs, importpath, deps, out):
    """Compiles a single Go package from sources.

    Args:
        ctx: analysis context.
        srcs: list of source Files to be compiled.
        importpath: the path other libraries may use to import this package.
        deps: list of GoLibraryInfo objects for direct dependencies.
        out: output .a File.
    """
    toolchain = ctx.toolchains["@rules_go_simple//:toolchain_type"]

    args = ctx.actions.args()
    args.add("compile")
    args.add("-stdlib", toolchain.internal.stdlib.path)
    dep_infos = [d.info for d in deps]
    args.add_all(dep_infos, before_each = "-arc", map_each = _format_arc)
    if importpath:
        args.add("-p", importpath)
    args.add("-o", out)
    args.add_all(srcs)

    inputs = (srcs +
              [dep.info.archive for dep in deps] +
              [toolchain.internal.stdlib] +
              toolchain.internal.tools)
    ctx.actions.run(
        outputs = [out],
        inputs = inputs,
        executable = toolchain.internal.builder,
        arguments = [args],
        env = toolchain.internal.env,
        mnemonic = "GoCompile",
    )
```

最后，更新 rule，让它们请求 toolchain，并调用这些函数。下面是修改后的 `go_library`。

```bazel
def _go_library_impl(ctx):
    # Load the toolchain.
    toolchain = ctx.toolchains["@rules_go_simple//:toolchain_type"]

    # Declare an output file for the library package and compile it from srcs.
    archive = ctx.actions.declare_file("{name}.a".format(name = ctx.label.name))
    toolchain.compile(
        ctx,
        srcs = ctx.files.srcs,
        importpath = ctx.attr.importpath,
        deps = [dep[GoLibraryInfo] for dep in ctx.attr.deps],
        out = archive,
    )

    # Return the output file and metadata about the library.
    runfiles = _collect_runfiles(
        ctx,
        direct_files = ctx.files.data,
        indirect_targets = ctx.attr.data + ctx.attr.deps,
    )
    return [
        DefaultInfo(
            files = depset([archive]),
            runfiles = runfiles,
        ),
        GoLibraryInfo(
            info = struct(
                importpath = ctx.attr.importpath,
                archive = archive,
            ),
            deps = depset(
                direct = [dep[GoLibraryInfo].info for dep in ctx.attr.deps],
                transitive = [dep[GoLibraryInfo].deps for dep in ctx.attr.deps],
            ),
        ),
    ]

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
    },
    doc = "Compiles a Go archive from Go sources and dependencies",
    toolchains = ["@rules_go_simple//:toolchain_type"],
)
```

## 注册 toolchain

使用者必须注册 toolchain，Bazel 才能使用它们。这一步在 `MODULE.bazel` 中完成。先用 `go_download` repository rule 定义两个 repo，一个对应 `linux/amd64`，另一个对应 `darwin/arm64`。

```bazel
go_download = use_repo_rule("//:go.bzl", "go_download")

go_download(
    name = "go_darwin_arm64",
    goarch = "arm64",
    goos = "darwin",
    sha256 = "544932844156d8172f7a28f77f2ac9c15a23046698b6243f633b0a0b00c0749c",
    urls = ["https://go.dev/dl/go1.25.0.darwin-arm64.tar.gz"],
)

go_download(
    name = "go_linux_amd64",
    goarch = "amd64",
    goos = "linux",
    sha256 = "2852af0cb20a13139b3448992e69b868e50ed0f8a1e5940ee1de9e19a123b613",
    urls = ["https://go.dev/dl/go1.25.0.linux-amd64.tar.gz"],
)

register_toolchains(
    "@go_darwin_arm64//:toolchain",
    "@go_linux_amd64//:toolchain",
)
```

Bazel 启动时，会考虑通过 `--platforms` 设置的 target platform、通过 `register_execution_platforms` 或 `--extra_execution_platforms` 设置的 execution platform，以及通过 `register_toolchains` 或 `--extra_toolchains` 注册的全部 toolchain。对于 execution platform 与 target platform 的组合，Bazel 尝试选择满足所有 platform constraint 的 toolchain。如果有多个 toolchain 兼容，就选最先注册的那个。通过 `register_toolchains` 注册的 module 会按 breadth-first pre-order 考虑，因此 main module 注册的 toolchain 优先于其他 module。可以用 `--toolchain_resolution_debug` 查看 Bazel 的选择过程，这个 flag 接收一个用于匹配 toolchain type 的 regular expression。

**注意：** 像上面这样，注册 repository rule 中声明的 toolchain，有一个很大的缺点：Bazel 必须先对 repository rule 求值，才能读到 toolchain 定义。这意味着，即使只想使用其中一个，也必须把 macOS 和 Linux 的 archive 都下载下来。下一篇介绍 module extension 和 toolchainization 时，会解决这个问题。

## 使用 toolchain

构建 `//tests:hello`，看看是否能正常工作。它是一个最简单的 hello world `go_binary`：

```bash
$ bazel build --subcommands --toolchain_resolution_debug=. //tests:hello
Starting local Bazel server (8.3.1) and connecting to it...
INFO: Invocation ID: b6fa5c3d-a819-4252-9790-860e5b47e8db
INFO: ToolchainResolution: Target platform @@platforms//host:host: Selected execution platform @@platforms//host:host, 
INFO: ToolchainResolution: Performing resolution of //:toolchain_type for target platform @@platforms//host:host
      ToolchainResolution:   Toolchain @@+_repo_rules+go_darwin_arm64//:toolchain_impl is compatible with target platform, searching for execution platforms:
      ToolchainResolution:     Compatible execution platform @@platforms//host:host
      ToolchainResolution:   All execution platforms have been assigned a //:toolchain_type toolchain, stopping
      ToolchainResolution: Recap of selected //:toolchain_type toolchains for target platform @@platforms//host:host:
      ToolchainResolution:   Selected @@+_repo_rules+go_darwin_arm64//:toolchain_impl to run on execution platform @@platforms//host:host
INFO: ToolchainResolution: Target platform @@platforms//host:host: Selected execution platform @@platforms//host:host, type //:toolchain_type -> toolchain @@+_repo_rules+go_darwin_arm64//:toolchain_impl
INFO: ToolchainResolution: Target platform @@platforms//host:host: Selected execution platform @@platforms//host:host, 
INFO: ToolchainResolution: Target platform @@platforms//host:host: Selected execution platform @@platforms//host:host, 
INFO: Analyzed target //tests:hello (65 packages loaded, 7253 targets configured).
INFO: Found 1 target...
Target //tests:hello up-to-date:
  bazel-bin/tests/hello
INFO: Elapsed time: 3.056s, Critical Path: 0.03s
INFO: 1 process: 9 action cache hit, 1 internal.
INFO: Build completed successfully, 1 total action
```

这次没有 cross-compiling，所以 Bazel 只考虑了 `@@platforms//host:host` 这个 platform。看看它包含哪些 constraint。

```bash
$ bazel query --output=build @@platforms//host
platform(
  name = "host",
  constraint_values = ["@platforms//cpu:aarch64", "@platforms//os:osx"],
)
```

我们声明这个 toolchain 与哪些 constraint 兼容呢？

```bash
$ bazel query --output=build @go_darwin_arm64//:toolchain
toolchain(
  name = "toolchain",
  toolchain_type = "//:toolchain_type",
  exec_compatible_with = ["@platforms//os:macos", "@platforms//cpu:aarch64"],
  target_compatible_with = ["@platforms//os:macos", "@platforms//cpu:aarch64"],
  toolchain = "@go_darwin_arm64//:toolchain_impl",
)
```

几乎一样。`@platforms//os:macos` 是指向 `@platforms//os:osx` 的 `alias`，所以这个 toolchain 满足该 platform 的全部 constraint。

## 结语

Platform 和 toolchain 让一套 rule 与它所依赖的工具解耦。最直接的作用是，将构建与运行构建的机器隔离。同时，它也给使用者提供了灵活性：开发者不一定非得是原始 rule 的作者，也可以编写与已有 toolchain 兼容的新 rule，或与已有 rule 兼容的新 toolchain。在本例中，只要满足 `toolchain_type` 文档约定的 interface，就可以给 [gccgo](https://golang.org/doc/install/gccgo) 或 [TinyGo](https://tinygo.org/) 编写 toolchain，让它们与 `rules_go_simple` 配合。其他人也可以编写 `go_proto_library` rule，用与 `go_library` 相同的 compiler 构建生成的代码。

最终，toolchain system 将构建什么，也就是 rule，与如何构建，也就是 toolchain，分离开来。这样，修改一个组件时，就不用重写 repository 中的全部 build file。变化被限制在局部，这对任何需要扩展规模的系统都很重要。
