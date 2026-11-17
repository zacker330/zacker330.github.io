---
layout: post
title: "[译] 编写 Bazel rules（七）：module extensions"
date: 2026-11-10T08:29:43+08:00
draft: false
slug: "writing-bazel-rules-module-extensions"
tags: [Bazel, Starlark, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
series: ["Writing Bazel rules"]
series_weight: 7
original_url: "https://jayconrod.com/posts/131/writing-bazel-rules-module-extensions"
original_title: "Writing Bazel rules: module extensions"
original_date: 2025-10-14
translation_status: "全文翻译完成"
---

原文：[Writing Bazel rules: module extensions](https://jayconrod.com/posts/131/writing-bazel-rules-module-extensions)<br>
作者：[Jay Conrod](https://jayconrod.com/about)，曾在 Google 的 Go 团队工作，现就职于 EngFlow。<br>
原文发表于 2025-10-14。

> 译注：文中的“我”指原作者。版本号和工具行为保留原文发表或更新时的语境，示例代码与技术术语保留原样。

**Writing Bazel rules 系列：**

1. [编写 Bazel rules（一）：simple binary rule](/zh-cn/writing-bazel-rules-simple-binary-rule/)
2. [编写 Bazel rules（二）：library rule、depset 和 provider](/zh-cn/writing-bazel-rules-library-rule-depsets-providers/)
3. [编写 Bazel rules（三）：data 和 runfiles](/zh-cn/writing-bazel-rules-data-and-runfiles/)
4. [编写 Bazel rules（四）：将逻辑移到 execution phase](/zh-cn/writing-bazel-rules-moving-logic-to-execution/)
5. [编写 Bazel rules（五）：repository rules](/zh-cn/writing-bazel-rules-repository-rules/)
6. [编写 Bazel rules（六）：platform 和 toolchain](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)
7. **编写 Bazel rules（七）：module extensions**

_本文也发布在 [EngFlow blog](https://blog.engflow.com/2025/10/14/writing-bazel-rules-module-extensions/)。_

距离本系列上一篇文章最初发表，已经快六年了。这次有不少新内容可聊！

过去几年最大的变化，是引入了 [Bazel modules](https://bazel.build/external/module)，也就是 Bzlmod，并弃用了 `WORKSPACE` mode。我已经更新了前面的全部文章，使它们兼容 Bazel modules。这次则介绍新增的功能：如何编写 module extension，以及为什么需要它。

## 什么是 module extension？

Bazel 的新 module system，与其他 build tool 使用的 package management system 相似，例如 Go modules、npm packages、Maven artifacts 和 Cargo crates。Module 作者先在 [Bazel Central Registry（BCR）](https://registry.bazel.build/) 发布一个版本，使用者再将它列入 `MODULE.bazel`，就能建立依赖。Bazel 启动时，会从包含当前目录的 root module 开始，对每个 `MODULE.bazel` 求值，并递归处理全部依赖，然后使用 [minimal version selection](https://bazel.build/external/module#version-selection) 为每个依赖选定版本。

不过，并不是所有依赖都是 Bazel module，也不是所有 package management system 都兼容 minimal version selection。与刚才列出的系统不同，Bazel 的目标是支持多种语言，因此需要与其他系统集成，而非取代它们。例如，假设项目有 OpenTelemetry 这样的 Go 依赖，就需要按照 Go 的规则选择它的 transitive dependency 版本，从 Go module proxy 下载相应的 archive，再生成从源码编译所需的 `BUILD` 文件。

这些工作都可以交给 _module extension_。它基本上就是用 Starlark 编写的 Bazel module system plugin。

Module extension 有两部分：一组 _tag class_，使用者可以在 `MODULE.bazel` 中调用它们来声明 metadata；以及一个 _implementation function_，负责解释这些 tag，再实例化 [repository rule](https://bazel.build/external/repo)，下载选中的依赖并为其安装 `BUILD` 文件。Bazel 会从参与本次构建、且使用了这个 extension 的所有 `MODULE.bazel` 中收集 tag，然后在全局范围内对每个 extension 的 implementation function 调用一次。Module extension 创建的 repo 不专属于某一个 Bazel module。

具体来说，假设一个 Bazel 项目包含一些 Go 代码。Bazel 依赖声明在 `MODULE.bazel`，纯 Go 依赖则声明在 `go.mod`。再假设某个 Bazel 依赖也包含 Go 代码，并有自己的 `go.mod`。每个 Bazel module 都可以像下面这样，使用 Gazelle 的 [`go_deps`](https://github.com/bazel-contrib/bazel-gazelle/blob/master/extensions.md#go_deps) module extension 读取 `go.mod`。

```bazel
go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")

go_deps.from_file("//:go.mod")

use_repo(
    go_deps,
    "io_opentelemetry_go_otel_sdk",
    "com_google_cloud_go_storage",
)
```

`use_extension` 加载 `go_deps` extension。Bazel 要求使用这种语法，而不是 `load` statement，因为它必须先读取并求值 module version graph 中的每个 `MODULE.bazel`，然后才能选定本次构建所用的 module 版本。在选定版本之前，Bazel 不会真正下载任何 module 的源代码，因此也无法对 `load` statement 求值。所以，这里调用 `use_extension` 创建 module extension 的 proxy object，对这个对象的所有操作都延后到 version selection 完成之后。

`go_deps.from_file` 通过 tag class 创建一个 tag，登记一项信息：指向 `go.mod` 的 label，而该文件包含 Go 依赖。

最后，`use_repo` 让 `go_deps` 创建的 repo 对当前 module 可见。这个列表应该包含当前 module 的 `BUILD` 和 `.bzl` 文件直接引用的全部 repo。`bazel mod tidy` 可以自动向列表中添加或删除 repo name。

## Toolchainization

我们不会在简化的示例 repository [rules_go_simple](https://github.com/jayconrod/rules_go_simple) 中重新实现完整的 `go_deps`，但可以先解决一个规模更小、也更迫切的问题。

前面的文章[定义了 `go_download` repository rule](/zh-cn/writing-bazel-rules-repository-rules/)，用来下载特定版本、OS 和 architecture 的 Go archive，并安装 `BUILD` 文件；也[定义了 `go_toolchain` rule](/zh-cn/writing-bazel-rules-platforms-and-toolchains/)。当时这样配合使用它们：

```bazel
go_download = use_repo_rule("//:go.bzl", "go_download")

# Download distributions for macOS and Linux.
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

# Register toolchains from both versions. Unfortunately, this means we'll
# actually download and extract both archives, even though we only need one.
# We'll fix that in the next version.
register_toolchains(
    "@go_darwin_arm64//:toolchain",
    "@go_linux_amd64//:toolchain",
)
```

这种方式有几个问题。

1. Toolchain target 定义在各个 `go_download` repo 中，因此 `register_toolchains` 会迫使 Bazel 下载两个 archive，读取它们的 constraint，即使实际上只需要一个。
2. 如果另一个 Bazel module 也调用了 `go_download`，并注册了不同版本的 toolchain，这些 toolchain 同样会参与 toolchain resolution，最终选中的版本可能与预期不同。[Toolchain resolution order](https://bazel.build/extending/toolchains#toolchain-resolution) 微妙地依赖于 `register_toolchains` 在 module graph 中的调用位置。
3. 每个使用者都需要列出所有可能构建的平台。想支持另一个 platform，就得再调用一次 `go_download`，并注册新的 toolchain。

可以用遵循 _Toolchainization pattern_ 的 module extension 解决这些问题。这个名称由 Mike Bland 提出，他在 [Migrating to Bazel Modules (a.k.a. Bzlmod) - Toolchainization](https://blog.engflow.com/2025/05/14/migrating-to-bazel-modules-aka-bzlmod---toolchainization/) 中介绍了 rules_scala 如何采用这种模式。rules_go 的 [`go_sdk`](https://github.com/bazel-contrib/rules_go/blob/master/go/private/extensions.bzl) extension 也采用了这种实现。

1. 创建新的 `go` module extension。
2. 提供 `download` tag class，让使用者声明想要的版本，无需设置 OS、architecture、URL 或 SHA-256。
3. Implementation 读取所有已选定 `MODULE.bazel` 中的 `download` tag，选择其中最高的版本。
4. 从 `https://go.dev` 下载 manifest file，其中列出各个 platform 的 archive URL 和 SHA-256。
5. 为 `rules_go_simple` 支持的每个 platform 实例化一个 `go_download` repository rule。
6. 最后调用 `go_toolchains` repository rule，创建一个 `BUILD` 文件，在其中声明所有 platform 的 toolchain。这些声明原来放在 `go_download` 中。

实现 extension 后，rules_go_simple 就可以这样声明 toolchain：

```bazel
go = use_extension("//:go.bzl", "go")

go.download("1.25.0")

use_repo(
    go,
    "go_toolchains",
)

register_toolchains("@go_toolchains//:all")
```

其他 module 的使用者可以写得更简单，只需要用 tag 指定想要的版本。其他 module 不必重复声明 `register_toolchains`。

```bazel
go = use_extension("@rules_go_simple//:go.bzl", "go")

go.download("1.25.3")
```

这样就解决了前面列出的问题。Bazel 只需要生成 `@go_toolchains` repo，就能选择 toolchain；只有真正需要某个 toolchain 时，才下载对应的 `go_download` repo。所有已选定的 Bazel module 共享同一个 `@go_toolchains`，其中只声明所需的最高 Go 版本，因此不会意外选到更低的版本。`@go_toolchains` 也包含全部受支持 platform 的声明，不必再逐一列出想要的平台。

## `go_toolchains` repository rule

先从最后一步开始，实现 `go_toolchains`。它的声明如下：

```bazel
go_toolchains = repository_rule(
    implementation = _go_toolchains_impl,
    attrs = {
        "repos": attr.string_list(
            doc = "List of go_download repo names, used for label generation.",
        ),
        "goos_goarchs": attr.string_list(
            doc = "goos_goarch pair (like 'linux_amd64') for each repo in repos.",
        ),
        "_build_tpl": attr.label(
            default = "//internal:BUILD.bazel.go_toolchains.tpl",
            doc = "Build file template",
        ),
    },
    doc = """Internal repository rule that declares toolchain and go_toolchain
targets for all supported platforms. The go module extension calls this.""",
)
```

Implementation 会为每个 toolchain 展开一段 template string，写成 `BUILD` 文件。

```bazel
_GOOS_TO_CONSTRAINT = {
    "darwin": "@platforms//os:macos",
    "linux": "@platforms//os:linux",
    "windows": "@platforms//os:windows",
}

_GOARCH_TO_CONSTRAINT = {
    "amd64": "@platforms//cpu:x86_64",
    "arm64": "@platforms//cpu:aarch64",
}

_TOOLCHAIN_BUILD_HEADER = """# Generated by go_toolchains in @rules_go_simple//internal:repo.bzl

load("@rules_go_simple//:def.bzl", "go_toolchain")
"""

_TOOLCHAIN_BUILD_TEMPLATE = """
toolchain(
    name = "{toolchain_name}",
    exec_compatible_with = [
        {exec_constraints},
    ],
    target_compatible_with = [
        {exec_constraints},
    ],
    toolchain = ":{toolchain_name}_impl",
    toolchain_type = "@rules_go_simple//:toolchain_type",
)

go_toolchain(
    name = "{toolchain_name}_impl",
    builder = "{builder}",
    tools = ["{tools}"],
    stdlib = "{stdlib}",
)
"""

def _go_toolchains_impl(ctx):
    lines = [_TOOLCHAIN_BUILD_HEADER]
    for exec_idx, exec_goos_goarch in enumerate(ctx.attr.goos_goarchs):
        repo_name = ctx.attr.repos[exec_idx]
        exec_goos, exec_goarch = exec_goos_goarch.split("_")
        exec_constraints = [
            _GOOS_TO_CONSTRAINT[exec_goos],
            _GOARCH_TO_CONSTRAINT[exec_goarch],
        ]
        exec_constraints_str = ", ".join(['"{}"'.format(c) for c in exec_constraints])
        builder = "@{}//:builder".format(repo_name)
        tools = "@{}//:tools".format(repo_name)
        stdlib = "@{}//:stdlib".format(repo_name)
        lines.append(_TOOLCHAIN_BUILD_TEMPLATE.format(
            toolchain_name = exec_goos_goarch,
            exec_constraints = exec_constraints_str,
            builder = builder,
            tools = tools,
            stdlib = stdlib,
        ))

    ctx.file("BUILD.bazel", content = "\n".join(lines))
```

我们只是将 `toolchain` 和 `go_toolchain` target 从 `go_download` 生成的 `BUILD` 文件中移出来，实际新增内容并不多。

## `go` module extension

现在可以实现 module extension 了。先用 [`tag_class`](https://bazel.build/rules/lib/globals/bzl.html#tag_class) 声明 `download` tag。

```bazel
_download_tag = tag_class(
    attrs = {
        "version": attr.string(),
    },
    doc = """
Specifies the desired version of Go to download.

The go module extension selects the highest listed version in any module.
""",
)
```

然后通过 [`module_extension`](https://bazel.build/rules/lib/globals/bzl#module_extension) 声明 `go`。`implementation` 指向 implementation function，`tag_classes` 则是包含上述 tag 的 dictionary。我们还把 `os_dependent` 和 `arch_dependent` 设为 `False`，因为不管 Bazel 运行在哪个平台，extension 声明的 repo 和生成的 build file 都一样。这样可以合并 `MODULE.bazel.lock` 中记录的数据，确保 Linux、macOS 和 Windows 使用者都依赖同一份 metadata。

```bazel
go = module_extension(
    implementation = _go_impl,
    tag_classes = {
        "download": _download_tag,
    },
    os_dependent = False,
    arch_dependent = False,
    doc = """
Selects and downloads Go toolchain archives from go.dev and registers
appropriate Bazel toolchains. Archives are downloaded lazily, only for the
toolchains that Bazel selects at build time.
""",
)
```

Implementation function 接收一个 [`module_ctx`](https://bazel.build/rules/lib/builtins/module_ctx) 参数。与 repository rule 的 [`repository_ctx`](https://bazel.build/rules/lib/builtins/repository_ctx) 类似，它可以下载文件、访问 file system，以及执行命令。另外，通过 `modules` field 可以取得一组 [`bazel_module`](https://bazel.build/rules/lib/builtins/bazel_module.html) 对象，读取已选定 module 版本的 metadata。我们尤其关心 `tags` field，其中每一种 module extension tag 都有一个对应条目。借此就能找到 `go.download` tag 中最高的版本。

```bazel
def _go_impl(ctx):
    ctx.report_progress("selecting a version")
    highest_version = None
    for module in ctx.modules:
        for tag in module.tags.download:
            version = _parse_version(tag.version)
            if version == None:
                fail("module {} has download tag with invalid version '{}'".format(
                    module.name,
                    version,
                ))
            if highest_version == None or _compare_versions(version, highest_version) > 0:
                highest_version = version
    if highest_version == None:
        fail("go extension used without specifying a version. Declare a go.download tag with your desired version.")
    go_highest_version = "go{}.{}.{}".format(highest_version.major, highest_version.minor, highest_version.patch)
```

接着，从 https://go.dev/dl 获取全部可下载文件的列表，再按选定版本筛选。

```bazel
download_index_url = "https://go.dev/dl/?mode=json&include=all"
ctx.report_progress("checking available files at {}".format(download_index_url))
ctx.download(
    url = [download_index_url],
    output = "versions.json",
)
data = ctx.read("versions.json")
releases = json.decode(data)
files = [
    file
    for release in releases
    if release["version"] == go_highest_version
    for file in release["files"]
    if file["kind"] == "archive"
]
if len(files) == 0:
    fail("selected Go version '{}' but no files found at {}".format(go_highest_version, download_index_url))
```

有了所需版本的文件列表后，就可以用 `go_download` repository rule，为每个可能参与构建的 platform 创建 repo。某些 platform 可能有不止一个可下载文件，例如同时提供 `.tar.gz` 和 `.zip`，这里直接选择第一个。

```bazel
ctx.report_progress("declaring toolchains")
download_repo_names = []
for (goos, goarch) in _PLATFORMS:
    compatible_files = [
        file
        for file in files
        if file["os"] == goos and
            file["arch"] == goarch and
            any([file["filename"].endswith(ext) for ext in _ALLOWED_ARCHIVE_EXTS])
    ]
    if len(compatible_files) == 0:
        fail("no files found for Go version {} compatible with {}/{}".format(go_highest_version, goos, goarch))
    url = "https://go.dev/dl/{}".format(compatible_files[0]["filename"])
    sha256 = compatible_files[0]["sha256"]

    name = "go_{}_{}".format(goos, goarch)
    download_repo_names.append(name)
    go_download(
        name = name,
        urls = [url],
        sha256 = sha256,
        goos = goos,
        goarch = goarch,
    )
```

最后，使用 `go_toolchains` repository rule，为所有 platform 声明 toolchain。

```bazel
go_toolchains(
    name = "go_toolchains",
    repos = download_repo_names,
    goos_goarchs = ["{}_{}".format(*platform) for platform in _PLATFORMS],
)
```

结尾返回一个特殊的 metadata 值，说明这个 module extension _不是_ reproducible 的。如果 extension 的行为完全由 `MODULE.bazel` 中的 tag 输入及其他本地文件决定，它就是 reproducible 的。通常我们希望具备这个性质，但这里从 `go.dev` 下载了 version manifest，其中的下载 URL 和 SHA-256 理论上可能随时变化。将 extension 标记为 non-reproducible，会迫使 Bazel 将这些 URL 和 SHA-256 记录到 `MODULE.bazel.lock`，一旦发生变化，就报告 security error。

```bazel
return ctx.extension_metadata(
    reproducible = False,
)
```

上面的示例省略了 `_PLATFORMS` 的定义和其他一些细节。完整 implementation 见 [`go_ext.bzl`](https://github.com/jayconrod/rules_go_simple/blob/v6/internal/go_ext.bzl)。

## Module extension 的其他用途

本文通过 module extension 下载和配置 Go toolchain，简化了使用者的 `MODULE.bazel`，也避免了不必要的下载。

Module extension 还有许多用途。最直接的一种，就是让其他 package management tool 与 Bazel module system 集成，从 Maven、Cargo、NPM 或其他来源引入依赖。Module extension 不必遵循 Bazel 的 minimal version selection 规则；它可以根据 `MODULE.bazel` 中的 tag，或者 `go.mod`、`pom.xml` 等其他文件，自行决定如何选择版本。Version selection 可以用 Starlark 实现，也可以[运行外部命令](https://bazel.build/rules/lib/builtins/module_ctx#execute)。之后，module extension 再将下载和 build file 生成工作交给 repository rule。

一般来说，只要需要跨 dependency graph 中的所有 Bazel module 收集信息，或解决某种版本冲突，module extension 就能派上用场。`WORKSPACE` mode 下的 repository rule 没有这样的能力，因此，module extension 是 Bazel 一项很受欢迎的改进。
