---
layout: post
title: "听说最近的事故都是循环依赖导致的？"
Description: ""
date: 2023-11-11
tags: [SRE]
---
​年底了，事故频发。但是都听说是因为循环依赖导致。所以，我决定来写写依赖管理领域中，通常不被重视的循环依赖问题。

## 循环依赖(circular dependencies)的定义

来自维基百科的定义：
> 在软件工程中，循环依赖是两个或多个模块之间的关系，这些模块直接或间接地相互依赖才能正常运行。此类模块也称为相互递归。

循环依赖是依赖管理领域中经常出现的一种现象，如下图：

![](/assets/images/循环依赖2.png)

## 循环依赖的不同层次以及后果

循环依赖可以发生在两个层次：
1. 源码之间相互引用依赖；
2. 服务之间相互调用依赖。

源码之间产生循环依赖带来的问题是：构建工具不知道应该从何处开始构建。因为构建工具无从下手。

构建工具底线这时就体现出来了，如果它可以忽略其中一个节点，“勉强”构建出一个制品，那么这个制品估计你也不敢用，因为该制品存在不确定性。这是源码层次中，循环依赖的后果。

而服务之间调用的循环依赖就更麻烦了。平时非常难发现，是不会出事故的，但一出事故就会雪崩。

因为你无法单独启动循环依赖中的任何一个服务，而循环依赖中的任何一个服务挂了，其它所有的节点都会同时挂。

循环依赖的环越大，影响面越大。

## 为什么会出现循环依赖

既然循环依赖从任何一个节点都法进行构建或者启动，那么它又为什么会产生？难道定义依赖的人不知道吗？Code Review的人不知道吗？

因为循环依赖是软件系统在长时间发展中，不加以合理的依赖管理所导致的。如下图。一开始只是B的V1版本依赖A的V1版本，最后变成B的V2版本与A的V3版本相互依赖。

![](/assets/images/循环依赖3.png)

软件系统发展的时间足够长，交接的人数足够多，软件依赖关系的规模早就超出了人类能处理的限度。

## 如何从根上就避免循环依赖

用人力的办法解决循环依赖，是不现实的。依赖管理这种吃力又不讨好，还拿不上台面的术语，没有人会去做。更不会得到KPI的“赏识”。

可以预料得到，如果对依赖管理治理不当，那么每几年，就可能出现一次循环依赖的事故。不发生事故的原因可能只有一个：软件的规模还不够大。

所以，我们必须想办法从根上避免循环依赖，即从依赖的定义的地方开始治理。

源代码层次，构建工具就可以帮我们依赖。只要出现循环依赖，构建就不通过。例如Make工具：
```
make: Circular main.asm.o <- main.asm dependency dropped.
```

但是，如果是多仓库管理源代码的模式下，你可能还是很难避免循环依赖的情况。如果是单仓库，就不会出现这样的情况。

而服务之间的调用关系，在不同的公司定义的位置不一样。这也决定了查找循环依赖的成本。

服务之间的调用关系的定义，本质上属于配置管理的范畴。因为你总要在某个地方定义这些依赖。

服务之间的循环依赖查找，本质上就是配置管理领域中，查找配置之间的相互引用关系。

这说明配置管理的方式决定了查找服务之间循环依赖的成本。

什么样的配置管理方式才能低成本的实现查找循环依赖呢？

在这里，我提出我的方案：使用Jsonnet定义所有的配置（某些case无法覆盖），然后通过Bazel进行构建。

- Jsonnet是一门专为配置定义而设计语言，语言只有一页A4纸；
- Bazel是一款支持增量构建、分布构建、构建缓存、支持多语言的构建工具。

通过这个方案，Bazel会自动构建一个软件依赖关系图，同时检测其中是否存在循环关系。只要循环关系存在，构建就不通过，当然就无法上线了。这样就从根上就避免了循环依赖。

如果想了解更多具体的落地方式，请关注我。并转发本文，让更多人看到这种神奇的配置管理方式。




