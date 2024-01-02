---
layout: post
title: "活多人少，每个需求都紧急，多数项目延期，怎么破？"
Description: ""
date: 2019-03-1
tags: [管理]
comments: true
share: true
---

注意，下文所说的“老板”通常指业务提出方。

### 问题描述

上个星期，在持续交付2.0的群中，群主发出一个别人的提问。在我看来，这个问题在软件工程领域非常的典型，所以想单独写一篇博客来讨论。以下是问题原文：

> 我是一个开发部门的管理人员，团队规模还较小，开发需要兼任测试和部分应用运维的工作，但公司业务条线不算少（差不多有4个左右，目前部门中基本是按每个条线分配2-3个开发，出现某个组资源不足以满足需求时再进行调剂），之前这么做还算稳定，因为各业务对交付频率的要求一般很低，但近期各业务都提出了一个较紧急的项目需求，而且都还无法推迟或拒绝，资源一下子变得非常紧张（如果可以推迟某一个当然就会有富裕资源，但是这些项目由于各种原因公司都不能放弃，也很难推迟），如果依然每个组独立完成自己的项目，可能导致大部分项目因无法按时交付失败，而且每个组还必须保留少部分资源用于处理日常业务，如果临时招聘也来不及做培训，我们暂时是让资深一些的程序员和管理人员参与多个项目中的开发，但仍不能完全解决问题（他们抱怨任务太多都来不及测试），请问帮主遇到这类情况应该如何协调？


提问者所说的情况，在现实中，太普遍了：

1. （无法拒绝的）紧急需求的插入，打乱原有的步骤
2. 开发除了需求的开发，还需要处理日常业务
3. 人员不足：临时招聘也解决不了
4. 开发人员报怨任务太多，来不及测试（就上线？）
5. 项目无法按时交付

可以看出，“人员不足”是“项目无法按时交付”这个“果”的其中一个“因”。而提问者希望通过业务线之间人员的调剂和临时招聘的方式增加人员，但仍不能完全解决问题。笔者每当听到增加人员的信息，都会想起《人月神话》所说的：向进度落后的项目中增加人手，只会使进度更加落后。

而从提问者口中也了解到，原来人员还算足（感觉是刚刚好），只是因为出现了一个无法拒绝的紧急需求，问题就暴露出来了。

### 问题解决

面对这样的问题？你是如何解决的呢？以下是我个人提出来的解法，不一定对，只做交流：

**第1是把当前工作的优先级排出来** 

把所有的工作内容（包括日常维护和新功能实现）列出来，同时，也要找到这些工作的交集（避免重复开发）。工作内容列出来后，确定它们的业务价值及优先级，并预估其开发难度。有些新功能是老板直接下发的，但是实现难度过高且业务价值又不高（团队及产品经理觉得），能和老板谈就和老板谈。这部分工作是我觉得最难的。

这个工作的优先级一定要让老板看到。主要是避免老板中间随意的插入需求。当然，有时需要向现实妥协，但不是每次。同时也要让所有人达成共识，遵守这个优先级。

**第2是找出团队平时工作中最耗时的环节（瓶颈），想办法在这个环节上减少耗时（自动化或者别的办法）。一般来说，经常工作在这个耗时环节的人会知道如何优化它。**

**第3是慢慢让人可以流动**

意思是人没办法调剂到其它项目，通常是因为他不了解其它项目（业务或者技术）。所以，在平时，就要注意将项目的“知识”尽可能准确地传递给更多人。当然，也可以定向的传递。具体操作方式要看团队平时的协作方式。

最后，1，2，3步需要重复执行，同时1，2，3步也不是顺序的。

笔者提出这样的解法并不是笔者猜的，而是有依据的。依据如下：

1. 人员不足只是表象，我们怎么知道是真的人员不足，还是没有真正发挥每个人的最大潜能呢？第2、3步是为了让每个人发挥最大的潜能。而工具方面，个人建议通过看板可视化人员的工作内容，来达到了解当前资源状态的目的。
2. 即使每个人的潜能都发挥到了极致，但是还是出现人员不足的情况啊。这就是第1步要解决的问题。这时，我们要学会舍弃。但是为什么老板就不会舍弃，老爱插入一些所谓的紧急需求呢？个人认为是因为老板不了解你当前的工作内容及其优先级。所以，这个优先级一定要和老板达成共识。

### 小结
当我把解法提出来了，群里的同学就提出了质疑：如何确定老板提出新功能是业务价值不高的？毕竟老板从整个公司考虑问题的。

这位同学提出了一个软件工程领域内经常发生的问题：执行者怀疑业务提出者提出的需求的价值。个人觉得质疑是好事。但是质疑之后，双方有没有讨论及讨论结果才是关键。讨论了就容易形成共识，有了共识，大家才好力往一处使。题外话，“我只要结果，不管过程”的管理理念的适用范围是拿出来讨论的。

最后，以上解法，不一定适用所有的情况。比如在外包项目管理中，可能就不适合。

