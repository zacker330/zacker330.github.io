---
layout: post
title: "[译] Skylark 设计一瞥"
Description: "Bazel 构建语言 Skylark 的设计背景：从 Make 和 Python 预处理走向确定性、封闭性，以及通过冻结共享数据实现线程安全的并行加载。"
date: 2026-11-05
draft: false
tags: [Bazel, Skylark, 编程语言, 翻译]
categories: ["软件工程"]
comments: true
share: true
---

原文：[A glimpse of the design of Skylark](https://blog.bazel.build/2017/03/21/design-of-skylark.html)

作者：Laurent Le Brun。原文发布日期：2017 年 3 月 21 日。

> 译注：本文保留原文的 Skylark 名称和 2017 年的技术语境，文中的“当前”等时间表述均以原文发表时为准。原文来自 Bazel 官方博客，其[源码仓库](https://github.com/bazelbuild/bazel-blog)采用 [Apache License 2.0](https://github.com/bazelbuild/bazel-blog/blob/master/LICENSE)。本文为中文翻译。

本文介绍 Skylark 的设计。Skylark 是 Bazel 中用于描述构建的语言。

## 简史

很多年前，Google 使用 Makefile 构建代码。正如[其他人也曾指出的那样](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/03/hadrian.pdf)，Makefile 很难应对大型代码库。一个临时方案是用 Python 脚本生成 Makefile：构建描述保存在 `BUILD` 文件中，以调用 Python 函数的形式表达。但这个方案实在太慢了，瓶颈就在 Make。

Blaze 项目于 2006 年启动，后来以 Bazel 的名字开源。它用一个简单的解析器读取 `BUILD` 文件，只支持函数调用、列表推导式和变量赋值。当 Blaze 无法直接解析某个 `BUILD` 文件时，就会先执行一个预处理步骤：用 Python 解释器运行用户编写的 `BUILD` 文件，生成一个简化版的 `BUILD` 文件，再交给 Blaze 使用。

这种方法很简单，也允许开发者创建自己的宏。但它又带来了许多维护、性能和安全方面的问题。由于 Blaze 本身无法解析这些 `BUILD` 文件，各类工具的开发也变得更加复杂。

在当前版本的 Bazel 中，我们移除了 Python 预处理步骤，让系统变得更加合理。不过，为了迁移现有代码库，我们保留了 Python 语法。无论如何，这似乎都是个好主意：许多人喜欢 `BUILD` 文件的语法，其他构建工具，例如 [Buck](https://buckbuild.com/concept/build_file.html)、[Pants](http://www.pantsbuild.org/build_files.html) 和 [Please](https://please.build/language.html)，也采用了这种语法。

## 设计要求

我们决定将构建描述与扩展（宏和规则）分开。构建描述放在 `BUILD` 文件中，扩展放在 `.bzl` 文件中，但它们都由同一个解释器求值。我们希望代码易于阅读和维护。Bazel 是为成千上万名工程师设计的，其中大多数人并不熟悉构建系统的内部原理，也不愿意花时间学习一门新语言。`BUILD` 文件需要保持简单，并采用声明式写法，这样我们才能开发工具来操作这些文件。

这门语言还需要满足以下要求：

- **运行在 JVM 上。** Bazel 使用 Java 编写。考虑到大型构建的内存需求，Bazel 和这门语言应当共享数据结构。
- **使用 Python 语法。** 这样可以保留我们现有的代码库。
- **具备确定性和封闭性（hermetic）。** 我们必须保证代码执行始终产生相同的结果。例如，我们禁止访问 I/O、日期和时间，并确保字典的遍历顺序是确定的。
- **保证线程安全。** 我们需要并行求值大量 `BUILD` 文件。为了保证确定性，代码执行必须是线程安全的。

最后，我们还要考虑性能。典型的 `BUILD` 文件很简单，执行起来也很快。在大多数情况下，直接对代码求值，比先编译再执行更快。

## 并行与导入

Skylark 的一个独特之处在于它处理并行的方式。在 Bazel 中，一次大型构建需要对数百个 `BUILD` 文件求值，因此我们必须并行加载它们。每个 `BUILD` 文件都可能使用任意数量的扩展，而这些扩展又可能依赖其他文件。这样就形成了一张依赖图。

Bazel 首先并行求值这张图的叶子节点，也就是没有依赖的文件。对于其他文件，只要它们的依赖全部加载完成，Bazel 就会立即加载它们。这意味着 `BUILD` 文件和 `.bzl` 文件的求值过程是交错进行的，也意味着 `load` 语句的顺序完全不影响结果。

每个文件最多只会被加载一次。求值完成后，文件中的定义，也就是全局变量和函数，会被缓存起来。其他文件都可以通过缓存访问这些符号。

由于多个线程可能同时访问同一个变量，我们需要限制副作用，以保证线程安全。解决办法很简单：在缓存一个文件中的定义时，将它们“冻结”，使其变为只读。例如，你可以遍历一个数组，但不能修改其中的元素。不过，你可以创建一个副本，再修改这个副本。

我们将在后续的博客文章中介绍这门语言的其他特性。
