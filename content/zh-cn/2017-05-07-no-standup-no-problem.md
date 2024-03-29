---
layout: post
title: "为什么站会会成为形式"
Description: "想实践站会，但是过程非常痛苦"
date: 2017-05-07
tags: [站会, 敏捷团队,管理]
comments: true
share: true
---
![敏捷宣言的那些大叔](/assets/images/292372-97ded69e8d2535c7.png)
图截自：http://agilemanifesto.org/iso/zhchs/manifesto.html

最近，项目上遇到了以前我从来没有遇到的事情：10多个人一个团队（概念上的），要应对9个外部需求提出方；要维护超过10个子系统，这个“大系统”还是从另一个不愿意配合的团队接手过来的；项目管理者中，有倾向于敏捷的，也有倾向于瀑布的；最可怕的是这支团队完成组建才1个多月，只有3个人有站会经验，平均工作经验在7年以上😱。

所有的这些条件混合在一起，管理就变得异常复杂，困难。面对这样复杂的乱麻，谁都很难有勇气一刀切。

然而，事情还要做。比如站会。上周我自荐主持一次站会。说实在，那次站会是失败的，因为期间还是有两个人拿手机来刷。

有人拿手机出来刷，说明站会上的内容和他们无关，进一步说明站会是无效的。

但是，为什么呢？我会后一直都在思考这个问题。

我想起自己一年多前，也是带团队从零开始实践敏捷开发。为什么不会出现这样的情况？

突然，一个词蹦出来：共同语言！

站会成为形式的根本原因，就是**整个团队没有共同语言**！。没有共同语言使站会沦为形式。

好，现在我必须解释两个问题：

1. 为什么整个团队没有共同语言导致站会成为形式？
1. 为什么整个团队没有共同语言？

我先解释为什么整个团队没有共同语言，再解释为什么没有共同语言的团队站会是形式。

## 为什么整个团队没有共同语言
### 团队的沟通模型
第一个使整个团队没有共同语言的因素是：团队的沟通模型。

为了方便讨论，我们假设团队的沟通模型为：
项目管理A，对接需求方1、2、3，然后再将任务拆分给Q、W、E。项目管理B、C依此类推。

![团队结构](/assets/images/292372-cedb061dc583584b.png)

这样的沟通模型下，为什么团队成员会没有共同语言？

在这样的沟通模型下，开发人员Q平时只与A沟通需求，尽管可能私底下与其他开发人员沟通一下实现，可以说，开发人员Q与项目管理A才会有共同语言。依此类推，每个开发人员只与他的直接上级有共同语言。

我的结论是：趋向于单向沟通的团队沟通模型决定团队成员之间没有共同语言。而且这种单向沟通的结构时间越长，团队成员之间共同语言就越少！现象是，同处一个团队，你不知道你隔壁坐的同学到底在做什么。

### 没有统一业务术语
第二个整个团队没有共同语言的因素是：团队内部没有统一业务术语。

我们假设站会时，移动团队里的iOS、Anroid、H5三个小组一起参加同一个站会。而在站会时，iOS针对功能A使用了“激活”业务术语，而Android的同学对同一功能A却使用“上线”业务术语。

不统一业务术语不仅导致成员之间没有共同语言，导致更严重的问题是：沟通效率低下。

## 为什么整个团队没有共同语言导致站会成为形式
其实道理很简单，你问问自己，你喜欢与自己有更多共同语言的人交谈，还是反之？这是人性！

站会时，我们更倾向于听我们关心的，和我们听得懂的。但是因为没有共同语言，所以，我们即不关心，也听不懂！

站会当然也就是形式而已。

## 怎么破？
这下肯定会有人问，那为什么要站会？取消不就可以了。问这样的人是因为不了解站会的本质：站会一种团队快速反馈的机制。

至于为什么需要快速反馈，很简单：（真正有效的）每日站会的团队可以每天根据站会内容（反馈）来对人员、需求、发布时间进行调整，调整的时间是以天计。而如果只有周会的团队，那么，这个团队调整的时间是以周计，那你觉得哪种团队面对变化时更敏捷，迅速？

说回来，如何让站会更有效，而不至于成为一种形式呢？

至少可以肯定的是这不是一个主持人就能解决的。

剩下的先留给大家思考，我们下篇文章再讨论。

你也可以先读读我之前写过的文章：

* [每日站会、代码审查、结对编程 之开源中国实践](https://showme.codes/2016-04-01/standup-codereview-pair-in-oschina/)
* [反馈机制在企业中的作用？](https://showme.codes/2016-12-10/feedback-in-company/)
* [如何防止程序员上班迟到？](http://showme.codes/2017-03-03/prevent-late-for-work/)