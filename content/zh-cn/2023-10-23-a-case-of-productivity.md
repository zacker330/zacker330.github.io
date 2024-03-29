---
layout: post
title: "反思一次效能提升"
Description: "一个案例"
date: 2023-10-23
tags: [Productivity]
---
前天与一个大佬交流。想起自己在6年多前在团队里做的一次小小的效能提升。

## 改进前
在同一个产品团队，同时有前端工程师和后端工程师。他们经常需要共同协作完成features。

前端是一个传统的多页应用。前端渲染是由后端的velocity模板引擎实现的。

打包后，最终执行就是一个jar包：
![](/assets/images/hellojar.png)
vm文件后缀名是velocity模板文件。它们内容大概是这样的：
```html
<html>
  <body>
    Hello $customer.Name!
    <table>
    #foreach( $mud in $mudsOnSpecial )
      #if ( $customer.hasPurchased($mud) )
        <tr>
          <td>
            $flogger.getPromo( $mud )
          </td>
        </tr>
      #end
    #end
    </table>
  </body>
</html>
```
其中一些非html代码就是Velocity Template Language。

默认情况下，一个前端工程师是不懂这门模板语言的。而且，这种模板语言对浏览器不友好，不像Thymeleaf。同时，按前端的开发习惯，他们是不可能先启动你一个Java进程后，再对前端页面进行调试。

总的来说，这样的技术栈是不利于前端本地开发的。

所以，在改进前，前后端的协作的方式是：
1. 前后端同时进行开发；
2. 后端负责在Java工程中实现后端的逻辑；
3. 前端负责在另一个独立的前端工程中开发HTML和CSS；
4. 前端完成页面的开发后，他会把前端页面html文件名和页面的逻辑告诉后端；
5. 后端再把html页面里内容与Java工程中的vm进行对比，然后将不同的部分转换到Java工程的vm模板页面中。

这样的协作方式下，经常出现以下问题：
1. 在将html转换到vm模板的过程中，后端有时会转换漏内容；
2. 转换后，前端调试前端问题会很麻烦。前端需要占用一个后端和他一起调试。因为前端不懂如何启动复杂的后端工程；
3. 命名上经常出现不一致，进而导致前端bug。对于同一个概念的情况下，前端命名叫item，后端叫project；

## 效能提升措施与效果
经分析，以上问题均由“技术之间的转换”导致，即人工的将html页面从一个前端工程转换到一个后端工程的vm模板语言。

所以，解决以上问题的思路就是：最好能消除html和vm的转换，又或者能减少这个转换过程的失误。

思路有了以后，解决方案有以下几个：
1. 更换前端技术栈，不再使用Java+vm模板；
2. 让前端学习vm模板语言，转换过程由前端完成；
3. 优化后端开发在本地启动的流程，方便前端也能在本地启动；
4. 减小测试环境的部署难度。让任何人都可以部署，方便前端进行调试。

方案1短时间无法做到，而且改动巨大，收益也未知。所以，最终是同时做了2、3、4。

虽然当时没有进行度量，但实际效果就是前文提到的所有问题都得到了减轻。

原因就是方案2、3、4，减少了前端需要向后端传递的信息。很多事情，前端一个人就可以解决了。

关于方案2、3，可能有人会好奇：前端去学习一门新的模板语言，成本大吗？前端在本地启动一个后端的工程去调试前端代码，成本高吗？

首先，vm模板并不是一门难的语言，只要有类C语言的基础（比如Java、JavaScript、C#等），都不难学。无非就是if-else判断、变量定义、循环等。

其次，在后端优化本地开发环境后，前端启动一个Java工程并不是一件难事。

## 反思
整个事件下来，本质上是前端本地开发习惯与现有技术栈的冲突。这次效能的提升需要前端开发做一些工作习惯上妥协。

而这只是表面上的问题，我们需要去思考更深层的问题：
1. 团队成员在改进前为什么一直没有考虑如何改进呢？又或者不知道该如何改进？
2. 对于这次效能改进，感观上是提升了，但是该如何度量呢？

思考问题1是为了让团队的所有的人有意识和思路地提升效能。思考问题2是为了让实践有数据支撑。

答案是什么呢？














