---
layout: post
title: "[译] 为什么你该放弃 YAML，改用 Jsonnet"
date: 2026-11-09T09:55:35+08:00
publishDate: 2026-11-09T09:55:35+08:00
draft: false
slug: "ditch-yaml-use-jsonnet"
tags: [Jsonnet, YAML, 配置管理, 翻译]
categories: ["软件工程"]
author: ["Joachim Bargsten"]
original_url: "https://bargsten.org/wissen/jsonnet-getting-started/"
original_title: "Why you should ditch YAML and use Jsonnet instead"
original_date: 2023-01-14
translation_status: "全文翻译与本轮去 AI 味修改完成，代码和术语保留"
---

原文：[Why you should ditch YAML and use Jsonnet instead](https://bargsten.org/wissen/jsonnet-getting-started/)<br>
作者：Joachim Bargsten · 原文发表于 2023-01-14。

> 译注：文中的“我”指原作者，工具和文档的相关描述保留原文发表时的语境。

我说不清自己究竟是什么时候想明白的。不过，看看 YAML 的格式和它的用法，我觉得这准是魔鬼的[杰作之一](https://ruudvanasseldonk.com/2023/01/11/the-yaml-document-from-hell)。就像苍蝇被一大坨牛粪吸引，包括我在内的开发者，也被一股无形的力量推向了这种格式。

事情本来可以很简单。能收拾配置乱摊子的替代方案多的是，有类型的、无类型的都有。可不不不，我们偏要用 YAML。我大概是在第一次看到 [Helm chart](https://helm.sh/docs/topics/charts/) 时想明白这件事的。过了一阵，我才捋清这套逻辑：

1. Helm 是 Kubernetes 的包管理器。
2. 我把 Helm chart 写成“包”，好让别人复用。
3. 压根没人复用这些 chart。真有人复用，就会产生极其紧密的耦合，正是每篇讲 clean code 的博客都在警告的那一种。
4. 反复试错，直到跑通。
5. 就快搞定了，只差把[缩进调对](https://twitter.com/memenetes/status/1600898397279502336)。

或者，这就是所谓的“[Arbeitsbeschaffungsmaßnahme](https://en.wiktionary.org/wiki/Arbeitsbeschaffungsma%C3%9Fnahme)”：人为增加工作量，好给更多开发者找点活干。

我也说不准。

YAML 的规范复杂得过了头，还会出现 [Norway Problem](https://hitchdev.com/strictyaml/why/implicit-typing-removed/) 这样的意外解析结果，可能存在安全问题，而且经常被滥用，拿来解决本不该由 YAML 解决的问题。

还有什么替代方案？

- [TOML](https://toml.io/en/)
- [HCL](https://hcl.readthedocs.io/en/latest/intro.html)
- [DHALL](https://dhall-lang.org/)
- [CUE](https://cuelang.org/)
- [Nix](https://nixos.org/manual/nix/stable/language/index.html) / [Nickel](https://nickel-lang.org/)
- 还可以继续列下去……

我开始尝试 [Jsonnet](https://jsonnet.org/) 和 [HOCON](https://en.wikipedia.org/wiki/HOCON)。HOCON 在 Java/Scala 圈子之外没多少人知道，其他语言对它的支持也就……一般般。

那 Jsonnet 呢？我个人觉得，它在能力和简洁性之间拿捏得刚好。

## Jsonnet 简介

Jsonnet 是什么？简单说：

> 面向应用和工具开发者的 data templating language。

可以把它看成增强版 JSON。从技术上说，它是 JSON 的 superset，加入了一些编程语言结构。因此，Jsonnet 需要先“编译”或转换，通常输出为 JSON。

> Jsonnet = JSON + Variables, Conditionals, Arithmetic, Functions, Imports and Error Propagation

例如：

```jsonnet
local person3 = import 'person3.libsonnet';
{
  person1: {
    name: "Alice",
    welcome: "Hello " + self.name + "!",
  },
  person2: self.person1 { name: "Bob" },
  person3: person3
}
```

流程很简单。从一个 Jsonnet 文件，也就是 main file 开始，在里面 import 其他 Jsonnet 文件（见图 1），再把 main file 编译成 JSON。

![Jsonnet 到 JSON 的流程](/images/jsonnet-getting-started/flow.png)

图 1：Jsonnet 到 JSON 的流程。（a）Jsonnet 支持 import，可以通过 `import` 指令引入其他文件，这些文件通常使用 `.libsonnet` 扩展名，例如 `local martinis = import 'martinis.libsonnet';`。（b）执行 import 的配置文件，也就是 main file，把各项 imports 合并成一个配置 object；（c）将它写成 JSON 输出。

更多信息见[官方文档](https://jsonnet.org/)。

## 能力与简洁性

能力上的空缺，总会有人来填，不管你愿不愿意。对 YAML 来说，[Jinja](https://jinja.palletsprojects.com/en/3.1.x/) 就是一例。但一旦能用 Jinja，开发者脑子里会发生什么？思路很简单：

1. 我有 Jinja。
2. 我可以写自己的 Python functions。
3. 再把它们集成到 Jinja 里。
4. 这样就能在 YAML template 里使用这些 functions。
5. unit tests 也省了，反正只是配置，对吧？

或者，我可以试着把所有事情都塞进 Jinja，让 YAML 来当“胶水代码”。

结果：一堆意大利面、蛇段和筷子。

Jsonnet 的能力有个天然的上限。如果用 Jsonnet 都解决不了，问题本身可能就复杂到不该塞进配置了。最好换一门真正的编程语言，把复杂逻辑封装到独立模块里，并配上测试。这样，配置就能保持精简。我觉得，在 Jsonnet 里，“看起来干净”和“实际干净”之间的关联还挺强。你可能会问，这有什么要紧的？和代码一样，配置也是一份文档。开发者会读它，扩展和改进它，也会把它改得一团糟。

他们得维护这些配置。所以，最好[让错误的代码看起来就是错的](https://www.joelonsoftware.com/2005/05/11/making-wrong-code-look-wrong/)。

## 工具

不过，我得承认，Jsonnet 是小众配置语言，工具也有点……怎么说呢，“古怪”。这道天然的门槛，让人没法轻松上手。

先说 [jsonnet.org](https://jsonnet.org/) 提供的 `jsonnet` package。遗憾的是，官网没给出什么像样的安装说明。[github.com/google/jsonnet](https://github.com/google/jsonnet) 倒是清楚一些：

```bash
brew install jsonnet
apt install jsonnet
<your favourite pkg manager> install jsonnet
```

这样应该就能装上。

另外还有 [`go-jsonnet`](https://pkg.go.dev/github.com/google/go-jsonnet)，也就是官方的 Go 实现（[GitHub repo](https://github.com/google/go-jsonnet)）。它是 C++ 实现的 drop-in replacement，还带着 formatter（`jsonnetfmt`）和 linter（`jsonnet-lint`）。真方便！（前提是你知道有这些工具。）

```bash
brew install go-jsonnet
```

Go repo 里有一些[安装说明](https://github.com/google/go-jsonnet#installation-instructions)。

也有 VS Code extensions，不过我没用过：

- [Jsonnet NG - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Sebbia.jsonnetng)
- [Jsonnet Language Server - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Grafana.vscode-jsonnet)

## Python

这部分就长话短说，毕竟也没多少可说的：

```bash
pip install jsonnet
# or you can also use the go version
# pip install gojsonnet
```

这样调用：

```python
import _jsonnet
# in case of the go-based pkg use
# import _gojsonnet
import json

res = json.loads(_jsonnet.evaluate_file("info.jsonnet"))
```

或者看官方示例：

```python
import json
import _jsonnet

jsonnet_str = '''
{
  person1: {
    name: "Alice",
    welcome: "Hello " + self.name + "!",
  },
  person2: self.person1 {
    name: std.extVar("OTHER_NAME"),
  },
}
'''

json_str = _jsonnet.evaluate_snippet(
    "snippet", jsonnet_str,
    ext_vars={'OTHER_NAME': 'Bob'})

json_obj = json.loads(json_str)
for person_id, person in json_obj.items():
  print('%s is %s, greeted by "%s"' % (
      person_id,
      person['name'],
      person['welcome']))
```

更多文档在 [bindings 页面](https://jsonnet.org/ref/bindings.html)，往下翻到“Python API”，还可以看看 [Python module 的测试](https://github.com/google/jsonnet/blob/master/python/_jsonnet_test.py)。从测试里能看出，`_jsonnet.evaluate_*` 这组 functions 还接受不少参数。再扫一眼 [C 代码](https://github.com/google/jsonnet/blob/master/python/_jsonnet.c)，能看到这些：

```c
static PyObject* evaluate_snippet(PyObject* self, PyObject* args, PyObject *keywds)
{
  ...
  static char *kwlist[] = {
    "filename", "src", "jpathdir",
    "max_stack", "gc_min_objects", "gc_growth_trigger", "ext_vars",
    "ext_codes", "tla_vars", "tla_codes", "max_trace", "import_callback",
    "native_callbacks",
    NULL
  };
  ...
}
```

可惜，没有相应的文档。比较有用的，大概是 `ext_vars`、`ext_codes`、`tla_vars` 和 `tla_codes`，官方文档里也提到了它们。要弄清 `import_callback` 怎么用，可以看看 [GitHub issue 里的讨论](https://github.com/google/jsonnet/issues/502)。

还有一点：环境变量需要通过函数参数传入。好处是没有 side effects。

## 语法

语法这部分我就偷个懒，直接看[官方文档](https://jsonnet.org/)里的 Tutorial、Getting Started 等内容吧。文档对语法的介绍相当不错。有问题也可以去 [StackOverflow](https://stackoverflow.com/questions/tagged/jsonnet)。

## 工作流与流水线

如今，在 CI/CD 流水线里为多个环境准备配置，几乎是每个开发者的日常工作。我会尽量把 YAML 流水线描述里的代码移到 `Makefile` 或 bash 脚本里。这样一来，我就能在本地运行流水线的一部分，方便调试。下面这个 `Makefile` 可以说明我的做法：

```makefile
.PHONY: build fmt clean

SHELL=bash

ENV?=acc

build:
	mkdir -p out
	# Emit multiple files
	# If you use multi-file output, the keys are the file names,
	# `app-config-file-1.json` in this case.
	jsonnet --ext-str env=$(ENV) -m out app-config-files.jsonnet
	# Emit single file to stdout
	jsonnet --ext-str env=$(ENV) app-config.jsonnet >out/app.json
	<out/app.json jq -r '.server' >out/server.txt

fmt:
	jsonnetfmt -i *.jsonnet

clean:
	rm -rf out/
```

（有需要时，我也会用 [`jq`](https://stedolan.github.io/jq/) 把部分结果提取到另一个文件里。）

这个 Makefile 用到了下面这些 Jsonnet 文件：

```jsonnet
// jsonnet/app/app-config-files.jsonnet
local env = std.extVar('env');

local config = {
  dev: import 'dev.jsonnet',
  acc: import 'acc.jsonnet',
  prd: import 'prd.jsonnet',
}[env];


{
  'app-config-file-1.json': config,
}

// jsonnet/app/app-config.jsonnet
local env = std.extVar('env');

{
  dev: import 'dev.jsonnet',
  acc: import 'acc.jsonnet',
  prd: import 'prd.jsonnet',
}[env]

// jsonnet/app/prd.jsonnet
{
  server: 'prd.bargsten.org',
}

// jsonnet/app/dev.jsonnet
{
  server: 'dev.bargsten.org',
}

// jsonnet/app/acc.jsonnet
{
  server: 'acc.bargsten.org',
}

```

当然，也可以把上面的做法反过来：每个环境单独用一个文件，在各自文件里 import 所需的配置：

```bash
jsonnet $ENV.jsonnet >out/app.json
```

## 结语

- [YAML 有不少问题](https://ruudvanasseldonk.com/2023/01/11/the-yaml-document-from-hell)，规范也过于复杂。
- [Jsonnet 的规范](https://jsonnet.org/ref/spec.html)简单明了。
- Jsonnet 的能力足够把事情做好，又有天然的“上限”，可以避免真正的编程语言，或 YAML 与 Jinja 这类混合方案带来的种种复杂性。
- 大多数编程语言都有支持，拿不准时，总可以先转换成 JSON。
- [Jsonnet 按 pure functional language 设计](https://jsonnet.org/articles/design.html)，side-effect free。

玩得开心！
