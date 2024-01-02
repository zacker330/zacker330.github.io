---
layout: post
title: "谈DevOps平台落地：前端构建怎么这么变态"
Description: ""
date: 2019-11-12
comments: true
share: true
---
![tibet-4538357_640.jpg](/assets/images/292372-cdd2f3d31e821aad.jpg)

题记：DevOps 平台通常搭建于内网环境，不能直接外网，所以，如果你也要在内网环境构建前端，就一定会遇到本文所说的问题。

我们发现在 DevOps 平台构建前端项目时，会报这以下这样的错误：
> 
 > node scripts/install.js
> Downloading binary from [https://github.com/sass/node-sass/releases/download/v4.9.0/linux-x64-57_binding.node](https://github.com/sass/node-sass/releases/download/v4.9.0/linux-x64-57_binding.node)
> Cannot download "[https://github.com/sass/node-sass/releases/download/v4.9.0/linux-x64-57_binding.node](https://github.com/sass/node-sass/releases/download/v4.9.0/linux-x64-57_binding.node)": 
> tunneling socket could not be established, statusCode=500
> Hint: If github.com is not accessible in your location
>       try setting a proxy via HTTP_PROXY, e.g. 
>       export HTTP_PROXY=[http://example.com:1234](http://example.com:1234/)
> or configure npm proxy via
>       npm config set proxy [http://example.com:8080](http://example.com:8080/)
> node-sass@4.9.0 postinstall </pre>

以上的错误日志的意思是node在安装 node-sass 时，要去 github.com/sass/node-sass 下载一个名为 `linux-x64-57_binding.node` 的二进制包。然后它无法下载（其实是因为DevOps平台搭建在企业的内网，是无法直接连接外网的），就建议你设置一下系统的HTTP代理，让它能连接到 github.com。

除此之外，错误日志中，还发现了，node-sass 依赖本身的构建，还需要 Python2 环境：

```
gyp verb check python checking for Python executable "python2" in the PATH
gyp verb `which` failed Error: not found: python2
```

对于一个 Java 后端开发人员，看到这样的错误就懵了。心里在想：
> 我不是已经设置了代理了吗？为什么还要从 GitHub 下载依赖？一个 node 项目，为什么还需要 python2 ？

该 node 项目的构建命令是这样写的：
```shell
npm install  --registry=https://registry.npm.abc.org
npm run build
```

是的，命令中明明写清楚了依赖的下载地址`https://registry.npm.abc.org`，它为什么还要从 GitHub 下载。

后来，我们上网查，发现很多人遇到了同样的问题：

![image.png](/assets/images/292372-1155760fe9ee397a.png)

这解决方案无非就以下三种：
1. 设置网络代理，让构建环境能连上 GitHub。
2. 设置环境变量`SASS_BINARY_PATH=/test-sass/binding.node`指定从本地目录读取该二进制文件的路径。
3. 设置环境变量`SASS_BINARY_SITE=http://npm.taobao.org/mirrors/node-sass` 指定从哪里下载这个二进制文件。

这三种方案在开发者自己的电脑上是能解决问题的。但是对于 DevOps  平台是无法解决的。

* 方案1：有些 node 包是从非 GitHub 下载的，比如cypress 库要从 https://cdn.cypress.io/desktop 下载。而且，构建环境处于企业内网不能直接连外网。设置代理也不合适。
* 方案2：不可能遇到一个依赖就自己手工下载，然后再放到编译环境中。不仅工作量大，用户体验还很差。
* 方案3：不可能设置一个外网的镜像。

那怎么办呢？笔者最终采用了方案3的变种：在内网搭建一个 npm/mirrors 的服务。

笔者研究发现，http://npm.taobao.org/mirrors 是使用 [https://github.com/cnpm/mirrors](https://github.com/cnpm/mirrors)来搭建的，那我们在内网也搭建一个。前端构建时就可以直接从内网下载了。

最后笔者就是在内网搭建这么一个 cnpm/mirros 服务，解决了前端构建时的二进制依赖的问题。而用户只需要在自己的构建命令前加一句环境变量的设置：
```
SASS_BINARY_SITE=http://npm.abc.org/mirrors/node-sass
```
慢着，我们可是 DevOps 平台，能不能让用户用得更爽，无感知的解决前端二进制依赖的问题呢？

其实，DevOps 平台可以直接构建环境中提前设置好相应的环境变量，比如：
```
ELECTRON_MIRROR=http://npm.abc.org/mirrors/electron/
SASS_BINARY_SITE=http://npm.abc.org/mirrors/node-sass
SQLITE3_BINARY_SITE=http://npm.abc.org/mirrors/sqlite3
```

这样，用户就不需要修改构建命令就解决了问题，用户体验得到提升。

### 小结
本文标题是有些标题党。但是，使用过 Java 构建工具的后端开发人员，遇到的前端构建的这类问题的人都会这样**疑问**。因为使用 Maven 或 Gradle 从来不需要从两个地方下载依赖，而且，node 下载依赖的位置，还要看写那个 node 库的人的“脾气”。

笔者在此并不是想挑起前端和后端的战争，更不是在说明 Maven 和 Gradle 的优越。只是疑问，node 社区是不是s可以规范一下二进制的下载位置呢？这样，可以节约很多开发者的时间。不过，说回来，node 社区说不定正在讨论着怎么建立相应的规范。

最后，感谢淘宝为 cnpm/mirros 做出的贡献。让我们能快速的解决前端依赖的问题。
