---
layout: post
title: "[译] 编写 Bazel rules（二）：library rule、depset 和 provider"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-library-rule-depsets-providers"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 2
original_url: "https://jayconrod.com/posts/107/writing-bazel-rules-library-rule-depsets-providers"
original_title: "Writing Bazel rules: library rule, depsets, providers"
original_date: 2018-08-15
original_updated: 2025-09-08
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: library rule, depsets, providers](https://jayconrod.com/posts/107/writing-bazel-rules-library-rule-depsets-providers)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2018-08-15，更新于 2025-09-08。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. **编写 Bazel rules（二）：library rule、depset 和 provider**
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. [编写 Bazel rules（七）：module extensions](/zh-cn/writing-bazel-rules-module-extensions/)

[上一篇文章](/zh-cn/writing-bazel-rules-simple-binary-rule/)编写了一个 `go_binary` rule，用一组源文件编译并链接出 Go executable。这次我们来定义 `go_library` rule，用它编译一个可供其他 library 和 binary 依赖的 Go package。

本文关注 rule 之间如何传递信息，建立可供 linker 或类似 linking action 使用的 dependency graph。全部代码都来自 [rules_go_simple](https://github.com/jayconrod/rules_go_simple) 的 [`v2` branch](https://github.com/jayconrod/rules_go_simple/tree/v2)。

和上次一样，不懂 Go 也不影响理解。我只是比较喜欢用 Go，所以拿它举例。

## 背景知识

看代码之前，先介绍三个重要概念：struct、provider 和 depset。它们是 rule 之间传递信息所用的数据结构，收集依赖信息时会用到。

### Struct

Struct 值是一个由 key-value pair 组成的 dictionary，有点像 Python 或 JavaScript 中的 object。虽然 struct 是一种基本数据结构，但它由 Bazel 提供，严格来说并不属于 Starlark 语言本身。调用 [`struct`](https://docs.bazel.build/versions/master/skylark/lib/struct.html) 函数可以创建一个 struct 值：

```bazel
my_value = struct(
    foo = 12,
    bar = 34,
)
```

访问 struct 的 field，与访问 Python object 的 field 写法相同。

```bazel
print(my_value.foo + my_value.bar)
```

[`dir`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#dir) 函数可以列出 struct 的 field name。[`getattr`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#getattr) 和 [`hasattr`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#hasattr) 的行为也和预期一样，不过，attribute 设置后就不能修改或删除，因为 struct 值是 immutable 的。可以用 [`json.encode`](https://bazel.build/rules/lib/core/json#encode) 和 [`json.decode`](https://bazel.build/rules/lib/core/json#decode) 在 struct 或其他值与 JSON 之间转换。

### Provider

[`provider`](https://docs.bazel.build/versions/master/skylark/lib/Provider.html) 是一种有名称的 struct type，用来传递 rule 的信息。Rule 的 implementation function 求值后会返回 provider struct。依赖这个 rule 的其他 rule 可以读取它返回的 provider。上一篇中，`go_binary` 返回了 [`DefaultInfo`](https://docs.bazel.build/versions/master/skylark/lib/DefaultInfo.html)，它是 [built-in providers](https://docs.bazel.build/versions/master/skylark/lib/skylark-provider.html) 之一。本文会定义 `GoLibraryInfo` provider，用来携带 library 的 metadata。

调用 [`provider`](https://docs.bazel.build/versions/master/skylark/lib/globals.html#provider) 函数可以定义新的 provider。

```bazel
MyProvider = provider(
    doc = "My custom provider",
    fields = {
        "foo": "A foo value",
        "bar": "A bar value",
    },
)
```

创建 provider 值的方式与创建 struct 值相同：

```bazel
my_provider = MyProvider(foo = 12, bar = 34)
```

### Depset

Bazel 提供了一种专门的数据结构，叫作 [depset](https://docs.bazel.build/versions/master/skylark/lib/depset.html)。和其他 set 一样，depset 中的值都是唯一的。它的特别之处在于合并速度快，而且 iteration order 有明确的定义。

Depset 通常用于在大型 dependency graph 中汇总源文件、header file 等信息。Dependency graph 可能包含数十万个节点，因此所有 depset 操作的时间和空间开销都保持在线性范围内很重要。本文会用 depset 汇总 Go 依赖的信息，包括 import path 和编译后的文件名。Linker 可以直接使用这些信息，不需要让 `go_binary` 显式列出所有 transitive dependencies。

一个 depset 由 direct element 列表、transitive depset child 列表，以及 iteration order 组成。

![Depset 的结构示意图](/images/writing-bazel-rules/depset.png)

构造 depset 很快，因为只需要创建一个持有 direct list 和 transitive list 的对象。时间复杂度为 O(D+T)，其中 D 是 direct list 中的元素数量，T 是 transitive child 的数量。Bazel 构造 set 时会对两个列表中的元素去重。遍历 depset 或将它转换为 list 的时间复杂度是 O(n)，其中 n 是这个 set 及其所有 child 中的元素总数，包含重复项。

## 定义 `go_library`

### `GoLibraryInfo` provider

原理讲完了，接下来看代码。

首先定义一个新的 provider。`GoLibraryInfo` 携带每个 library 及其依赖的信息，定义在新文件 [`providers.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v2/internal/providers.bzl) 中。

```bazel
GoLibraryInfo = provider(
    doc = "Contains information about a Go library",
    fields = {
        "info": """A struct containing information about this library.
        Has the following fields:
            importpath: Name by which the library may be imported.
            archive: The .a file compiled from the library's sources.
        """,
        "deps": "A depset of info structs for this library's dependencies",
    },
)
```

`doc` 为 [Stardoc](https://github.com/bazelbuild/stardoc) 设置 documentation string。`fields` 列出 provider 允许使用的 field 及其 documentation string。还可以给 `init` 传入自定义 constructor function；需要更复杂的 validation 或 initialization 时，这可能很有用。详情见 [`provider`](https://bazel.build/rules/lib/globals/bzl.html#provider)。

### `go_library` rule

现在可以定义 `go_library` rule 了。下面是 [rules.bzl](https://github.com/jayconrod/rules_go_simple/blob/v2/internal/rules.bzl#L97) 中新增的 rule 声明。

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

这里有四个 attribute。`srcs` 是一组 label，指向 `.go` 源文件或生成 `.go` 文件的 rule。`deps` 也是一组 label，指向其他 Go library rule。它们不一定非得是 `go_library`，但必须返回 `GoLibraryInfo` provider 才能兼容。`importpath` 是一个 string，用来生成 compiler 和 linker 使用的 `importcfg` 文件，将 import string 映射到编译后的 `.a` 文件。最后，`_stdlib` 和 `go_binary` 中的一样，是对编译后 standard library 的 hidden dependency，名称以 `_` 开头。

下面是这个 rule 的 [implementation](https://github.com/jayconrod/rules_go_simple/blob/v2/internal/rules.bzl#L70)。

```bazel
def _go_library_impl(ctx):
    # Declare an output file for the library package and compile it from srcs.
    archive = ctx.actions.declare_file("{name}.a".format(name = ctx.label.name))
    go_compile(
        ctx,
        srcs = ctx.files.srcs,
        importpath = ctx.attr.importpath,
        stdlib = ctx.file._stdlib,
        deps = [dep[GoLibraryInfo] for dep in ctx.attr.deps],
        out = archive,
    )

    # Return the output file and metadata about the library.
    return [
        DefaultInfo(files = depset([archive])),
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
```

首先调用 [`ctx.actions.declare_file`](https://bazel.build/rules/lib/builtins/actions#declare_file) 声明编译输出文件，再用 `go_compile` 声明 compile command。这和 `go_binary` 中的做法相同。

留意这里访问 attribute 的几种不同方式。

`ctx.files.srcs` 返回 `srcs` attribute 对应的所有文件。这个列表的长度不一定等于传给 `srcs` 的 label 数量；例如，其中某个 label 可能指向一个 `filegroup`，里面可以包含任意数量的文件。

`ctx.attr.importpath` 返回一个 string 值，因为 `importpath` 是 string attribute。

`ctx.file._stdlib` 返回 `_stdlib` 对应的单个 [`File`](https://bazel.build/rules/lib/builtins/File)，实际上是一个目录。之所以可以这样访问，是因为声明时设置了 `allow_single_file = True`。

`ctx.attr.deps` 返回一组 [`Target`](https://bazel.build/rules/lib/builtins/Target)。下标表达式 `dep[GoLibraryInfo]` 取得这个 target 返回的 `GoLibraryInfo` provider。

最后，返回一个包含两个 provider 的列表，分别是 `DefaultInfo` 和 `GoLibraryInfo`。`GoLibraryInfo.info` field 是一个 struct，包含正在编译的 library 的信息。这个 struct 必须是 immutable 的，而且要相对小一些，因为它会被加入其他 library 的 `GoLibraryInfo.deps` depset，并参与 hashing。

### `go_compile` 和 `go_link`

`go_compile` 和 `go_link` 有一个重要变化，你注意到了吗？它们现在都接收 `deps` 参数，内容是 direct dependency 的 `GoLibraryInfo` provider 列表。两者都用这个列表生成 importcfg 文件。Go compiler 和 linker 通过 importcfg 文件，将 import string 映射到编译后的 `.a` 文件。

对于 `go_compile`，importcfg 文件只需要列出 direct dependencies，所以内容可以这样生成：

```bazel
dep_importcfg_text = "\n".join([
    "packagefile {importpath}={filepath}".format(
        importpath = dep.info.importpath,
        filepath = dep.info.archive.path,
    )
    for dep in deps
])
```

对于 `go_link`，importcfg 文件需要包含所有 transitive dependencies，因此要先构造一个 depset，再遍历它。这就是我们需要 `GoLibraryInfo.deps` 的原因。

```bazel
deps_set = depset(
    direct = [d.info for d in deps],
    transitive = [d.deps for d in deps],
)
dep_importcfg_text = "\n".join([
    "packagefile {importpath}={filepath}".format(
        importpath = dep.importpath,
        filepath = dep.archive.path,
    )
    for dep in deps_set.to_list()
])
```

这些内容最终会被插入一段 Bash script。那段脚本既不好看，也与编写其他语言的 rule 无关，这里就不展开了。后面的文章会把它整理干净。

[`go_binary`](https://github.com/jayconrod/rules_go_simple/blob/v2/internal/rules.bzl#L49) 还有一处变化：现在有了 `deps` attribute，并在调用 `go_link` 时传入这些 target 返回的 `GoLibraryInfo` provider。与上一版相比，改动很小，所以这里不再贴完整源码。

### 暴露 public interface

所有定义都在 internal 目录中，需要让其他人能够使用。因此，我们在只包含 public definition 的 [`def.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v2/def.bzl) 中加载它们，同时暴露 `go_library` 和 `GoLibraryInfo`。想实现兼容 rule 的人也会用到后者。

```bazel
load(
    "//internal:rules.bzl",
    _go_binary = "go_binary",
    _go_library = "go_library",
)
load(
    "//internal:providers.bzl",
    _GoLibraryInfo = "GoLibraryInfo",
)

go_binary = _go_binary
go_library = _go_library
GoLibraryInfo = _GoLibraryInfo
```

### 测试 `go_library` rule

新功能仍然沿用上次的测试方法：用 `sh_test` 运行一个使用新功能构建出来的 `go_binary`。

```bazel
sh_test(
    name = "bin_with_libs_test",
    srcs = ["bin_with_libs_test.sh"],
    args = ["$(rootpath :bin_with_libs)"],
    data = [":bin_with_libs"],
)

go_binary(
    name = "bin_with_libs",
    srcs = ["bin_with_libs.go"],
    deps = [":foo"],
)

go_library(
    name = "foo",
    srcs = ["foo.go"],
    importpath = "rules_go_simple/tests/foo",
    deps = [
        ":bar",
        ":baz",
    ],
)

go_library(
    name = "bar",
    srcs = ["bar.go"],
    importpath = "rules_go_simple/tests/bar",
    deps = [":baz"],
)

go_library(
    name = "baz",
    srcs = ["baz.go"],
    importpath = "rules_go_simple/tests/baz",
)
```

运行 `bazel test //tests/...` 就能试一试。
