---
layout: post
title: "[译] Integration tests 是最好的测试"
date: 2026-11-10T07:29:37+08:00
publishDate: 2026-11-10T07:29:37+08:00
draft: false
slug: "integration-tests-are-best-tests"
tags: [软件测试, Go, 翻译]
categories: ["软件工程"]
author: ["Jay Conrod"]
original_url: "https://jayconrod.com/posts/133/integration-tests-are-best-tests"
original_title: "Integration tests are best tests"
original_date: 2026-01-15
translation_status: "全文翻译与本轮去 AI 味修改完成，代码和术语保留"
---

原文：[Integration tests are best tests](https://jayconrod.com/posts/133/integration-tests-are-best-tests)<br>
作者：Jay Conrod · 原文发表于 2026-01-15。

**作者简介**：[Jay Conrod](https://jayconrod.com/about) 是软件工程师，目前在 EngFlow 改进 Bazel 等构建系统的 remote builds 性能。他此前在 Google 的 Go 语言团队工作，参与过 Go modules、fuzzing、Bazel 支持和 command-line tools 的开发。

> 译注：文中的“我”指原作者，测试数量和工具的相关描述保留原文发表时的语境。

我想谈一个可能不太受欢迎的测试观点：integration tests 是最重要的一类测试。你应该尽量做好 integration test coverage，把相对少一些的时间花在 unit tests 上。自从参与 Go 的构建工具 `cmd/go` 的开发以来，我就一直这么想。当时我们有一套很出色的 integration tests，写起来容易，跑得快，也能可靠地发现 regression。

这个观点与通常的建议相反。大家一般认为，应该有充分的 unit test coverage、适量的 integration test coverage，再加上少量的 end-to-end test coverage。这通常被画成 *Testing Pyramid*：

![传统的 Testing Pyramid：底层的 unit tests 最多，中层的 integration tests 次之，顶层的 end-to-end tests 最少](/images/integration-tests-are-best-tests/testing-pyramid-normal.svg)

不过，我觉得它应该更接近下面这样：

![调整后的 Testing Pyramid：integration tests 占比最大，unit tests 次之，end-to-end tests 仍然最少](/images/integration-tests-are-best-tests/testing-pyramid-integration.svg)

## 为什么要写测试？

其实，我从来都不喜欢写测试，只想尽量少花时间在这上面。（这大概是个很受欢迎的观点，只是大家不常说出口。）但自动化测试有一个巨大的好处，它能告诉我代码到底能不能工作。*没测过，就不能算能用。* 更重要的是，测试让我有信心修改代码。我可以放心修 bug、加功能，也可以做优化，因为测试会告诉我有没有改坏什么。所以，我还是会写测试，而且为了这份信心，我在测试上花的功夫往往比被测代码还多。

测试也可能带来很大的负担，这取决于你怎么写。如果测试严重依赖被测代码的实现，那么每次改实现，都得跟着修测试。这就是 *toil*。耦合紧密的测试可能严重拖慢开发，甚至还不如没有测试，因为它让修改更难，而不是更容易。

## 为什么不以 unit tests 为主？

先明确一下定义。一个 unit test 覆盖系统中的单个组件，通常是一个 package、一个 class，或者一个 function。为了只测试这个组件，unit test 往往会用 fakes、mocks 和 stubs 来替代它的依赖。

Unit tests 最容易写，但它们能让我们对被测代码建立的信心相对有限，尤其是在大量依赖 fakes 时。Fake dependencies 的行为与真实实现不同，所以，即便 unit test 测得很全面，也可能在实际存在严重 bug 的情况下告诉我们一切正常。

![两个抽屉各自都没问题，装到一起后却被彼此的把手挡住，无法打开](/images/integration-tests-are-best-tests/unit-pass-integration-fail.jpg)

*Unit tests 通过了，integration tests 却失败了。*

Unit tests 虽然容易写，维护起来却可能最费工夫。它们天生贴近实现，因此实现一变，测试往往就得做更大范围的修改。一次小小的 refactoring，比如给 function 加一个参数，就可能需要更新测试中的几十处调用。用 mocks 时，这种紧密耦合尤其成问题。一个测试可能会检查某个 mock dependency 的 method 是否按指定参数被调用，还要检查调用次数和顺序是否符合要求。这样的测试，几乎改什么都会坏。

不过，有些地方我还是希望有充分的 unit tests：

- 基础库：data structures、string manipulation。
- Serialization、lexing、parsing。
- Validation，尤其是涉及安全的场景。

这类组件的输入和输出定义清楚，依赖少，也不太需要改动，因此它们的 unit tests 能带来实在的收益，维护起来也容易。

## 为什么不以 end-to-end tests 为主？

一个 end-to-end test 覆盖整个系统及其依赖。比如，Web 应用的 end-to-end test 会检查测试环境中的真实部署，涉及真正的浏览器，以及数据库、load balancer 等云服务。

End-to-end tests 在最接近真实的环境中运行，因此最能说明系统到底能不能工作。但它们也是最难搭建、运行成本最高的测试。它们通常在 nightly build 或 release qualification 阶段运行，不会作为 presubmit tests 在每次修改时都跑，因此未必能及时告诉你哪里出了问题。

对于 end-to-end tests，我的看法和通常的建议差不多：你应该有*一些* end-to-end test coverage，不过，把精力花在其他测试上，往往能获得更高的回报。

## 为什么选择 integration tests？

一个 integration test 覆盖系统中的多个组件，但仍可能用 fake implementations 来替代数据库、LLM 等外部服务。Integration test 通过系统的 public interfaces 与之交互，并验证从这些接口观察到的行为。它不关心被测系统的内部实现细节。

Integration tests 在 unit tests 和 end-to-end tests 之间取得了很好的平衡。

1. 它们让你对整个系统建立信心，而不只是对某个被测组件有信心。花较少的功夫，就能得到很大的收益。
2. 由于只能通过系统的 public interfaces 交互，它们与实现的耦合要松得多，因此改完实现后，通常不太需要调整测试。
3. 虽然它们难免比 unit tests 慢，却比 end-to-end tests 快得多，通常仍能在开发者的笔记本电脑上运行，也能用作 presubmit tests，所以反馈依然很快。

## 为什么大家不都写 integration tests？

既然 integration tests 这么好，为什么大家不一直写它们？可惜在实践中，它们通常比 unit tests 更难写。如果每个测试的大部分内容都是复杂的 boilerplate，开发者自然就会少写一些。

要充分发挥 integration tests 的作用，就得投入精力做一个 test framework，替你处理搭建测试环境、把组件接到一起、构造输入和验证输出这些麻烦事。搭建这样的 framework 可能要花不少时间，因为你可能需要一个功能完备的 testing library，或者一门小型 scripting language。但它一旦建好，新增一个 integration test 的边际成本就很低了。开发者这时就能写出*大量*测试。

## 案例：Go 的 script tests

上一份工作中，我参与了 `cmd/go` 的开发。它是 Go 的构建和依赖管理工具，也就是 `go build`、`go get` 等命令。2018 年加入 modules 时，我们需要大幅重写代码，并新增大量测试。因此，Russ Cox 在 [`script_test.go`](https://cs.opensource.google/go/go/+/refs/tags/go1.25.5:src/cmd/go/script_test.go) 中[引入](https://go-review.googlesource.com/c/go/+/123577)了一套新的 test framework。随着它的用处越来越明显，团队也不断扩展这套 framework。

每个测试都是 [`testdata/script`](https://cs.opensource.google/go/go/+/refs/tags/go1.25.5:src/cmd/go/testdata/script/) 目录下的一个文件。写这篇文章时，那里已经有将近 900 个测试。我们来看一个简单的例子，[`run_hello.txt`](https://cs.opensource.google/go/go/+/refs/tags/go1.25.5:src/cmd/go/testdata/script/run_hello.txt)。

```text
env GO111MODULE=off

# hello world
go run hello.go
stderr 'hello world'

-- hello.go --
package main
func main() { println("hello world") }
```

这个测试会创建一个临时目录，在其中放入名为 `hello.go` 的文件，然后执行 `go run hello.go`，检查写入 `stderr` 的输出是否匹配 regular expression `hello world`。

这个测试很简单，但如果没有这套 framework 提供的自定义 scripting language，写起来还是很烦琐。

- 每个测试都包含一组待解压到临时目录的文件，用 `-- hello.go --` 这样的 header line 分隔。（可以用 [`golang.org/x/tools/txtar`](https://pkg.go.dev/golang.org/x/tools/txtar) 读写这种 archive。）
- 每个文件的开头是一组待执行的命令，每行一条。它支持几种基本命令：
  - `go`、`exec`：运行 `go` 命令，或其他 executable。
  - `cat`、`cd`、`chmod`、`cp`、`exists`、`mkdir`、`mv`、`rm`：基本的文件操作。
  - `grep`、`stdout`、`stderr`：检查文件或输出流是否匹配 regular expression。
- `[linux]`、`[arm64]` 这样的 condition 可以确保命令只在特定环境中运行。
- 命令前加 `!`，表示预期它会失败。加 `?`，表示成败都无所谓。
- 命令后加 `&`，会让它在后台运行。`wait` 会阻塞，直到它执行完毕。

它还有其他功能，不过这些已经足以让你了解大概。这门语言很精简，正好适合这个用途。我们不想依赖 Bash 这样的完整 shell scripting language，因为那会引入 Go 项目之外的依赖，所以就自己写了一门。比如，我们不想操心系统有没有安装 `grep`，以及装的是 GNU 还是 BSD 版本。

Go 本身比较自足，但仍依赖 module proxies、version control services 和 checksum database，所以我们在 integration tests 中为它们都提供了 fake implementations。Fake module proxy 使用的文件放在 [`testdata/mod`](https://cs.opensource.google/go/go/+/refs/tags/go1.25.5:src/cmd/go/testdata/mod/) 中。Module proxy 本可以只是一个简单的 file server，但 modules 是以 `.zip` archive 分发的。我们发现，用 txtar archive 编写测试用的 modules 更容易，所以 fake proxy 会在收到请求时，把它们转换成 `.zip` 文件。如果能让每个测试都少费一点工夫，那在 test framework 上多花一点精力总是值得的。

我们非常喜欢这套 integration testing framework。自从引入它之后，`cmd/go` 的大部分新测试都是用它写的。我们只为 `go.mod` parser、minimal version selection algorithm 等特定组件写了少量 unit tests，大部分 test coverage 都来自 integration tests。这些 integration tests 很擅长验证行为、发现 regression，而且写起来很容易。

## 不止适用于 command-line tools

给 command-line tools 写 integration tests 很容易，换到其他领域，这里的建议就没那么容易照搬了。不过，只要投入精力做好 framework，让 integration tests 容易编写，它们往往就比其他测试更有效，维护成本也更低。

我做过几年 Android 应用开发，当时用 [Robolectric](https://robolectric.org/) 写 integration tests。在 Robolectric 测试中，你可以在 DOM 中按 ID 找到 view，再模拟点击和其他交互。[^android-view] Test framework 会 mock UI rendering，所以测试跑得快、运行可靠，对资源的要求也低。相比之下，end-to-end UI tests 需要把应用安装到 emulator 上、截图，再回放录制好的点击操作，我们更愿意用前一种测试。Emulator tests 很难写，跑得慢，还特别 flaky。

现在，我主要开发 gRPC backend services。一个 integration test 通常会在单机上搭起一组 services，发送请求，再验证响应。有时，测试也需要“揭开帘子”，检查一些内部状态，比如某个内容是否已缓存到 S3 bucket 中，但大部分测试都很少依赖具体实现。这些测试写起来仍然有点费劲，不过，用来启动 services 和构造请求的 testing library 改进之后，情况已经好了很多。

[^android-view]: 译注：原文使用了 DOM 一词。这里描述的是 Android 的 view hierarchy，见 Robolectric 文档中的 [`findViewById`](https://robolectric.org/) 用法。
