---
layout: post
title: "Web前端构建之依赖版本管理最佳实践"
Description: "工程化的构建在于把握细节"
date: 2024-03-12
tags: [DevOps]
---
> 本文需要读者懂一点点前端的构建知识：
> 1. package.json文件的作用之一是管理外部依赖；
> 2. .npmrc是npm命令默认配置，放在工程根目录。

Web前端构建一直都是一个不难，但是非常烦人的问题，在DevOps、CI/CD领域。

烦人的是偶尔发生这样的事情：

1. 开发在本地构建通过，但是流水构建失败。这时前端开发人员会经常报怨Pipeline不稳定；
2. 流水线构建通过，但是在生产环境上启动不了，或者出现运行错误；
3. 不使用Docker可以启动，但是打包成Docker镜像后启动就失败。

这类问题，不是今天解决了，明天就不会发生。而是你根本不知道它什么时候又发生。

据我观察，绝大多数时候都是依赖版本管理没有做好导致的。

Web前端的依赖版本管理包括以下几个维度：

1. node的版本
2. 外部依赖的版本

我们需要在开发环境，构建环境，运行环境保证它们的版本是一致的。这样，在本地开发环境测试通过，那么，在其它环境就理论上也应该能通过。

接下来是具体的最佳实践。

## 保证Node版本一致

要保证Node版本一致，就要保证所有的环境使用同一个版本的node。而且是要具体到某一个精确的版本，如v20.11.1，而不是20这样一个粗略版本。

以下是我们以v20.11.1为例。

### 设置开发环境

设置开发环境的node的版本，需要在`package.json`中加入：

```json
{
  "engines": {
    "node": "v20.11.1",
    "npm": "10.2.4"
  },
}
```

这时，如果存在开发环境与配置的版本不匹配的情况，执行`npm install`，会出现以下警告，但是命令还是会继续执行：

```shell
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: 'gpt@0.0.1',
npm WARN EBADENGINE   required: { node: 'v20.10.1', npm: '10.2.4' },
npm WARN EBADENGINE   current: { node: 'v20.11.1', npm: '10.2.4' }
npm WARN EBADENGINE }
```

希望强制要求版本一致，就在根目录的`.npmrc`文件加入：

```
engine-strict=true
```

发生版本不一致的情况，报错日志如下，且命令会停止执行：

```
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: gpt@0.0.1
npm ERR! notsup Not compatible with your version of node/npm: gpt@0.0.1
npm ERR! notsup Required: {"node":"v20.10.1","npm":"10.2.4"}
npm ERR! notsup Actual:   {"npm":"10.2.4","node":"v16.0.1"}
```

### 设置构建环境
我们以Github Actions为例。在设置node环境时，应设置为：

```yaml
- name: Setup Node
  uses: actions/setup-node@v3
  with:
    node-version: '20.11.1'
```

### 设置运行环境

运行环境分两种：虚拟机环境、容器运行时。

在虚拟机环境下，要避免`apt install node-20`，尽量使用能指定精确node版本的方式安装NodeJS（比如从官网上下载20.11.1的包安装）。

容器运行时环境，选择的镜像的Tag要与构建环境的版本完全一致，而不是随便选一个20版本的。

## 保证外部依赖版本的一致

由于Node的依赖管理默认配置下非常的宽松，默认情况下使用的就是自动升级策略。

当开发在本地执行: `npm i @babel/core`，npm会在`package.json`文件中加入`"@babel/core": "^7.11.6",`。`^`代表将来再次执行`npm i`时，npm有权自动升级它的小版本。

这一行为，导致项目一开始构建是成功的，但是过一段时间又构建失败的偶尔事件。

这种偶发性，不仅给构建工程带来不必要的浪费，还让软件变得不可靠。想想建设在沙子上的大厦会是怎样。

所以，我们推崇以下管理方法。

### 限制依赖下载源
限制的方法是在`.npmrc`中加入配置：

```
registry=https://registry.npmjs.org
```

从源头就控制软件供应链的一致性。

### 默认使用准确版本

正如前文所述，在执行 `npm install <package>` 安装依赖时，默认情况下会在package.json文件中使用`^`符号来指定版本范围。不过，我们可以通过添加 `--save-exact` 参数来避免这种情况，即运行 `npm install <package> --save-exact`，这样package.json文件中就不会出现`^`符号，而是会锁定安装的精确版本号。

我们不可能让开发人员100%做到每次执行命令都加`--save-exact`参数。

所以，我们需要更改npm默认的行为，在`.npmrc`文件中增加配置：

```
save-exact=true
```

### 将package-lock.json加入到版本库中

package-lock.json文件是npm专门用于固定依赖版本的。如果你使用的是pnpm，相对应的文件就是：`pnpm-lock.yaml`。

node工程中，除了使用package-lock.json锁定版本，还可以使用npm-shrinkwrap.json。

它们具有相同格式，都放在项目的根目录，目的都是为了锁定依赖版本。区别是npm-shrinkwrap.json会被发布到制品库，而package-lock.json不会。且引用它的package会忽略这个文件。

而且当同一个工程根目录下，同时存在它们时，package-lock.json会被忽略。

### 使用PNPM代替npm？

这篇[文章](https://hackernoon.com/choosing-the-right-package-manager-npm-yarn-or-pnpm)对PNPM，npm和Yarn三个依赖管理工具进行对比，读者自行判断选择相应的工具。但是，可以确定的是不要使用cnpm。

不论使用哪种工具，以上的实践都是类似的。

## 后记

作者作为一个Web前端的外行写下本文，有不足的或者错误的，还请补充和指正，多谢。

