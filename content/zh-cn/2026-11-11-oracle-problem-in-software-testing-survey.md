---
layout: post
title: "[译] 软件测试中的预言问题综述"
Description: "如何判断测试结果是否正确：从显式指定、推导和隐含的测试预言，到人工判定成本、测试预言复用与质量度量。"
date: 2026-11-11
draft: false
slug: "oracle-problem-in-software-testing-survey"
tags: [软件测试, 测试预言, 软件工程, 翻译]
categories: ["软件工程"]
author: ["Earl T. Barr", "Mark Harman", "Phil McMinn", "Muzammil Shahbaz", "Shin Yoo"]
original_url: "https://doi.org/10.1109/TSE.2014.2372785"
original_title: "The Oracle Problem in Software Testing: A Survey"
original_year: 2015
enableLaTeX: true
translation_status: "全文翻译与去 AI 味复测完成"
---

原文：[The Oracle Problem in Software Testing: A Survey](https://doi.org/10.1109/TSE.2014.2372785)。作者为 Earl T. Barr、Mark Harman、Phil McMinn、Muzammil Shahbaz 和 Shin Yoo。正式发表信息为 *IEEE Transactions on Software Engineering*，2015 年，第 41 卷第 5 期，507–525 页。[UCL Discovery](https://discovery.ucl.ac.uk/id/eprint/1471263/) 提供开放获取版本。

译者说明：本文依据所提供的 31 页 PDF 翻译。该 PDF 的生成日期为 2014 年 11 月 17 日，章节和引用编号沿用这份稿件。文中的“当前”“近年来”和研究展望均指原文写作时期。本文将 test oracle 译为“测试预言”，其余计算机技术名词保留英文，首次出现时酌加中文说明。参考文献保留英文著录。原文公式中需要注意的记号问题另列译注。UCL 将原作标注为 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。本文为中文译文，配图来自原作。

## 摘要

测试通过检查系统行为来发现潜在 fault。给定系统输入，如何区分预期的正确行为和可能错误的行为，就是测试预言问题（test oracle problem）。自动化测试预言，有助于消除制约整体测试自动化的一项瓶颈。缺少自动化测试预言时，人必须判断观察到的行为是否正确。

已有研究提出了多种测试预言自动化技术，包括建模、specification、contract-driven development 和 metamorphic testing。这些技术都不足以解决问题时，最终的测试预言信息来源仍然是人。人可能掌握非形式化 specification 与领域知识，也可能了解预期和惯例，用它们指导判断。包括人工判定在内，所有形式的测试预言都面临降低成本、增加收益的问题。本文全面综述测试预言问题的现有解决方法，并分析这一软件测试研究与实践领域的发展趋势。

关键词：测试预言；automatic testing；testing formalism。

## 1 引言

软件测试研究一直希望在可行且合适的范围内，尽可能自动化测试过程，让测试更快，降低成本并提高结果的可靠性。要做到这一点，需要测试预言（test oracle），即区分 System Under Test（SUT，被测系统）正确行为与错误行为的判定过程。

与测试自动化的许多其他方面相比，测试预言自动化受到的关注明显较少，问题也解决得不够充分。它已经成为进一步推进测试自动化、推广自动化测试方法与工具的一项重要瓶颈。例如，自动生成测试输入已经有近四十年的研究历史 [46](#ref-46)、[108](#ref-108)。这项研究要寻找合适的输入，使执行能够暴露已有 fault。没有发现 fault 时，也能增加对系统的信心。Search-Based Testing [3](#ref-3)、[5](#ref-5)、[83](#ref-83)、[127](#ref-127)、[129](#ref-129) 和 Dynamic Symbolic Execution [75](#ref-75)、[109](#ref-109)、[162](#ref-162) 都取得了重要进展，但这些进展并未解决如何依据预期行为检查生成的输入所触发的结果，也就没有自动解决测试预言问题。

理想情况下，SUT 从设计之初就遵循良好的 design-for-test 原则，具备详细甚至形式化的预期行为 specification。代码还可能包含 precondition 和 postcondition，采用成熟的 contract-driven development 方法 [136](#ref-136)。这时，测试工具可以调用可自动执行的测试预言检查输出，减少昂贵的人工干预，测试预言成本也会随之降低。

SUT 没有完整的属性 specification 时，可以尝试构建部分测试预言，只对部分输入做出判断。Metamorphic testing 可以利用预期行为之间的已知关系构建这类测试预言，也可以从执行过程或文档中推导测试预言信息。

但对许多系统，以及当时工业界的大部分测试实践来说，测试人员并没有 formal specification、assertion 或自动化部分测试预言可用 [91](#ref-91)、[92](#ref-92)。他们必须人工检查所有 test case 的系统行为，工作量很大。自动化软件测试方法因此还需要解决人工测试预言成本问题 [1](#ref-1)、[82](#ref-82)、[131](#ref-131)。

进一步推进测试自动化，需要集中研究测试预言问题，并把自动或半自动测试预言纳入测试技术。本文希望通过全面回顾和分析已有研究，帮助实现这一目标。

此前已有几份与测试预言有关的局部综述，但尚未全面梳理这一领域的趋势和成果。Baresi 和 Young 在 2001 年的综述 [17](#ref-17) 中讨论了当时常见的四个主题：assertion、specification、基于状态的 conformance testing 和日志分析。这些主题仍然重要，但只覆盖了整个研究领域的一部分。Binder 在 2000 年出版的软件测试教材 [23](#ref-23) 也较早讨论了研究测试预言问题的动机。2009 年，Shahamiri 等人 [165](#ref-165) 比较了推导的测试预言中的六种技术。2011 年，Staats 等人 [174](#ref-174) 重新讨论测试的理论基础，其中也分析了测试预言。2014 年，Pezzè 等人综述了面向功能属性的自动化测试预言 [151](#ref-151)。

尽管已有这些工作，测试预言研究者和实践者之间的交流仍然比较分散。本文希望通过全面的分析与综述，帮助整合这一领域的研究。

第 2 节先给出定义，作为比较各类技术的基础。第 3 节回顾历史，标出关键进展，并按发表数量分析四类研究的增长趋势。第 4 至第 7 节分别讨论以下情形，第 8 节讨论未来方向并结束全文。

- 可以明确指定测试预言。
- 可以推导出测试预言。
- 可以从隐含信息构建测试预言。
- 没有可自动执行的测试预言，但仍能减少人工工作。

## 2 定义

本节建立讨论测试预言的共同术语。为避免歧义，定义采用形式化表达。只阅读配套的文字说明，也可以理解后文。第 5 节会用这些定义解释 algebraic specification、伪测试预言和 metamorphic relation 之间的关系。

我们先把 stimulus（激励）和 response（响应）统一定义为 test activity，再定义可以约束它们的 test activity sequence。测试预言接受或拒绝这样的序列，既可以采用确定性方式，也可以采用概率方式。最后给出测试预言的 soundness 和 completeness 定义。

### 2.1 Test activity

测试就是对系统施加 stimulus，并观察 response。两者都有值，取值范围可能相同，例如都取实数。系统有一个组件集合 `C`，stimulus 和 response 面向其中的组件。构造测试预言的一种常见方式，就是对不同组件施加取值相同的 stimulus，再比较输出。因此，stimulus 和 response 都是带有目标组件的值，合称 test activity。

**定义 2.1 Test activity。** 对 SUT `p`，`S` 是触发或约束 `p` 计算的 stimulus 集合，`R` 是可以观察到的 response 集合。`S` 与 `R` 不相交，test activity 集合为：

<div class="math">
\[
A = S \uplus R.
\]
</div>

Disjoint union 隐含地为 `A` 中的元素加上标签。可以将其展开成 `L × C × V`，其中 `L = {stimulus, response}` 是活动标签集合，`C` 是组件集合，`V` 是任意值集合。对于时钟等独立于具体组件的外部因素，把活动的目标设为空集。

这里尽量广泛地使用 stimulus 和 observation（观测）两个词，以涵盖 functional testing 和 non-functional testing。图 1 中，stimulus 可以是测试人员提供的显式输入 `I ⊂ S`，也可以是会影响测试的环境因素 `S \ I`。Observation 可以是 SUT 的显式输出 `O ⊂ R`，也可以是 `R \ O` 中的执行时间等非功能属性。

![图 1 stimulus、显式输入、response 与显式输出的关系](/images/oracle-problem-survey/stimuli-and-observations.png)

图 1：`S` 包含所有可能改变 SUT `f` 可观察行为的因素；`R` 包含所有可以观察到的行为；`I` 是显式输入，`O` 是显式输出。不在 `S ∪ R` 中的事物，既不影响 `f`，也不受 `f` 影响。图引自原文。

Stimulus 包括配置和平台设置、数据库表内容、设备状态、资源约束、precondition、输入设备键入的值、其他系统经通信通道送来的输入，以及传感器输入等。把 SUT 重置到初始状态也是 stimulus。向 SUT 提供输入则会使它运行。Observation 包含所有能够被察觉、且对测试目的有意义的现象，例如输出设备上的值、数据库状态、执行的时间属性、发热量、能耗，以及其他可测量的执行属性。Stimulus 和 observation 分属不同集合，但都属于 test activity。

### 2.2 Test activity sequence

测试由一系列 stimulus 和 response observation 组成。两者的关系往往可以形式化表达。假设 SUT 计算输入的平方，输入与输出之间就有 `(i, o = i²)` 这样的关系。为紧凑表示这类无限关系，定义 set comprehension 记号：

<div class="math">
\[
x:[\varphi] = \{x \mid \varphi\},
\]
</div>

其中 `x` 是任意集合上的哑变量。

**定义 2.2 Test activity sequence。** Test activity sequence 是下列文法生成的集合中的元素，`A` 是 test activity 的字母表，`ε` 是空串：

<div class="math">
\[
T_A = \{w \mid T \overset{*}{\longrightarrow} w\},
\qquad
T ::= A\,\texttt{:[}\varphi\texttt{]}\,T \mid AT \mid \epsilon.
\]
</div>

按照这个定义，`io:[o = i²]` 表示用 `i` 调用 `f`，再观察输出，并要求合法 response 满足 `o = i²`。它紧凑地表示无限多个序列 `i₁o₁, i₂o₂, …`，其中 `oₖ = iₖ²`。

实际使用中，test activity sequence 通常需要满足约束才有意义。本文用不同约束区分不同的测试预言方法。先给出一个基本例子。

**定义 2.3 Practical test sequence。** 满足下式的 test activity sequence `w`，称为 practical test sequence：

<div class="math">
\[
w = T s T r T, \qquad s \in S,\; r \in R.
\]
</div>

也就是说，`w` 至少包含一个 stimulus，以及发生在其后的一个 observation。这是对测试的很一般的描述：必须先对系统做某件事，再观察系统行为，才能有待检查的结果，以及这个结果所依赖的 stimulus。

Reliable reset `(p, r) ∈ S` 是一种特殊 stimulus，它把 SUT 的组件 `p` 恢复到起始状态。因此，序列 `(stimulus, p, r)(stimulus, p, i)` 对应通常的函数调用 `p(i)`。用 `v(a)` 提取活动的值，用 `c(a)` 提取目标组件。同一组件在不同输入值上的两次调用，可以写成：

<div class="math">
\[
r_1 i_1 r_2 i_2 : [r_1,i_1,r_2,i_2\in S,\;
c(r_1)=c(i_1)=c(r_2)=c(i_2) \land v(i_1)\ne v(i_2)].
\]
</div>

后文经常比较同一个 SUT 的不同执行，或比较独立实现的组件在同一输入值上的输出。为简化对输入值和组件的约束，用 `f(x)` 表示以下 syntactic sugar，其中 `r` 是对应组件的 reliable reset：

<div class="math">
\[
f(x) \equiv ri:[c(i)=f \land v(i)=x], \qquad f\in C.
\]
</div>

测试预言是一个 predicate，用来判断给定的 test activity sequence 是否属于 SUT 可接受的行为。先定义确定性的测试预言，再放宽到概率测试预言。

**定义 2.4 测试预言。** 测试预言 `D` 是从 test activity sequence 到 `true` 或 `false` 的 partial function：

<div class="math">
\[
D:T_A\rightharpoonup\mathbb{B}.
\]
</div>

Partial function 不必在整个定义域上都有定义。形式上，`f: X ⇀ Y` 可以视为某个 `X′ ⊆ X` 上的 total function `f′: X′ → Y`。如果测试预言在某个序列上有定义，它就会接受或拒绝该序列。序列的连接表示活动依次发生。测试预言接受同一组 stimulus 和 observation 的不同排列时，也就允许相应活动并行。本文用 `D` 区分确定性测试预言和概率测试预言。测试预言的计算通常较昂贵，因此即使确定性测试预言存在，也可能值得采用概率方法 [125](#ref-125)。

**定义 2.5 概率测试预言。** 概率测试预言把 test activity sequence 映射到实数闭区间 `[0, 1]`：

<div class="math">
\[
\widetilde D:T_A\rightharpoonup[0,1].
\]
</div>

它同样不必是 total function。如果测试预言只能高效给出 test case 可接受的概率，或其回答允许一定程度的不精确，就可以用这个定义建模。

本文的 formalism 将 stimulus 和 response 的语言理论视角，与活动上的约束结合起来。约束明确表达 specification，高层语言结构则规定活动的时间顺序。因此，这套 formalism 本身就包含时间关系。Staats 等人的 formalism 将测试看作原子的黑盒，SUT 在时间上的行为被封装在测试之内 [174](#ref-174)。实践者通常编写测试计划和测试活动，往往连非形式化 specification 也不写。本文的 formalism 能表达已有测试预言方法，也能直接描述这些测试活动，因此与实践较为契合。

### 2.3 Soundness 与 completeness

定义测试预言的 soundness（可靠性）和 completeness（完备性），需要先定义 ground truth `G`。它是一个概念上的测试预言，始终给出正确答案。除了最简单的情况，通常无法真正掌握它，但它可以作为界定测试预言行为的理论基准。

**定义 2.6 Ground truth。** Ground truth 测试预言 `G` 是始终给出正确答案的 total 测试预言。

**定义 2.7 Soundness。** 测试预言 `D` 是 sound 的，当且仅当：

<div class="math">
\[
D(a) \Rightarrow G(a).
\]
</div>

**定义 2.8 Completeness。** 测试预言 `D` 是 complete 的，当且仅当：

<div class="math">
\[
G(a) \Rightarrow D(a).
\]
</div>

一般情况下，测试预言无法同时做到 sound 和 complete，但仍然可以使用部分正确的测试预言。从纯哲学角度，也可以认为人工测试预言是 sound 且 complete 的，此时正确性由人的主观判断确定。上述定义允许这种情况。

放宽 soundness 的定义，可以涵盖概率测试预言。

**定义 2.9 Probabilistic soundness 与 completeness。** 概率测试预言 `D̃` 是 probabilistically sound 的，当且仅当：

<div class="math">
\[
P(\widetilde D(w)=1)>\frac12+\epsilon \Rightarrow G(w).
\]
</div>

它是 probabilistically complete 的，当且仅当：

<div class="math">
\[
G(w) \Rightarrow P(\widetilde D(w)=1)>\frac12+\epsilon,
\]
</div>

其中 `ε` 不可忽略。对二元分类器而言，公平抛硬币的不确定性最大。不可忽略的优势 `ε` 要求 `D̃` 比抛硬币好得足够多，使得在同一序列 `w` 上反复采样，可以对其是否有效获得任意高的置信度。

## 3 测试预言的研究趋势

“Test oracle” 一词最早出现在 William Howden 1978 年的研究中 [99](#ref-99)。本节分析此后有关测试预言及相关领域的研究，先按显式指定、推导、隐含，以及缺少自动化测试预言四类统计论文数量，再考察关键概念首次提出的时间。

### 3.1 论文数量

我们在 Google Scholar 和 Microsoft Academic Search 上，按年份使用 `software + test + oracle` 和 `software + "test oracle"` 检索，建立了包含 1978–2012 年间 694 篇文献的资料库。查询中的 `+` 分隔关键词，没有被分开的短语作为一个整体加引号检索。虽然部分查询看起来相似，返回结果仍有差异，尤其是排名较低的结果。

这 694 篇文献按研究对象分为四类。

| 类别 | 文献数 | 测试预言的依据 |
| --- | ---: | --- |
| 显式指定的测试预言 | 317 | 给定的 formal specification |
| 推导的测试预言 | 245 | 文档、执行记录或其他版本等 artefact |
| 隐含的测试预言 | 76 | crash 等通常可直接认定的异常 |
| 缺少自动化测试预言 | 56 | 减少人工构建或执行判定的成本 |

显式指定的测试预言根据 formal specification 判断系统行为，第 4 节详述。为补充这类文献，我们还检索了 `formal + specification`、`state-based specification`、`model-based languages`、`transition-based languages`、`assertion-based languages`、`algebraic specification` 和 `formal + conformance testing`，并添加 `test oracle` 限定结果。

推导的测试预言从其他 artefact 推导，例如系统的旧版本，第 5 节详述。补充检索词包括 `specification inference`、`specification mining`、`API mining`、`metamorphic testing`、`regression testing` 和 `program documentation`。

隐含的测试预言用于检测程序 crash 等明显 fault，第 6 节详述。检索词包括 `implicit oracle`、`null pointer + detection`、`null reference + detection`、`deadlock + livelock + race + detection`、`memory leaks + detection`、`crash + detection`、`performance + load testing`、`non-functional + error detection`、`fuzzing + test oracle` 和 `anomaly detection`。

还有一类研究应对缺少自动化测试预言的情况，第 7 节详述。我们使用 `human oracle`、`test minimization`、`test suite reduction` 和 `test data + generation + realistic + valid` 检索。

上述查询均追加 `software testing`，再剔除与软件测试和测试预言无关的结果。图 2 给出各类文献的累计数量。我们尝试了不同的 regression model，图中的趋势线采用 power model。四个较高的 coefficient of determination（R²）表明模型与趋势数据拟合较好。观察到的趋势使作者预期，这些研究主题的文献数量还会继续增长。

![图 2 四类测试预言研究的累计论文数量与趋势线](/images/oracle-problem-survey/publication-trends.png)

图 2：1978–2012 年的累计论文数量。横轴为年份，纵轴为累计数量。趋势线使用 power regression。图中的拟合结果反映当时作者对研究增长的判断。图引自原文。

### 3.2 测试预言技术的出现

我们按文献提出的技术或概念分类，考察它们如何部分解决测试预言问题。例如，Model Checking [35](#ref-35) 和 Metamorphic Testing [36](#ref-36) 归入推导的测试预言。DAISTS [69](#ref-69) 是 algebraic specification 系统，归入显式指定的测试预言。

对每一类测试预言，我们按首次发表时间绘制技术与概念的时间线。图 3 从 1978 年“test oracle”一词提出时开始，每条竖线标注相应技术或概念最早的发表年份。

![图 3 测试预言技术与概念的历史时间线](/images/oracle-problem-survey/oracle-timeline.png)

图 3：测试预言技术与概念的出现时间。四个区域分别对应显式指定、推导、隐含，以及缺少自动化测试预言的研究。图中标签保留英文。图引自原文。

时间线只收录明确讨论测试预言的研究。例如，使用 Finite State Machine（FSM）生成测试的工作可追溯至 20 世纪 50 年代，但明确使用 FSM 生成测试预言的文献包括 Jard 和 Bochmann [103](#ref-103)，以及 Howden 1986 年的工作 [98](#ref-98)。对每项技术，我们记录最早可获得的期刊、会议、workshop 或杂志论文，不纳入 technical report 和手册。

图 3 也列出少量早于 1978 年的技术。它们虽然没有明确使用测试预言这个概念，却已经研究了后来由测试预言处理的问题。例如，检测 deadlock、livelock 和 race 等并发问题的研究可以追溯到 20 世纪 60 年代。这些问题通常不需要 specification 就能识别，因此可以构建适用于任意系统的隐含的测试预言。Regression Testing 则检查新版本与旧版本共有功能中的问题，是推导的测试预言的前身。

趋势分析表明，用于形式化指定测试预言的新技术和新概念，在 20 世纪 90 年代达到高峰，随后十年逐渐减少。不过，从图 2 的年度发表数量来看，这一方向仍然活跃。推导的测试预言在整个统计时期持续出现新方法。早期工作偏重理论，例如 partial/伪测试预言 [196](#ref-196) 和 specification inference [194](#ref-194)，到 20 世纪 90 年代后期才逐渐出现 empirical study。

隐含的测试预言延续了 1978 年以前的研究方向，增长速度慢于其他类别。应对缺少自动化测试预言时，Partition Testing 一直是帮助人工测试预言选择测试的常见技术。趋势线显示，明确以人工测试预言成本问题为目标的新技术和新概念，到统计时期的后段才开始出现。

## 4 显式指定的测试预言（specified test oracle）

Specification 是计算机科学的基础，已有大量研究将它作为测试预言信息来源。这一主题本身就足以形成一篇独立综述。本节给出概要，也将 assertion 和 model 这类部分行为 specification 纳入讨论。

Specification 为特定领域定义测试预言，条件允许时使用数学逻辑表达。Specification language 是定义显式指定的测试预言 `D` 的记号系统，用于判断系统行为是否符合 formal specification。第 2 节的 formalism 本身也是一种指定测试预言的 specification language。

过去三十年里，基于 formal specification 的测试方法主要分为四类。Model-based specification language 定义模型，并通过操作对模型的影响描述预期行为。State transition system 描述系统对 stimulus 的反应，其中的反应称为 transition。Assertion 和 contract 是嵌入实现语言、在运行时检查的 specification 片段。Algebraic specification 则给出程序正确时，其操作之间应满足的等式。

### 4.1 Specification language

Specification language 定义系统行为的数学模型，并通过 formal semantics 规定每个语言构造在模型中的含义。用于测试的模型通常不会完整指定系统，而是捕捉重要属性，以便生成 test case 或检查结果。

#### 4.1.1 Model-based specification language

Model-based specification language 将系统建模为状态集合，以及改变状态的操作，因此也称 state-based specification [101](#ref-101)、[110](#ref-110)、[182](#ref-182)、[183](#ref-183)。Precondition 和 postcondition 约束操作：precondition 规定正确调用必须满足的输入状态条件，postcondition 定义操作对程序状态的影响，通常希望给出最强的描述 [110](#ref-110)。

这类语言包括 Z [172](#ref-172)、B [111](#ref-111)、UML/OCL [31](#ref-31)、VDM/VDM-SL [62](#ref-62)、Alloy [102](#ref-102) 和 LARCH 语言族 [71](#ref-71)，后者还包含 algebraic specification 子语言。总体上，它们逐渐变得更具体，更接近程序员使用的实现语言。这样既能让实践者更容易理解、促进工业界采用，也能建立 specification 与 implementation 的联系，支持通过 iterative refinement 开发系统。例如，Z 用 schema 这一种结构机制组织 predicate、set、状态属性和操作。作为其后继方法的 B，则提供更丰富、抽象程度更低的语言构造。

Börger 讨论过如何用 abstract state machine formalism 定义高层测试预言 [29](#ref-29)。这是一种通用的、基于集合论且面向函数定义的 specification language。此类语言的底层模型可能非常抽象，与具体执行输出相距甚远。例如，判断一个函数的 postcondition 是否允许某个具体输出，可能很难计算。如果可以通过抽象系统输出或具体化模型输出，弥合这种 abstraction mismatch，而且 postcondition 能在有限时间内求值，就可以把它作为测试预言 [4](#ref-4)。

VDM、Z 和 B 等 model-based specification language 可以表达 invariant，并用于驱动测试。任何 test case 只要让程序违反 invariant，就发现了错误行为。因此，invariant 可以充当部分测试预言。

Parnas 等人希望找到领域专家也能使用的 specification 方法，提出从程序文档生成测试预言的 TOG（Test Oracles Generator）[143](#ref-143)、[146](#ref-146)、[149](#ref-149)。文档采用完全形式化的 tabular expression，规定 method signature、外部变量，以及起始状态与结束状态的关系 [105](#ref-105)。系统便可以自动生成测试预言，按照指定状态检查输出。这条研究路线持续发展了二十多年 [48](#ref-48)、[59](#ref-59)、[60](#ref-60)、[145](#ref-145)、[150](#ref-150)、[190](#ref-190)、[191](#ref-191)。

#### 4.1.2 State transition system

State transition system 常采用图形语法，重点描述系统在不同状态之间的 transition。这里的 state 通常是对一组具体系统状态的抽象，因此这类系统在文献中也称 visual language [197](#ref-197)。代表方法包括 Finite State Machine [112](#ref-112)、Mealy/Moore machine [112](#ref-112)、I/O Automata [118](#ref-118)、Labeled Transition System [180](#ref-180)、SDL [54](#ref-54)、Harel Statecharts [81](#ref-81)、UML state machine [28](#ref-28)、X-Machine [95](#ref-95)、[96](#ref-96)、Simulink/Stateflow [179](#ref-179) 和 PROMELA [97](#ref-97)。Mouchawrab 等人对利用这类模型构建测试预言的技术做过严格的 empirical evaluation [70](#ref-70)、[138](#ref-138)。

其中一类重要模型只有有限个 state，适合自动推理那些能够用有限取值状态描述的系统行为 [93](#ref-93)。模型中的 transition 表示导致状态改变的 stimulus。输出可以是 state 的属性，例如 Moore machine 的最终状态。也可以由经过的 transition 表示，例如 Mealy machine。

这里需要区分 state 的两种含义。在一般程序执行语境中，state 往往指某时刻系统配置的快照。在 state transition system 中，它通常指一组配置的抽象。

模型是对 SUT 的近似，两者行为存在差异在所难免。有些差异只是建模造成的偏差，却会导致误报。嵌入式系统对事件发生时间敏感，state transition model 尤其容易遇到这个问题。有研究通过 model steering 容忍时间上的虚假差异。SUT 和模型出现偏差时，先回退模型，再调整 timer 值或输入，按某种 similarity measure 缩小两者距离 [74](#ref-74)。

Protocol conformance testing [72](#ref-72)，以及后来的 model-based testing [183](#ref-183)，推动了大量相关研究。给定 state transition system 形式的 specification `F`，例如 FSM，可以从 `F` 的 transition sequence 提取 test case。序列中的 transition label 定义输入。由 `F` 构造测试预言时，如果 `F` 接受该序列并产生某个输出，SUT 也应该接受并给出相应输出。如果 `F` 不接受该输入，SUT 也不应接受。

但 conformance 的定义并不唯一。它取决于模型是否确定、SUT 在给定 test case 上的行为是否可观察，以及是否能在与模型相同的抽象层次解释这些行为。由此产生了 isomorphic、equivalent 和 quasi-equivalent 等不同的一致性概念。Lee 和 Yannakakis 在 20 世纪 90 年代中期的经典综述 [112](#ref-112)，以及 Bochmann 等人 [26](#ref-26) 和 Tretmans [180](#ref-180) 的研究，对这些概念作了定义。

### 4.2 Assertion 与 contract

Assertion 是放在程序特定位置、在运行时检查行为的 boolean expression。某次执行中，assertion 为 `true`，表示该位置的行为符合这项检查的预期。为 `false`，则表示发现了错误。因此，assertion 可以直接用作测试预言。

Assertion 嵌入实现语言，这使它与独立的 specification language 有两点不同。首先，它可以直接引用程序变量，定义变量之间的关系，从而在其能够表达和检查的属性范围内，缩小 specification 与 implementation 的距离。从这个角度看，assertion 是 specification language 向 iterative refinement 演进的自然结果。其次，assertion 通常与受检查代码一同编写，而 specification 往往先于实现。

Assertion 的历史可以追溯到 Turing [181](#ref-181)。他较早提出开发者与测试人员应当分工，通过 assertion 沟通，由开发者编写、测试人员检查。Floyd [64](#ref-64) 和 Hoare [94](#ref-94) 的奠基性工作用 assertion 描述语言语义。后来，contract-based programming 将它作为提高代码质量的手段，Eiffel 是其中的代表 [136](#ref-136)。

常见编程语言已经提供 assertion 构造。例如 C、C++ 和 Java 的 `assert`，以及 C# 的 `Debug.Assert`。还有独立开发的嵌入式 assertion 系统，例如 Ada 的 Anna [117](#ref-117)，以及 C 语言的 APP [156](#ref-156) 和 Nana [120](#ref-120)。

实际中，assertion 只能在程序特定位置检查有限的属性 [49](#ref-49)。基于 Design by Contract 原则的语言扩展了表达能力，可以用 method precondition、postcondition 和 class invariant，检查 client object 与 supplier object 之间的 contract。Eiffel 最早提供这项语言特性 [136](#ref-136)，后来其他语言也通过扩展获得类似能力，例如 Java 的 Java Modeling Language（JML）[140](#ref-140)。

Cheon 和 Leavens 展示了如何基于 JML 构建基于 assertion 的测试预言 [45](#ref-45)。Coppit 和 Haddox-Schatz 对此类测试预言作过评估 [49](#ref-49)，Cheon 后来又提出了相关方法 [44](#ref-44)。Assertion 和 contract 都是在代码中强制执行的 observation activity。Araujo 等人在大型工业系统上系统评估了 Design by Contract [9](#ref-9)，也具体研究了 JML [8](#ref-8)。Briand 等人则展示了通过插桩 contract 支持测试的方法 [33](#ref-33)。

### 4.3 Algebraic specification language

Algebraic specification language 通过接口定义软件模块。接口的 signature 包含 sort 和 operation symbol，equational axiom 规定操作必须满足的属性。等价关系通常通过 term rewriting 计算 [15](#ref-15)。语言还提供把 sort 和 operation 组织起来的结构机制，以便组合接口。通常可以用 first-order logic 证明 specification 的属性，例如 refinement 的正确性。Abstract Data Type（ADT）将数据与数据操作组合起来，很适合采用 algebraic specification。

DAISTS 是较早用于实现、指定和测试 ADT 的 algebraic specification 系统之一 [69](#ref-69)。其 equational axiom 通常将受限 ALGOL 60 方言中的 term-rewriting expression，与实现语言中的 function composition 对照。例如：

```text
Pop2(Stack S, EltType I) :
  Pop(Push(S, I)) = if Depth(S) = Limit
                   then Pop(S)
                   else S;
```

这份 specification 区分 accessor `Top` 和 mutator `Pop`。`Top` 返回栈顶元素而不修改栈。`Pop` 返回去掉原栈顶元素的新栈。测试预言对 test suite 分别执行公理表达式和对应的已实现函数组合。如果结果不同，说明实现或公理中存在 failure。如果相同，则增加了对两者正确性的信心。

Gaudel 及其合作者较早提出了基于 algebraic specification 的一般测试理论 [19](#ref-19)、[20](#ref-20)、[72](#ref-72)、[73](#ref-73)。他们认为，由 ground term，即没有自由变量的 term，组成的穷尽 test suite 足以判断程序正确性。但变量的取值范围可能无限，从而产生无限多个 test case。所有测试都受制于 test suite 必须有限这一现实条件，因此只能放弃穷尽覆盖，选择有限子集 [20](#ref-20)。

Gaudel 的理论重视 observational equivalence，但 observational inequivalence 同样重要 [210](#ref-210)。Frankl 和 Doong 因此把理论扩展为同时表达相等与不等 [52](#ref-52)，提出适用于面向对象程序的记号，开发了 LOBAS specification language 和 ASTOOT test harness。他们要求 class 实现测试方法 `EQN`，由 ASTOOT 用它检查同一 class 的两个 instance 是否等价。

从观察者角度看，object 有可观察状态，也有不可观察的 hidden state。可观察状态通常包括 public field 和 method return value。`EQN` 提高了代码的 testability，使 ASTOOT 可以通过一系列 message 或 method call，近似判断两个 object 的 observational equivalence。ASTOOT 检查 object 与 LOBAS specification 是否等价时，就实现了显式指定的测试预言。

Chen 等人在 ASTOOT 基础上开发了 TACCLE [40](#ref-40)、[41](#ref-41)，利用 white-box heuristic 生成数量有限且与目标有关的 test case。他们构建 data relevance graph：一个 field 会影响另一个 field 时，就连接两者。比较两个 instance 是否等价时，只考虑可能影响 class 可观察属性的因素。

Algebraic specification 已经形成丰富的研究成果，包括 Daistish [100](#ref-100)、LOFT [123](#ref-123)、CASL [11](#ref-11) 和 CASCAT [205](#ref-205) 等语言与工具。测试对象从 ADT 扩展到 class，再到 component。各项目在 test case generation 和 test harness creation 的自动化程度上有所不同。Bochmann 等人用 LOTOS 从 algebraic specification 实现测试预言函数 [184](#ref-184)，Zhu 也研究了将其作为测试预言的问题 [210](#ref-210)。

#### 4.3.1 显式指定的测试预言面临的问题

构建显式指定的测试预言有三个主要难点。首先，formal specification 经常缺失，本文其他几类测试预言正是在这种情况下构造判定依据。其次，formal specification model 必须依赖抽象，可能引入不精确性，包含不可行行为，或遗漏检查 specification 所需的行为 [68](#ref-68)。最后，还必须解释模型输出，并将它与具体程序输出对应起来。

Specification 给出的结果通常很抽象，程序执行结果的表示形式则未必方便直接比较。Specification 的结果本身也可能不完整或过度简化。因此，Gaudel 指出，有 formal specification 并不保证能得到成功的 test driver [72](#ref-72)。为了正确解释结果，可能需要定义具体的 equivalence function [119](#ref-119)。跨抽象层次比较结果的办法，主要取决于抽象程度，也在一定程度上取决于 SUT 的实现。

## 5 推导的测试预言（derived test oracle）

推导的测试预言利用不同 artefact、SUT 的属性或其他版本，推导区分正确与错误行为的依据。Artefact 可以是文档或系统执行记录。显式指定的测试预言不可用时，测试人员就会采用推导的测试预言。这种情况很常见，因为 specification 即使存在，也很快会过时。

推导得到的测试预言也可能逐渐成为部分显式指定的测试预言，从本节的类别迁移到上一节。例如，JWalk 逐步学习被测 class 的 algebraic property [170](#ref-170)，并允许测试人员交互确认，让人参与 learning loop。

本节依次讨论伪测试预言与 N-version programming、metamorphic relation、regression test suite、从系统执行推断模型，以及从文本中提取测试预言信息。前三者分别关注独立实现的一致性、同一实现在不同执行之间应满足的关系，以及不同版本之间应满足的关系。

### 5.1 伪测试预言（pseudo-oracle）

Davies 和 Weyuker 较早提出伪测试预言 [50](#ref-50)，用于处理所谓 non-testable program。这类程序的特点是：“编写程序本来就是为了求出答案。如果正确答案已经知道，就没有必要编写它们。”[196](#ref-196)

伪测试预言是独立产生的另一个程序版本，例如由不同团队开发，或使用完全不同的编程语言实现。用第 2 节的 formalism 表示，它接受以下形式的 test activity sequence：

<div class="math">
\[
f_1(x)o_1f_2(x)o_2:[f_1\ne f_2\land o_1=o_2]. \tag{1}
\]
</div>

其中 `f₁, f₂ ∈ C` 是独立产生的替代实现，接收相同输入值。它与 DAISTS 等 algebraic specification 系统有相似之处。实现语言中的 function composition 和 term-rewriting expression 是两种不同实现，要求两者输出一致，就形成了伪测试预言。

Fault-tolerant computing 中也有类似思路，称为 multi-version 或 N-version programming [13](#ref-13)、[14](#ref-14)。同一软件有多种实现，并行运行。结果不同时，通过 voting mechanism 决定采用哪个输出。原文用以下形式表示 N-version 测试预言接受的 test activity：

<div class="math">
\[
\begin{aligned}
&f_1(x)o_1f_2(x)o_2\cdots f_k(x)o_k:\\
&[\forall i,j\in[1..k],\;i\ne j\Rightarrow f_i\ne f_j\\
&\qquad\land\operatorname*{arg\,max}_{o_i}m(o_i)\ge t]. \tag{2}
\end{aligned}
\]
</div>

输出构成 multiset，`m` 表示某个元素出现的次数，即 multiplicity。`arg max` 找到使函数值最大的参数，在这里就是出现次数最多的输出。随后应把最大出现次数与阈值 `t` 比较。令 `Dnv(w, x)` 表示式（2）中阈值取 `x` 的测试预言。原文将 `Dmaj(w) = Dnv(w, ⌈k/2⌉)` 描述为要求多数输出一致的测试预言。`Dpso(w) = Dnv(w, k)` 则要求全部 `k` 个实现一致，是伪测试预言的推广。

> 译注：式（2）沿用所提供 PDF 的记号。按紧随其后的文字解释，应比较 `max m(oᵢ) ≥ t`。`arg max` 返回输出值本身，不能一般性地当作出现次数。另一个边界问题是，严格多数要求 `⌊k/2⌋ + 1` 票。原文的 `⌈k/2⌉` 在 `k` 为偶数时只要求一半。

Feldt 研究过用 genetic programming 自动生成不同版本 [58](#ref-58)。McMinn 则探索了 program transformation，以及用 specification 相近的软件元素替换现有元素，生成用于测试的不同版本 [128](#ref-128)。

### 5.2 Metamorphic relation

假设 SUT `p` 实现函数 `f`。Metamorphic relation 是多个 `f` 调用之间预期成立的关系，也应当在 `p` 的多次执行中成立。例如，`f(x) = eˣ` 时，`eᵃe⁻ᵃ = 1` 就是一条 metamorphic relation。若 `p` 正确，应满足 `p(0.3) * p(-0.3) = 1` [43](#ref-43)。关键在于，通过推理 `f` 的属性，得到实现 `p` 必须遵守的关系。

Metamorphic testing 利用这些关系，为 follow-up test case 生成部分测试预言：执行某些 test case 后，检查 SUT 的重要属性 [36](#ref-36)。Metamorphic relation 描述的是 ground truth，即 SUT 试图实现的正确现象，因此也可以看成产生显式指定的测试预言的机制。本文把它放在推导的测试预言一类，是因为实践中的关系通常由人检查 SUT 的 white-box 信息后推导。

Metamorphic relation 关联同一实现的不同执行，输入不必相同。algebraic specification 则比较同一 specification 的两个不同实现，一种使用实现语言，另一种使用不涉及实现细节的形式体系，通常是 term rewriting [15](#ref-15)。

用第 2 节的 formalism，可以写成：

<div class="math">
\[
f(x_1)o_1f(x_2)o_2\cdots f(x_k)o_k:[expr\land k\ge2].
\]
</div>

其中 `expr` 是输入 `xᵢ` 与输出 `oᵢ` 上的约束，通常是算术约束。这个定义表明，metamorphic relation 至少对同一个 SUT 施加两次 stimulus，观察 response，再约束它们之间的关系。相比之下，algebraic specification 属于式（1）中的伪测试预言。对两个不同实现使用相同输入，并要求输出等价。

人们常把 metamorphic relation 理解为可用算术等式表达的数值属性，但它的适用范围更广。Zhou 等人用 metamorphic testing 测试 Google 和 Yahoo! 等搜索引擎 [209](#ref-209)，关系就建立在非数值的搜索结果一致性上。他们的一个例子是在 ACM Digital Library 搜索论文：两次 advanced search 都失败了，第二次还给查询加了引号，但与第一次内容相同的 general search 却成功了。

由此可以构造关系，例如 `R_OR: A₁ = (A₂ ∪ A₃) ⇒ |A₂| ≤ |A₁|`，其中 `Aᵢ` 是相应查询返回的网页集合。Metamorphic testing 也为上一节提到的 Weyuker 的 non-testable program 提供了测试手段。

如果 SUT 不确定，例如 classifier 每次运行的具体输出都可能不同，仅以输出相等定义关系通常不够。Murphy 等人研究了 set intersection 等非相等关系，用来关联 stochastic machine learning algorithm 的输出 [139](#ref-139)、[140](#ref-140)。Guderlei 和 Mayer 提出 statistical metamorphic testing，以统计分析检查输出之间的关系 [80](#ref-80)，后来也用于 stochastic optimisation algorithm [203](#ref-203)。

Metamorphic testing 最大的难点，是自动发现 metamorphic relation。已有关系有些基于数学性质 [36](#ref-36)、[37](#ref-37)、[42](#ref-42)，有些基于组合性质 [139](#ref-139)、[140](#ref-140)、[161](#ref-161)、[203](#ref-203)。发现 algebraic specification 的工作 [88](#ref-88)，以及 JWalk 的 lazy systematic unit testing [170](#ref-170)，可能有助于发现关系。在 JWalk 中，specification 随工具与开发者的交互逐步、按需学习。

例如，开发环境可以跟踪开发阶段执行的 test case 输出关系，发现某种关系在多次运行中成立后，将其作为候选 metamorphic relation 交给开发者确认。已有研究利用领域知识形成这类关系 [38](#ref-38)，但在原文写作时仍处于早期阶段，尚未自动化。

> 译注：本节统一使用 `xₖ` 和 `oᵢ` 表示最后一次输入及各次输出，修正 PDF 相应通式中混用 `iₖ`、`oₓ` 的下标笔误。指数函数的等式保留数学层面的表述。在浮点实现中，通常需要明确比较容差。

### 5.3 Regression test suite

Regression testing 检查对 SUT 新版本的修改是否破坏既有功能 [204](#ref-204)。它隐含地假设，旧版本可以充当既有功能的测试预言。

对于 corrective modification，预期功能没有变化，因此版本 `i` 的测试预言 `Dᵢ` 可以用于下一版本 `Dᵢ₊₁`。修复可能未能解决目标问题，也可能破坏其他功能。可以通过 symbolic comparison 比较缺陷版本与声称已修复版本的执行，构造针对这些问题的测试预言 [79](#ref-79)。Orstra 在旧版本上执行 regression test suite，观察程序状态，再生成基于 assertion 的测试预言 [199](#ref-199)。加入 assertion 的 test suite 随后用于新版本。类似地，spectra-based 方法使用旧版本的 program spectra 和 value spectra，检测新版本中的 regression fault [86](#ref-86)、[200](#ref-200)。

对于增加新功能的 perfective modification，必须修改 `Dᵢ`，让它涵盖新增行为，即 `Dᵢ₊₁ = Dᵢ ∪ ΔD`。Test suite augmentation 专门研究识别和生成 `ΔD` 的方法 [6](#ref-6)、[132](#ref-132)、[202](#ref-202)。但当时的相关技术还需要进一步发展，才能在增加测试输入的同时补全预期输出，从而一起扩展测试预言与 test data。

还有一类修改来自 specification 的变化。原 specification 可能未能满足需求，也可能是需求本身发生了变化。文献通常也把它归为 perfective maintenance，却未区分两种情况：在不改变既有需求的前提下增加功能，以及因需求变化或 specification 错误而修改既有行为。

第 2 节的 formalism 要求区分它们，因为两者对测试预言的影响完全不同。本文把后一类称为 changed requirements。记 `dom(f)` 为函数 `f` 的定义域。对 `f: X → Y`，有 `dom(f) = X`。需求变化意味着存在某个活动序列 `α`：

<div class="math">
\[
\exists\alpha\cdot D_{i+1}(\alpha)\ne D_i(\alpha).
\]
</div>

因此 `dom(Dᵢ₊₁) ∩ dom(Dᵢ) ≠ ∅`，不能简单将新行为与旧测试预言取并集，而应在变更涉及的定义域内覆盖旧判定：

<div class="math">
\[
D_{i+1}(\alpha)=
\begin{cases}
\Delta D(\alpha), & \alpha\in\operatorname{dom}(\Delta D),\\
D_i(\alpha), & \text{otherwise}.
\end{cases}
\]
</div>

### 5.4 系统执行

系统的 execution trace 可以用来推导测试预言。也可以把错误执行与 temporal logic 表达的预期执行对齐，降低人工测试预言的成本 [51](#ref-51)。从 trace 推导测试预言的两种主要技术是 invariant detection 和 specification mining。两者都能自动检查预期行为，作用类似于第 4.2 节的 assertion-based specification。

#### 5.4.1 Invariant detection

程序行为可以自动与 invariant 比较，所以 invariant 可以帮助区分正确和错误输出。如果事先没有 invariant，也可以从程序中自动或半自动学习。

Ernst 等人提出了一个知名方法 [56](#ref-56)，并实现于 Daikon [55](#ref-55)。工具准备一组候选 invariant，将其中变量绑定到程序变量，再用一组输入，即 test case，执行程序。执行中始终未被违反的候选被保留下来，称为 likely invariant。它们捕捉程序行为，可以用于检查正确性。例如，regression testing 可以检查旧版本推导出的 invariant 在新版本中是否仍然成立。

在本文的 formalism 中，Daikon 可以定义一个不保证 sound 的测试预言。先从 test activity sequence 的前缀收集 likely invariant，再用它们约束后缀。令 `Iⱼ` 为第 `j` 个 observation 时的候选集合，`I₀` 为初始候选集合。对前缀 `r₁r₂…rₙ`，保留：

<div class="math">
\[
I_n=\{x\in I_0\mid\forall i\in[1..n],\;r_i\models x\}.
\]
</div>

`⊨` 表示 logical entailment。每次 observation 为相关变量确定取值，候选 invariant 据此成立或不成立。只有未被任何 observation 否定的候选留在集合中。到后缀 `rₙ₊₁rₙ₊₂…rₘ`，测试预言改为只接受满足 `Iₙ` 的 observation，即 `rᵢ:[rᵢ ⊨ Iₙ]，i > n`。

Invariant detection 的计算可能很昂贵，已有研究引入 incremental 方法 [22](#ref-22)、[171](#ref-171) 和 lightweight static analysis [39](#ref-39)、[63](#ref-63)。一份 technical report 汇总了多种 dynamic analysis 技术 [158](#ref-158)。Model inference [90](#ref-90)、[187](#ref-187) 也可以看作 invariant generation，只是 invariant 用模型表达，通常是 FSM。Ratcliff 等人利用 Search-Based Software Engineering（SBSE）[84](#ref-84) 搜索 invariant，并用 mutation testing 引导搜索 [154](#ref-154)。

推导 invariant 的准确性部分取决于 test case 的质量与完整程度。增加 test case 能提供更多数据，帮助得到更准确的 invariant [56](#ref-56)。不过，以当时的技术，几乎不可能推导出完美的 invariant，错误或无关的结果仍然常见 [152](#ref-152)。Wei 等人利用 Eiffel 代码已有的 contract，推导 command 而非 query 的 postcondition，其中可以包含量化表达式，或前提为多个公式合取的 implication [192](#ref-192)、[193](#ref-193)。

人可以筛掉错误 invariant、保留正确结果，但人工筛选也容易出错。Staats 等人的 empirical study 发现，Daikon 从一组 Java 程序中推导出的错误 invariant，有一半被参与者误判 [175](#ref-175)。尽管存在这些问题，dynamic invariant inference 在当时仍保持了较强的研究势头，主要应用方向是 test generation [10](#ref-10)、[142](#ref-142)、[207](#ref-207)。

#### 5.4.2 Specification mining

Specification mining 或 inference 从一组 observation 推导程序行为的 formal model。按本文的 formalism，测试预言可以用模型约束 test activity。Weyuker 在利用 inference 评估 test data adequacy 的早期工作中，把 inference 和 testing 视为互逆过程 [194](#ref-194)。testing 从程序出发，寻找能够刻画预期行为与实际行为的 I/O pair。inference 则从一组 I/O pair 出发，构造符合这些行为的程序。

其 inference adequacy 可以非形式化地表述为：程序 `P` 旨在满足 specification `S`，I/O pair 集合 `T` 是 inference adequate test set，当且仅当通过某种 inference procedure 从 `T` 推导出的程序 `I_T`，同时等价于 `P` 和 `S`。两者有任何差异，都意味着推导程序与实际程序或预期 specification 不等价，说明用于 inference 的 test set 不充分。

Inference 主要依赖用于学习的 I/O pair。它们可以通过 runtime monitoring 被动收集，也可以通过查询系统主动获取 [106](#ref-106)。但 equivalence checking 一般不可判定，因此只能在受限程序类别中完成这种 inference，例如行为可用 FSM 描述的程序 [194](#ref-194)。在这种限制下，可以通过实验判断等价 [89](#ref-89)，但实验仍有严格的实际局限，详见 Lee 和 Yannakakis 的综述 [112](#ref-112)。

Inference 与 testing 的结合产生了许多技术，尤其适合没有源代码或行为模型的 black-box system。大量研究采用 L* learning algorithm，把 black-box system `B` 学习为有 `n` 个 state 的 FSM [7](#ref-7)。算法反复查询 `B` 并观察输出。如果一个 string 使两个 FSM 中恰有一个停在 final state，它就能区分这两个 FSM。每次迭代先得到一个含 `i < n` 个 state 的模型 `Mᵢ`，再利用区分 `B` 和 `Mᵢ` 的 string 细化模型，直到达到 `n` 个 state。

Lee 和 Yannakakis 展示了如何用 L* 检查 `B` 是否符合 specification `S` [112](#ref-112)。先推导模型 `Mᵢ`，计算能区分 `Mᵢ` 与 `S` 的 string，再通过算法细化模型。如果在 `i = n` 时 `Mₙ` 就是 `S`，则判定 `B` 正确。否则判定存在 fault。

除了 conformance testing，inference 也用于引导 test generation 聚焦特定行为、缩小分析范围。Li 等人将 L* 用于 black-box component 系统的 integration testing [114](#ref-114)。他们从 test suite 的动态执行中推导系统模型，再搜索模型中的 deadlock 等错误行为，并用它检查 fuzz testing 下的系统行为。

为了发现 asynchronous black-box system 的并发问题，Groz 等人通过 active learning 提取行为模型 [78](#ref-78)，再进行 reachability analysis [27](#ref-27)，重点检测 race 等问题。

Shahbaz 汇总了相关工作及工业应用 [166](#ref-166)。类似应用还出现在 system analysis [21](#ref-21)、[78](#ref-78)、[135](#ref-135)、[188](#ref-188)、[189](#ref-189)、component interaction testing [115](#ref-115)、[122](#ref-122)、regression testing [200](#ref-200)、security testing [168](#ref-168) 和 verification [53](#ref-53)、[77](#ref-77)、[148](#ref-148) 中。

Zheng 等人从网页搜索查询与结果中提取 item set，再用 association rule mining 推导规则，以此为搜索引擎构造推导的测试预言 [208](#ref-208)。搜索引擎此前曾被认为难以测试。Image segmentation 用来标出图像中的目标对象，其程序开发是一个繁琐的迭代过程。Frounchi 等人成功用 semi-supervised machine learning 为这类程序建立测试预言 [67](#ref-67)。Memon 等人提出并发展了 GUITAR [133](#ref-133)、[134](#ref-134)、[198](#ref-198)，评估时把 SUT 当前版本视为正确实现，据此推导 specification，再运行生成的测试输入。Artificial Neural Network 也被用于学习系统行为并检测偏离 [163](#ref-163)、[164](#ref-164)。

多数 specification mining 方法采用 FSM 作为结果形式，以捕捉 SUT 的功能行为 [21](#ref-21)、[27](#ref-27)、[53](#ref-53)、[77](#ref-77)、[78](#ref-78)、[89](#ref-89)、[112](#ref-112)、[114](#ref-114)、[135](#ref-135)、[148](#ref-148)、[166](#ref-166)、[168](#ref-168)、[189](#ref-189)。有些扩展时间约束 [188](#ref-188)，有些加入数据约束 [115](#ref-115)、[122](#ref-122)，其中数据约束又可由 Daikon 推导 [56](#ref-56)。

其他结果形式也各有用途。Büchi automata 用于检查 black-box system 的属性 [148](#ref-148)。Annotated call tree 在 regression testing 中表示不同版本的行为 [200](#ref-200)。GUI widget 可以直接建模为 object 及其 property [133](#ref-133)、[134](#ref-134)、[198](#ref-198)。Artificial Neural Network 和 machine learning classifier 可以学习预期行为 [67](#ref-67)、[163](#ref-163)、[164](#ref-164)。对搜索结果这类动态且模糊的行为，可以用输入 query 与输出字符串之间的 association rule 表示推导出的测试预言 [208](#ref-208)。

### 5.5 文本文档

文本文档包括自然语言需求，也包括详细描述 API 功能的结构化文档。它们以不同程度描述 SUT 的预期功能，因此可以作为生成测试预言的基础。文档一般面向人阅读，不为 formal logic 或数学推理而写，所以相较 specification language，往往不完整、有歧义。但开发者比起 formal specification 更可能编写文档，这使它成为重要的信息来源。用第 2 节的说法，文档给出了测试预言 `D` 应当施加在 test activity 上的约束。

自然语言本身有歧义，文档又常常不精确、不一致，乍看之下似乎不可能自动推导测试预言。实际测试中，文档的使用也往往局限于人工阅读 [144](#ref-144)。不过，仍可以利用部分自动化协助测试人员。

已有两类方法。一类将非形式化文本 artefact 转成 formal specification，来源包括文字 specification、用户与开发者文档，甚至源代码注释。另一类限制自然语言的表达范围，只使用适合自动处理的半形式化子集。

#### 5.5.1 将文本转成 specification

Prowell 和 Poore 提出 sequential enumeration 方法，从 informal specification 构造 formal specification [153](#ref-153)。它系统枚举输入域中的所有序列，再映射对应输出，以建立一份可认为完整、一致且正确的 specification。但 I/O sequence 的数量可能指数增长，因此他们引入 abstraction 控制规模。最终结果可以转换为 state transition system 等多种记号。这种方法的一项明显收益，是能发现许多不一致或遗漏的需求，让 specification 更完整、精确。

#### 5.5.2 限制自然语言

限制自然语言的 grammar 和 lexicon，可以用简洁词汇表达需求，尽量减少歧义。这既便于解释文档，也使自动推导测试预言成为可能。提出此类 specification language 的研究者认为，model-based specification language 尚未广泛采用，与普通程序员不易理解其 formalism 和集合论基础有关。

Schwitter 提出了计算机可处理的受限自然语言 PENG [160](#ref-160)。它是标准英语的严格子集，采用受限 grammar，为实义词提供领域 lexicon，并预定义 function word。PENG 文档可以确定地转换为 first-order predicate logic。Schwitter 等人还给出了用 PENG 编写 test scenario 的指导，以便自动判断程序行为是否正确 [30](#ref-30)。

## 6 隐含的测试预言（implicit test oracle）

隐含的测试预言依赖一般性的隐含知识，区分系统行为是否正确。例如，buffer overflow 和 segfault 几乎总是错误。它的关键特点是，实现不需要领域知识或 formal specification，且适用于几乎所有程序。

任何能够检测异常的过程，都可能成为隐含的测试预言，例如检测 crash 导致的异常终止或 execution failure [34](#ref-34)、[167](#ref-167)。这些异常本身足够明显，不需要更多信息就能判断行为有误。在本文的 formalism 中，隐含的测试预言把某个上下文里的一部分 stimulus-response relation 定义为必然 failure。

但隐含的测试预言并非普遍有效。同一行为在某个系统或上下文中异常，换到另一个系统或上下文可能就正常。即使 crash 也可能被接受，甚至正是预期行为，例如专门寻找 crash 的系统。

软件工程早期已经出现相关研究。最初的工作主要检测 deadlock、livelock 和 race，处理并发问题 [24](#ref-24)、[107](#ref-107)、[185](#ref-185)、[16](#ref-16)、[169](#ref-169)。随着面向对象方法的发展，non-functional testing 也受到广泛关注。Performance testing 中，系统 throughput 等指标可以暴露性能退化 [121](#ref-121)、[124](#ref-124)，例如同时发送多个请求后服务器不再响应。Weyuker 和 Vokolos 的案例研究展示了 CPU 使用过高的进程如何造成服务延迟与中断 [195](#ref-195)。

Memory leak 测试预言可以建立在运行时 profiling 上，检测引用和内存管理异常 [12](#ref-12)、[57](#ref-57)、[87](#ref-87)、[211](#ref-211)。例如，Xie 和 Aiken 用 boolean constraint system 表示动态分配的 object。object 已不可达却尚未释放时，系统发出告警 [201](#ref-201)。

> 译注：原文在这段同时提及 dangling reference 和 memory leak，两者应区分。Dangling reference 指引用仍存在、所指内存已失效。memory leak 则涉及不再需要的内存未被释放。这里的 Xie 和 Aiken 例子讨论的是后者。

Fuzzing 是发现 crash 等隐含异常的有效方法 [137](#ref-137)。它生成随机或 fuzz input，送入系统并观察异常。这样做能奏效，是因为 implicit specification 通常约束所有输入，而 explicit specification 往往只规定某些输入子集与输出之间的关系。发现异常后，fuzz tester 报告问题及触发输入。Fuzzing 常用于发现 buffer overflow、memory leak、unhandled exception 和 denial of service 等安全问题 [18](#ref-18)、[177](#ref-177)。

还有研究专门构造检测异常的 pattern。Ricca 和 Tonella 检查 Web application 中的一部分异常，包括导航问题和 hyperlink inconsistency [155](#ref-155)。在他们的 empirical study 中，60% 的被测 Web application 出现了异常或 execution failure。

## 7 人工测试预言问题

前面各节都假设存在某种 artefact，可作为完整测试预言或部分测试预言的基础。但很多时候，没有这样的 artefact，只能由测试人员判断给定 stimulus 下的软件行为是否正确。即使没有自动化测试预言，软件工程研究仍能减少人工创建测试预言，或亲自执行判定的工作量。这类成本称为人工测试预言成本（Human Oracle Cost） [126](#ref-126)，主要包括编写测试预言，以及评估测试结果两个方面。

在编写测试预言方面，Staats 等人的工作具有代表性 [173](#ref-173)。他们指导测试人员关注代码中需要写测试预言的位置，降低构建成本。这与没有自动化测试预言时，减少人工检查测试结果的成本有所不同。Dodona 是另一项研究成果，它向人推荐测试预言数据，再由人决定是否将其用于 Java unit test [116](#ref-116)。工具通过 network centrality analysis 和 data flow，推断程序执行中变量之间的关系。

降低人工测试预言成本的研究，大体分两种。Quantitative reduction 在相同 test coverage 下减少测试人员需要处理的工作量。qualitative reduction 则降低理解和评估 test case 的难度。

### 7.1 人工测试预言的工作量成本

Test suite 可能过大，每个 test case 覆盖的测试目标又很少。单个 test case 也可能过长，含有大量对目标无贡献的 method call。人工测试预言成本的数量缩减希望缩小 test suite 和 test case，让每个 case 及其组成部分产生更多收益，从而减少人工检查工作。

用本文的 formalism 描述，数量上的缩减试图对 test activity sequence 集合分区，让人只检查代表性序列。test case reduction 则缩短序列本身。

#### 7.1.1 Test suite reduction

传统方法把 test suite reduction 作为已有 test suite 的后处理步骤，例如 Harrold 等人 [85](#ref-85)、Offutt 等人 [141](#ref-141) 和 Rothermel 等人 [157](#ref-157) 的工作。Search-based testing 的较新研究，尝试将输入生成与 test suite reduction 合并在同一阶段，直接产生更小的 test suite。

Harman 等人生成能够深入程序 control dependence graph 的 test case，让每个 case 尽可能执行更多程序元素 [82](#ref-82)。Ferrer 等人同时优化 branch coverage 和 test suite size [61](#ref-61)，主要目的是比较多种 multi-objective optimisation algorithm，包括 Non-dominated Sorting Genetic Algorithm II（NSGA-II）、Strength Pareto EA 2（SPEA2）和 MOCell。在一组随机生成的程序和小型 benchmark 上，MOCell 表现最好。

Taylor 等人把推导模型作为语义测试预言，缩小 test suite [178](#ref-178)。Fraser 和 Arcuri 的 EvoSuite 为 Java 生成整个 test suite [65](#ref-65)，因此能同时最大化 coverage、最小化 suite size，帮助人工测试预言降低检查成本。

#### 7.1.2 Test case reduction

为面向对象系统随机生成 test case 时，短时间内就可能产生很长的 trace，包含许多与具体测试目标无关的 method call，例如并不帮助覆盖目标 branch 的调用。这些调用无谓地增加了测试预言成本。Leitner 等人使用 Zeller 和 Hildebrandt 的 Delta Debugging [206](#ref-206)，移除这类调用 [113](#ref-113)。JWalk 则删除序列中没有 side effect 的 function，降低人工判定成本 [170](#ref-170)。

Quick test 希望高效利用有限测试预算，构造足够快的 test suite，使其能在编译后运行 [76](#ref-76)。它们需要有较高概率触发 bug，并产生短 trace，因此也更容易让人理解。

### 7.2 人工测试预言的理解成本

降低人工测试预言成本，还可以从理解难度入手，改善人处理 test case 和 test activity 的便利程度。SUT 的 input profile，是系统在实际运行环境中处理的输入分布。学习这个分布需要领域知识。如果 test data generation 不包含这类知识，机器生成的数据分布就可能偏离实际 input profile。

这种偏离可能有利于发现某些 fault，但计入测试预言成本后，收益可能下降。测试人员必须先理解数据代表什么场景，才能正确评估输出。任意数据通常比有意义、可识别的数据难懂，因而增加检查时间。

改善理解难度的各种方法，都会引入人的知识。本文讨论三类：扩展开发者设计的 test suite；从网页、Web service 和自然语言中计算 realistic input；挖掘 usage pattern，并在 test case 中重现。

McMinn 等人建议，把人的知识纳入 test data generation，以提高自动生成 test case 的可读性 [126](#ref-126)。在 search-based 方法中，可以用人工来源的 case 作为 seed，例如程序员执行的 sanity check、已有的部分 test suite，或 prorogued programming 等让开发者参与计算的编程方法产生的 I/O example [2](#ref-2)。

String test data 尤其容易出问题。自动生成器往往生成毫无意义的字符串。这类字符串属于 fuzz testing 的一种形式，适合探索不常见的浅层路径、发现 corner case，但不太容易触及 control flow 深处的功能。原因是 control expression 中的 string comparison 通常比 numerical comparison 的约束更强，用均匀随机的 fuzzing 很难走到其中某个 branch。选择无意义输入的 fuzz testing，还是 realistic input 的测试，体现了 breadth-first search 与 depth-first search 之间的经典取舍。

Bozkurt 和 Harman 提出从 Web service 挖掘 realistic test input，把已知且可信 service 的输出，作为被测 service 更接近实际使用的输入 [32](#ref-32)。这类 case 可能更容易发现开发者关心的 fault，也更便于人理解。McMinn 等人同样从 Web 挖掘字符串辅助生成测试 [130](#ref-130)。网页内容通常由人编写，其中的真实词语或短语带有语义和领域上下文，可以作为 realistic test data 的来源。

Afshan 等人把 natural language model 与 metaheuristic 结合，生成可读字符串 [1](#ref-1)。Metaheuristic 是引导搜索过程的策略 [25](#ref-25)。Language model 根据字符组合，给出字符串属于某种语言的可能性评分。把评分纳入 fitness function 后，搜索既可以覆盖测试目标，也能生成比任意字符串更容易理解的输入。在多个 case study 中，人工测试预言对这些字符串的判断更快、也更准确。

Fraser 和 Zeller 从被测软件挖掘常见 API usage pattern，再尝试在生成的 test case 中重现 [66](#ref-66)。这样构造的场景更接近实际使用，也更为测试人员所熟悉。

### 7.3 Crowdsourcing 测试预言

另一种应对缺少测试预言的方法，是把判断任务交给在线平台上的大量参与者，即 crowdsourcing。Pastore 等人验证了这种方法的可行性 [147](#ref-147)，但也发现，测试问题需要以容易理解的方式呈现，还要提供足够的代码文档，参与者才能区分正确与错误输出。

他们通过通用 crowdsourcing 平台 [Amazon Mechanical Turk](http://www.mturk.com) 分配任务。当时也已经出现了专门测试 mobile application 的平台。这些服务主要应对设备种类激增的问题。开发者或测试人员未必拥有每种设备，但参与 crowdsourcing 的人可能拥有。原文列举了 [Mob4Hire](http://www.mob4hire.com)、[MobTest](http://www.mobtest.com) 和 [uTest](http://www.utest.com/)。

## 8 未来方向与结论

本文综述了显式指定、推导和隐含的测试预言，以及没有自动化测试预言时可以采用的技术，也分析了相关文献的发表趋势。讨论主要集中在传统方法上，仍有大量问题值得研究。除了深化各条路线、建立它们之间的联系，还可以探索新的方向。这里着重讨论测试预言复用和测试预言度量。

如前所述，测试预言不容易构建，因此复用值得专门研究。两条有希望的路线，是推广 reliable reset，以及在 Software Product Line（SPL）之间共享测试预言数据。

把 reliable reset 从初始状态推广到任意状态，可以连接程序的不同版本。这样便可能基于旧版本构建测试预言，再利用推广后的 reset 忽略或处理新增输入和功能。SPL 是系统的一组相关版本 [47](#ref-47)，可以看作一棵软件产品树：分支包含替代版本，每个版本都共享基础版本的一些核心功能。测试预言研究可以利用这类树形结构，构造相应的测试预言树，在可能的地方共享判定数据。

已有研究开始用测试预言衡量程序被测试的充分程度，相当于某种测试预言覆盖 [104](#ref-104)、[176](#ref-176)、[186](#ref-186)。也有研究评估 assertion 的质量 [159](#ref-159)。这方面仍需更多工作。测试预言度量为 software metrics 研究带来新的问题与机会。随着测试预言更普遍地使用，测试人员也需要有办法评价不同测试预言提供的能力。

原文同时提供了配套论文资料库地址：`http://crestweb.cs.ucl.ac.uk/resources/oracle_repository`。

## 9 致谢

感谢 Bob Binder 在本项研究开始时提供的信息与讨论。也感谢参加 2012 年 5 月 21–22 日在 University College London 举办的 CREST Open Workshop on the Test Oracle Problem 的各位，对早期工作报告提供反馈。许多被引用文献的作者还回复邮件，对论文早期稿件提出了有益意见，在此一并致谢。

## 参考文献

以下保留所提供 PDF 的 211 条英文著录及编号。正文中的编号对应这份稿件。

<span id="ref-1">[1]</span> Sheeva Afshan, Phil McMinn, and Mark Stevenson. Evolving readable string test inputs using a natural language model to reduce human oracle cost. In International Conference on Software Testing, Verification and Validation (ICST 2013). IEEE, March 2013.

<span id="ref-2">[2]</span> Mehrdad Afshari, Earl T. Barr, and Zhendong Su. Liberating the programmer with prorogued programming. In Proceedings of the ACM international symposium on New ideas, new paradigms, and reflections on programming and software, Onward! ’12, pages 11–26, New York, NY, USA, 2012. ACM. Track at OOPSLA/SPLASH’12.

<span id="ref-3">[3]</span> Wasif Afzal, Richard Torkar, and Robert Feldt. A systematic review of search-based testing for non-functional system properties. Information and Software Technology, 51(6):957–976, 2009.

<span id="ref-4">[4]</span> Bernhard K. Aichernig. Automated black-box testing with abstract VDM oracles. In SAFECOMP, pages 250–259. Springer-Verlag, 1999.

<span id="ref-5">[5]</span> Shaukat Ali, Lionel C. Briand, Hadi Hemmati, and Rajwinder Kaur Panesar-Walawege. A systematic review of the application and empirical investigation of search-based test-case generation. IEEE Transactions on Software Engineering, pages 742–762, 2010.

<span id="ref-6">[6]</span> Nadia Alshahwan and Mark Harman. Automated session data repair for web application regression testing. In Proceedings of 2008 International Conference on Software Testing, Verification, and Validation, pages 298–307. IEEE Computer Society, 2008.

<span id="ref-7">[7]</span> Dana Angluin. Learning regular sets from queries and counterexamples. Inf. Comput., 75(2):87–106, 1987.

<span id="ref-8">[8]</span> W. Araujo, L.C. Briand, and Y. Labiche. Enabling the runtime assertion checking of concurrent contracts for the java modeling language. In Software Engineering (ICSE), 2011 33rd International Conference on, pages 786–795, 2011.

<span id="ref-9">[9]</span> W. Araujo, L.C. Briand, and Y. Labiche. On the effectiveness of contracts as test oracles in the detection and diagnosis of race conditions and deadlocks in concurrent object-oriented software. In Empirical Software Engineering and Measurement (ESEM), 2011 International Symposium on, pages 10–19, 2011.

<span id="ref-10">[10]</span> Shay Artzi, Michael D. Ernst, Adam Kieżun, Carlos Pacheco, and Jeff H. Perkins. Finding the needles in the haystack: Generating legal test inputs for object-oriented programs. In 1st Workshop on Model-Based Testing and Object-Oriented Systems (M-TOOS), Portland, OR, October 23, 2006.

<span id="ref-11">[11]</span> Egidio Astesiano, Michel Bidoit, Hélène Kirchner, Bernd Krieg-Brückner, Peter D. Mosses, Donald Sannella, and Andrzej Tarlecki. CASL: the common algebraic specification language. Theor. Comput. Sci., 286(2):153–196, 2002.

<span id="ref-12">[12]</span> Todd M. Austin, Scott E. Breach, and Gurindar S. Sohi. Efficient detection of all pointer and array access errors. In PLDI, pages 290–301. ACM, 1994.

<span id="ref-13">[13]</span> A. Avizienis. The N-version approach to fault-tolerant software. IEEE Transactions on Software Engineering, 11:1491–1501, 1985.

<span id="ref-14">[14]</span> A. Avizienis and L. Chen. On the implementation of N-version programming for software fault-tolerance during execution. In Proceedings of the First International Computer Software and Application Conference (COMPSAC ’77), pages 149–155, 1977.

<span id="ref-15">[15]</span> Franz Baader and Tobias Nipkow. Term Rewriting and All That. Cambridge University Press, New York, NY, USA, 1998.

<span id="ref-16">[16]</span> A. F. Babich. Proving total correctness of parallel programs. IEEE Trans. Softw. Eng., 5(6):558–574, November 1979.

<span id="ref-17">[17]</span> Luciano Baresi and Michal Young. Test oracles. Technical Report CIS-TR-01-02, University of Oregon, Dept. of Computer and Information Science, August 2001. http://www.cs.uoregon.edu/~michal/pubs/oracles.html.

<span id="ref-18">[18]</span> Sofia Bekrar, Chaouki Bekrar, Roland Groz, and Laurent Mounier. Finding software vulnerabilities by smart fuzzing. In ICST, pages 427–430, 2011.

<span id="ref-19">[19]</span> Gilles Bernot. Testing against formal specifications: a theoretical view. In Proceedings of the International Joint Conference on Theory and Practice of Software Development on Advances in Distributed Computing (ADC) and Colloquium on Combining Paradigms for Software Development (CCPSD): Vol. 2, TAPSOFT ’91, pages 99–119, New York, NY, USA, 1991. Springer-Verlag New York, Inc.

<span id="ref-20">[20]</span> Gilles Bernot, Marie Claude Gaudel, and Bruno Marre. Software testing based on formal specifications: a theory and a tool. Softw. Eng. J., 6(6):387–405, November 1991.

<span id="ref-21">[21]</span> Antonia Bertolino, Paola Inverardi, Patrizio Pelliccione, and Massimo Tivoli. Automatic synthesis of behavior protocols for composable web-services. In Proceedings of ESEC/SIGSOFT FSE, ESEC/FSE 2009, pages 141–150, 2009.

<span id="ref-22">[22]</span> D. Beyer, T. Henzinger, R. Jhala, and R. Majumdar. Checking memory safety with Blast. In M. Cerioli, editor, Fundamental Approaches to Software Engineering, 8th International Conference, FASE 2005, Held as Part of the Joint European Conferences on Theory and Practice of Software, ETAPS 2005, Edinburgh, UK, April 4-8, 2005, Proceedings, volume 3442 of Lecture Notes in Computer Science, pages 2–18. Springer, 2005.

<span id="ref-23">[23]</span> R. Binder. Testing Object-Oriented Systems: Models, Patterns, and Tools. Addison-Wesley, 2000.

<span id="ref-24">[24]</span> A. Blikle. Proving programs by sets of computations. In Mathematical Foundations of Computer Science, pages 333–358. Springer, 1975.

<span id="ref-25">[25]</span> Christian Blum and Andrea Roli. Metaheuristics in combinatorial optimization: Overview and conceptual comparison. ACM Computing Surveys (CSUR), 35(3):268–308, 2003.

<span id="ref-26">[26]</span> Gregor V. Bochmann and Alexandre Petrenko. Protocol testing: review of methods and relevance for software testing. In Proceedings of the 1994 ACM SIGSOFT international symposium on Software testing and analysis, ISSTA ’94, pages 109–124. ACM, 1994.

<span id="ref-27">[27]</span> G.V. Bochmann. Finite state description of communication protocols. Computer Networks, 2(4):361–372, 1978.

<span id="ref-28">[28]</span> E. Börger, A. Cavarra, and E. Riccobene. Modeling the dynamics of UML state machines. In Abstract State Machines-Theory and Applications, pages 167–186. Springer, 2000.

<span id="ref-29">[29]</span> Egon Börger. High level system design and analysis using abstract state machines. In Proceedings of the International Workshop on Current Trends in Applied Formal Method: Applied Formal Methods, FM-Trends 98, pages 1–43, London, UK, UK, 1999. Springer-Verlag.

<span id="ref-30">[30]</span> Kathrin Böttger, Rolf Schwitter, Diego Mollá, and Debbie Richards. Towards reconciling use cases via controlled language and graphical models. In INAP, pages 115–128, Berlin, Heidelberg, 2003. Springer-Verlag.

<span id="ref-31">[31]</span> F. Bouquet, C. Grandpierre, B. Legeard, F. Peureux, N. Vacelet, and M. Utting. A subset of precise UML for model-based testing. In Proceedings of the 3rd International Workshop on Advances in Model-Based Testing, A-MOST ’07, pages 95–104, New York, NY, USA, 2007. ACM.

<span id="ref-32">[32]</span> Mustafa Bozkurt and Mark Harman. Automatically generating realistic test input from web services. In IEEE 6th International Symposium on Service Oriented System Engineering (SOSE), pages 13–24, 2011.

<span id="ref-33">[33]</span> L. C. Briand, Y. Labiche, and H. Sun. Investigating the use of analysis contracts to improve the testability of object-oriented code. Softw. Pract. Exper., 33(7):637–672, June 2003.

<span id="ref-34">[34]</span> Cristian Cadar, Vijay Ganesh, Peter M. Pawlowski, David L. Dill, and Dawson R. Engler. EXE: Automatically generating inputs of death. ACM Trans. Inf. Syst. Secur., 12(2):10:1–10:38, December 2008.

<span id="ref-35">[35]</span> J. Callahan, F. Schneider, S. Easterbrook, et al. Automated software testing using model-checking. In Proceedings 1996 SPIN workshop, volume 353. Citeseer, 1996.

<span id="ref-36">[36]</span> F. T. Chan, T. Y. Chen, S. C. Cheung, M. F. Lau, and S. M. Yiu. Application of metamorphic testing in numerical analysis. In Proceedings of the IASTED International Conference on Software Engineering, pages 191–197, 1998.

<span id="ref-37">[37]</span> W.K. Chan, S.C. Cheung, and Karl R.P.H. Leung. A metamorphic testing approach for online testing of service-oriented software applications, chapter 7, pages 2894–2914. IGI Global, 2009.

<span id="ref-38">[38]</span> W.K. Chan, S.C. Cheung, and K.R.P.H. Leung. Towards a metamorphic testing methodology for service-oriented software applications. In QSIC, pages 470–476, September 2005.

<span id="ref-39">[39]</span> F. Chen, N. Tillmann, and W. Schulte. Discovering specifications. Technical Report MSR-TR-2005-146, Microsoft Research, October 2005.

<span id="ref-40">[40]</span> Huo Yan Chen, T. H. Tse, F. T. Chan, and T. Y. Chen. In black and white: an integrated approach to class-level testing of object-oriented programs. ACM Trans. Softw. Eng. Methodol., 7:250–295, July 1998.

<span id="ref-41">[41]</span> Huo Yan Chen, T. H. Tse, and T. Y. Chen. TACCLE: a methodology for object-oriented software testing at the class and cluster levels. ACM Trans. Softw. Eng. Methodol., 10(1):56–109, January 2001.

<span id="ref-42">[42]</span> T. Y. Chen, F.-C. Kuo, T. H. Tse, and Zhi Quan Zhou. Metamorphic testing and beyond. In Proceedings of the International Workshop on Software Technology and Engineering Practice (STEP 2003), pages 94–100, September 2004.

<span id="ref-43">[43]</span> Tsong Chen, Dehao Huang, Haito Huang, Tsun- Him Tse, Zong Yang, and Zhi Zhou. Metamorphic testing and its applications. In Proceedings of the 8th International Symposium on Future Software Technology, ISFST 2004, pages 310–319, 2004.

<span id="ref-44">[44]</span> Yoonsik Cheon. Abstraction in assertion-based test oracles. In Proceedings of the Seventh International Conference on Quality Software, pages 410–414, Washington, DC, USA, 2007. IEEE Computer Society.

<span id="ref-45">[45]</span> Yoonsik Cheon and Gary T. Leavens. A simple and practical approach to unit testing: The JML and JUnit way. In Proceedings of the 16th European Conference on Object-Oriented Programming, ECOOP ’02, pages 231–255, London, UK, 2002. Springer-Verlag.

<span id="ref-46">[46]</span> L.A. Clarke. A system to generate test data and symbolically execute programs. Software Engineering, IEEE Transactions on, SE-2(3):215 –222, sept. 1976.

<span id="ref-47">[47]</span> Paul C. Clements. Managing variability for software product lines: Working with variability mechanisms. In 10th International Conference on Software Product Lines (SPLC 2006), pages 207–208, Baltimore, Maryland, USA, 2006. IEEE Computer Society.

<span id="ref-48">[48]</span> Markus Clermont and David Parnas. Using information about functions in selecting test cases. In Proceedings of the 1st international workshop on Advances in model-based testing, A-MOST ’05, pages 1–7, New York, NY, USA, 2005. ACM.

<span id="ref-49">[49]</span> David Coppit and Jennifer M. Haddox-Schatz. On the use of specification-based assertions as test oracles. In Proceedings of the 29th Annual IEEE/NASA on Software Engineering Workshop, pages 305–314, Washington, DC, USA, 2005. IEEE Computer Society.

<span id="ref-50">[50]</span> M. Davies and E. Weyuker. Pseudo-oracles for nontestable programs. In Proceedings of the ACM ’81 Conference, pages 254–257, 1981.

<span id="ref-51">[51]</span> Laura K. Dillon. Automated support for testing and debugging of real-time programs using oracles. SIG- SOFT Softw. Eng. Notes, 25(1):45–46, January 2000.

<span id="ref-52">[52]</span> Roong-Ko Doong and Phyllis G. Frankl. The AS- TOOT approach to testing object-oriented programs. ACM Trans. Softw. Eng. Methodol., 3:101–130, April 1994.

<span id="ref-53">[53]</span> Edith Elkind, Blaise Genest, Doron Peled, and Hongyang Qu. Grey-box checking. In FORTE, pages 420–435, 2006.

<span id="ref-54">[54]</span> J. Ellsberger, D. Hogrefe, and A. Sarma. SDL: formal object-oriented language for communicating systems. Prentice Hall, 1997.

<span id="ref-55">[55]</span> M.D. Ernst, J.H. Perkins, P.J. Guo, S. McCamant, C. Pacheco, M.S. Tschantz, and C. Xiao. The Daikon system for dynamic detection of likely invariants. Science of Computer Programming, 69(1):35–45, 2007.

<span id="ref-56">[56]</span> Michael D. Ernst, Jake Cockrell, William G. Griswold, and David Notkin. Dynamically discovering likely program invariants to support program evolution. IEEE Trans. Software Eng., 27(2):99–123, 2001.

<span id="ref-57">[57]</span> R.A. Eyre-Todd. The detection of dangling references in C++ programs. ACM Letters on Programming Languages and Systems (LOPLAS), 2(1-4):127–134, 1993.

<span id="ref-58">[58]</span> R. Feldt. Generating diverse software versions with genetic programming: an experimental study. Software, IEE Proceedings, 145, December 1998.

<span id="ref-59">[59]</span> Xin Feng, David Lorge Parnas, T. H. Tse, and Tony O’Callaghan. A comparison of tabular expressionbased testing strategies. IEEE Trans. Softw. Eng., 37(5):616–634, September 2011.

<span id="ref-60">[60]</span> Xin Feng, David Lorge Parnas, and T.H. Tse. Tabular expression-based testing strategies: A comparison. Testing: Academic and Industrial Conference Practice and Research Techniques - MUTATION, 0:134, 2007.

<span id="ref-61">[61]</span> J. Ferrer, F. Chicano, and E. Alba. Evolutionary algorithms for the multi-objective test data generation problem. Software: Practice and Experience, 42(11):1331–1362, 2011.

<span id="ref-62">[62]</span> John S. Fitzgerald and Peter Gorm Larsen. Modelling Systems - Practical Tools and Techniques in Software Development (2. ed.). Cambridge University Press, 2009.

<span id="ref-63">[63]</span> C. Flanagan and K. R. M. Leino. Houdini, an annotation assistant for ESC/Java. Lecture Notes in Computer Science, 2021:500–517, 2001.

<span id="ref-64">[64]</span> Robert W. Floyd. Assigning meanings to programs. In J. T. Schwartz, editor, Mathematical Aspects of Computer Science, volume 19 of Symposia in Applied Mathematics, pages 19–32. American Mathematical Society, Providence, RI, 1967.

<span id="ref-65">[65]</span> Gordon Fraser and Andrea Arcuri. Whole test suite generation. IEEE Transactions on Software Engineering, 39(2):276–291, 2013.

<span id="ref-66">[66]</span> Gordon Fraser and Andreas Zeller. Exploiting common object usage in test case generation. In Proceedings of the 2011 Fourth IEEE International Conference on Software Testing, Verification and Validation, ICST ’11, pages 80–89. IEEE Computer Society, 2011.

<span id="ref-67">[67]</span> Kambiz Frounchi, Lionel C. Briand, Leo Grady, Yvan Labiche, and Rajesh Subramanyan. Automating image segmentation verification and validation by learning test oracles. Information and Software Technology, 53(12):1337–1348, 2011.

<span id="ref-68">[68]</span> Pascale Gall and Agns Arnould. Formal specifications and test: Correctness and oracle. In Magne Haveraaen, Olaf Owe, and Ole-Johan Dahl, editors, Recent Trends in Data Type Specification, volume 1130 of Lecture Notes in Computer Science, pages 342–358. Springer Berlin Heidelberg, 1996.

<span id="ref-69">[69]</span> J. Gannon, P. McMullin, and R. Hamlet. Data abstraction, implementation, specification, and testing. ACM Transactions on Programming Languages and Systems (TOPLAS), 3(3):211–223, 1981.

<span id="ref-70">[70]</span> Angelo Gargantini and Elvinia Riccobene. ASM- based testing: Coverage criteria and automatic test sequence. Journal of Universal Computer Science, 7(11):1050–1067, nov 2001.

<span id="ref-71">[71]</span> Stephen J. Garland, John V. Guttag, and James J. Horning. An overview of Larch. In Functional Programming, Concurrency, Simulation and Automated Reasoning, pages 329–348, 1993.

<span id="ref-72">[72]</span> Marie-Claude Gaudel. Testing from formal specifications, a generic approach. In Proceedings of the 6th Ade-Europe International Conference Leuven on Reliable Software Technologies, Ada Europe ’01, pages 35–48, London, UK, 2001. Springer-Verlag.

<span id="ref-73">[73]</span> Marie-Claude Gaudel and Perry R. James. Testing algebraic data types and processes: A unifying theory. Formal Asp. Comput., 10(5-6):436–451, 1998.

<span id="ref-74">[74]</span> Gregory Gay, Sanjai Rayadurgam, and Mats Heimdah. Improving the accuracy of oracle verdicts through automated model steering. In Automated Software Engineering (ASE 2014). ACM Press, 2014.

<span id="ref-75">[75]</span> Patrice Godefroid, Nils Klarlund, and Koushik Sen. DART: directed automated random testing. In PLDI, pages 213–223. ACM, 2005.

<span id="ref-76">[76]</span> Alex Groce, Mohammad Amin Alipour, Chaoqiang Zhang, Yang Chen, and John Regehr. Cause reduction for quick testing. In ICST, pages 243–252, 2014.

<span id="ref-77">[77]</span> Alex Groce, Doron Peled, and Mihalis Yannakakis. Amc: An adaptive model checker. In CAV, pages 521–525, 2002.

<span id="ref-78">[78]</span> Roland Groz, Keqin Li, Alexandre Petrenko, and Muzammil Shahbaz. Modular system verification by inference, testing and reachability analysis. In TestCom/FATES, pages 216–233, 2008.

<span id="ref-79">[79]</span> Zhongxian Gu, Earl T. Barr, David J. Hamilton, and Zhendong Su. Has the bug really been fixed? In Proceedings of the 2010 International Conference on Software Engineering (ICSE’10). IEEE Computer Society, 2010.

<span id="ref-80">[80]</span> R. Guderlei and J. Mayer. Statistical metamorphic testing testing programs with random output by means of statistical hypothesis tests and metamorphic testing. In QSIC, pages 404–409, October 2007.

<span id="ref-81">[81]</span> D. Harel. Statecharts: A visual formalism for complex systems. Science of computer programming, 8(3):231–274, 1987.

<span id="ref-82">[82]</span> Mark Harman, Sung Gon Kim, Kiran Lakhotia, Phil McMinn, and Shin Yoo. Optimizing for the number of tests generated in search based test data generation with an application to the oracle cost problem. In International Workshop on Search-Based Software Testing (SBST 2010), pages 182–191. IEEE, 6 April 2010.

<span id="ref-83">[83]</span> Mark Harman, Afshin Mansouri, and Yuanyuan Zhang. Search based software engineering: A comprehensive analysis and review of trends techniques and applications. Technical Report TR-09-03, Department of Computer Science, King’s College London, April 2009.

<span id="ref-84">[84]</span> Mark Harman, Phil McMinn, Jerffeson Teixeira de Souza, and Shin Yoo. Search based software engineering: Techniques, taxonomy, tutorial. In Bertrand Meyer and Martin Nordio, editors, Empirical software engineering and verification: LASER 2009-2010, pages 1–59. Springer, 2012. LNCS 7007.

<span id="ref-85">[85]</span> M. Jean Harrold, Rajiv Gupta, and Mary Lou Soffa. A methodology for controlling the size of a test suite. ACM Trans. Softw. Eng. Methodol., 2(3):270–285, July 1993.

<span id="ref-86">[86]</span> Mary Jean Harrold, Gregg Rothermel, Kent Sayre, Rui Wu, and Liu Yi. An empirical investigation of the relationship between spectra differences and regression faults. Software Testing, Verification, and Reliability, 10(3):171–194, 2000.

<span id="ref-87">[87]</span> David L. Heine and Monica S. Lam. A practical flow-sensitive and context-sensitive C and C++ memory leak detector. In PLDI, pages 168–181. ACM, 2003.

<span id="ref-88">[88]</span> J. Henkel and A. Diwan. Discovering algebraic specifications from Java classes. Lecture Notes in Computer Science, 2743:431–456, 2003.

<span id="ref-89">[89]</span> F.C. Hennie. Finite-state models for logical machines. Wiley, 1968.

<span id="ref-90">[90]</span> MarijnJ.H. Heule and Sicco Verwer. Software model synthesis using satisfiability solvers. Empirical Software Engineering, pages 1–32, 2012.

<span id="ref-91">[91]</span> R.M. Hierons. Oracles for distributed testing. Software Engineering, IEEE Transactions on, 38(3):629–641, 2012.

<span id="ref-92">[92]</span> Robert M. Hierons. Verdict functions in testing with a fault domain or test hypotheses. ACM Trans. Softw. Eng. Methodol., 18(4):14:1–14:19, July 2009.

<span id="ref-93">[93]</span> Robert M. Hierons, Kirill Bogdanov, Jonathan P. Bowen, Rance Cleaveland, John Derrick, Jeremy Dick, Marian Gheorghe, Mark Harman, Kalpesh Kapoor, Paul Krause, Gerald Lüttgen, Anthony J. H. Simons, Sergiy Vilkomir, Martin R. Woodward, and Hussein Zedan. Using formal specifications to support testing. ACM Comput. Surv., 41:9:1–9:76, February 2009.

<span id="ref-94">[94]</span> Charles Anthony Richard Hoare. An Axiomatic Basis of Computer Programming. Communications of the ACM, 12:576–580, 1969.

<span id="ref-95">[95]</span> M. Holcombe. X-machines as a basis for dynamic system specification. Software Engineering Journal, 3(2):69–76, 1988.

<span id="ref-96">[96]</span> Mike Holcombe and Florentin Ipate. Correct systems: building a business process solution. Software Testing Verification and Reliability, 9(1):76–77, 1999.

<span id="ref-97">[97]</span> Gerard J. Holzmann. The model checker SPIN. IEEE Trans. Softw. Eng., 23(5):279–295, May 1997.

<span id="ref-98">[98]</span> W E Howden. A functional approach to program testing and analysis. IEEE Trans. Softw. Eng., 12(10):997–1005, October 1986.

<span id="ref-99">[99]</span> W.E. Howden. Theoretical and empirical studies of program testing. IEEE Transactions on Software Engineering, 4(4):293–298, July 1978.

<span id="ref-100">[100]</span> Merlin Hughes and David Stotts. Daistish: systematic algebraic testing for OO programs in the presence of side-effects. SIGSOFT Softw. Eng. Notes, 21(3):53–61, May 1996.

<span id="ref-101">[101]</span> Daniel Jackson. Software Abstractions: Logic, Language, and Analysis. The MIT Press, 2006.

<span id="ref-102">[102]</span> Daniel Jackson. Software Abstractions: Logic, Language, and Analysis. The MIT Press, 2006.

<span id="ref-103">[103]</span> Claude Jard and Gregor v. Bochmann. An approach to testing specifications. Journal of Systems and Software, 3(4):315 –323, 1983.

<span id="ref-104">[104]</span> D. Jeffrey and R. Gupta. Test case prioritization using relevant slices. In Computer Software and Applications Conference, 2006. COMPSAC ’06. 30th Annual International, volume 1, pages 411–420, 2006.

<span id="ref-105">[105]</span> Ying Jin and David Lorge Parnas. Defining the meaning of tabular mathematical expressions. Sci. Comput. Program., 75(11):980–1000, November 2010.

<span id="ref-106">[106]</span> M.J. Kearns and U.V. Vazirani. An Introduction to Computational Learning Theory. MIT Press, 1994.

<span id="ref-107">[107]</span> R.M. Keller. Formal verification of parallel programs. Communications of the ACM, 19(7):371–384, 1976.

<span id="ref-108">[108]</span> James C. King. Symbolic execution and program testing. Communications of the ACM, 19(7):385–394, July 1976.

<span id="ref-109">[109]</span> Kiran Lakhotia, Phil McMinn, and Mark Harman. An empirical investigation into branch coverage for C programs using CUTE and AUSTIN. Journal of Systems and Software, 83(12):2379–2391, 2010.

<span id="ref-110">[110]</span> Axel van Lamsweerde. Formal specification: a roadmap. In Proceedings of the Conference on The Future of Software Engineering, ICSE ’00, pages 147–159, New York, NY, USA, 2000. ACM.

<span id="ref-111">[111]</span> K. Lano and H. Haughton. Specification in B: An Introduction Using the B Toolkit. Imperial College Press, 1996.

<span id="ref-112">[112]</span> D. Lee and M. Yannakakis. Principles and methods of testing finite state machines—a survey. Proceedings of the IEEE, 84(8):1090–1123, aug 1996.

<span id="ref-113">[113]</span> A. Leitner, M. Oriol, A Zeller, I. Ciupa, and B. Meyer. Efficient unit test case minimization. In Automated Software Engineering (ASE 2007), pages 417–420, Atlanta, Georgia, USA, 2007. ACM Press.

<span id="ref-114">[114]</span> Keqin Li, Roland Groz, and Muzammil Shahbaz. Integration testing of components guided by incremental state machine learning. In TAIC PART, pages 59–70, 2006.

<span id="ref-115">[115]</span> D. Lorenzoli, L. Mariani, and M. Pezzè. Automatic generation of software behavioral models. In proceedings of the 30th International Conference on Software Engineering (ICSE), 2008.

<span id="ref-116">[116]</span> Pablo Loyola, Matthew Staats, In-Young Ko, and Gregg Rothermel. Dodona: Automated oracle data set selection. In International Symposium on Software Testing and Analysis 2014, ISSTA’04, 2014.

<span id="ref-117">[117]</span> D. Luckham and F.W. Henke. An overview of ANNA-a specification language for ADA. Technical report, Stanford University, 1984.

<span id="ref-118">[118]</span> Nancy A. Lynch and Mark R. Tuttle. An introduction to input/output automata. CWI Quarterly, 2:219–246, 1989.

<span id="ref-119">[119]</span> Patrı́cia D. L. Machado. On oracles for interpreting test results against algebraic specifications. In AMAST, pages 502–518. Springer-Verlag, 1999.

<span id="ref-120">[120]</span> Phil Maker. GNU Nana: improved support for assertion checking and logging in GNU C/C++, 1998. http://gnu.cs.pu.edu.tw/software/nana/.

<span id="ref-121">[121]</span> Haroon Malik, Hadi Hemmati, and Ahmed E. Hassan. Automatic detection of performance deviations in the load testing of large scale systems. In Proceedings of International Conference on Software Engineering - Software Engineering in Practice Track, ICSE 2013, page to appear, 2013.

<span id="ref-122">[122]</span> L. Mariani, F. Pastore, and M. Pezzè. Dynamic analysis for diagnosing integration faults. IEEE Transactions on Software Engineering, 37(4):486–508, 2011.

<span id="ref-123">[123]</span> Bruno Marre. Loft: A tool for assisting selection of test data sets from algebraic specifications. In TAPSOFT, pages 799–800. Springer-Verlag, 1995.

<span id="ref-124">[124]</span> A.P. Mathur. Performance, effectiveness, and reliability issues in software testing. In COMPSAC, pages 604–605. IEEE, 1991.

<span id="ref-125">[125]</span> Johannes Mayer, Ralph Guderlei, Abteilung Angew, Te Informationsverarbeitung, Abteilung Stochastik, and Universitt Ulm. Test oracles using statistical methods. In In: Proceedings of the First International Workshop on Software Quality, Lecture Notes in Informatics P-58, Kllen Druck+Verlag GmbH, pages 179–189. Springer, 2004.

<span id="ref-126">[126]</span> P. McMinn, M. Stevenson, and M. Harman. Reducing qualitative human oracle costs associated with automatically generated test data. In 1st International Workshop on Software Test Output Validation (STOV 2010), Trento, Italy, 13th July 2010, pages 1–4, 2010.

<span id="ref-127">[127]</span> Phil McMinn. Search-based software test data generation: a survey. Softw. Test. Verif. Reliab., 14(2):105–156, June 2004.

<span id="ref-128">[128]</span> Phil McMinn. Search-based failure discovery using testability transformations to generate pseudooracles. In Genetic and Evolutionary Computation Conference (GECCO 2009), pages 1689–1696. ACM Press, 8-12 July 2009.

<span id="ref-129">[129]</span> Phil McMinn. Search-based software testing: Past, present and future. In International Workshop on Search-Based Software Testing (SBST 2011), pages 153–163. IEEE, 21 March 2011.

<span id="ref-130">[130]</span> Phil McMinn, Muzammil Shahbaz, and Mark Stevenson. Search-based test input generation for string data types using the results of web queries. In ICST, pages 141–150, 2012.

<span id="ref-131">[131]</span> Phil McMinn, Mark Stevenson, and Mark Harman. Reducing qualitative human oracle costs associated with automatically generated test data. In International Workshop on Software Test Output Validation (STOV 2010), pages 1–4. ACM, 13 July 2010.

<span id="ref-132">[132]</span> Atif M. Memon. Automatically repairing event sequence-based GUI test suites for regression testing. ACM Transactions on Software Engineering Methodology, 18(2):1–36, 2008.

<span id="ref-133">[133]</span> Atif M. Memon, Martha E. Pollack, and Mary Lou Soffa. Automated test oracles for GUIs. In SIGSOFT ’00/FSE-8: Proceedings of the 8th ACM SIGSOFT international symposium on Foundations of software engineering, pages 30–39, New York, NY, USA, 2000. ACM Press.

<span id="ref-134">[134]</span> Atif M. Memon and Qing Xie. Using transient/persistent errors to develop automated test oracles for event-driven software. In ASE ’04: Proceedings of the 19th IEEE international conference on Automated software engineering, pages 186–195, Washington, DC, USA, 2004. IEEE Computer Society.

<span id="ref-135">[135]</span> Maik Merten, Falk Howar, Bernhard Steffen, Patrizio Pellicione, and Massimo Tivoli. Automated inference of models for black box systems based on interface descriptions. In Proceedings of the 5th international conference on Leveraging Applications of Formal Methods, Verification and Validation: technologies for mastering change - Volume Part I, ISoLA’12, pages 79–96. Springer-Verlag, 2012.

<span id="ref-136">[136]</span> Bertrand Meyer. Eiffel: A language and environment for software engineering. The Journal of Systems and Software, 8(3):199–246, June 1988.

<span id="ref-137">[137]</span> B.P. Miller, L. Fredriksen, and B. So. An empirical study of the reliability of UNIX utilities. Communications of the ACM, 33(12):32–44, 1990.

<span id="ref-138">[138]</span> S. Mouchawrab, L.C. Briand, Y. Labiche, and M. Di Penta. Assessing, comparing, and combining state machine-based testing and structural testing: A series of experiments. Software Engineering, IEEE Transactions on, 37(2):161–187, 2011.

<span id="ref-139">[139]</span> Christian Murphy, Kuang Shen, and Gail Kaiser. Automatic system testing of programs without test oracles. In ISSTA, pages 189–200. ACM Press, 2009.

<span id="ref-140">[140]</span> Christian Murphy, Kuang Shen, and Gail Kaiser. Using JML runtime assertion checking to automate metamorphic testing in applications without test oracles. 2009 International Conference on Software Testing Verification and Validation, pages 436–445, 2009.

<span id="ref-141">[141]</span> A. J. Offutt, J. Pan, and J. M. Voas. Procedures for reducing the size of coverage-based test sets. In International Conference on Testing Computer Software, pages 111–123, 1995.

<span id="ref-142">[142]</span> C. Pacheco and M. Ernst. Eclat: Automatic generation and classification of test inputs. ECOOP 2005- Object-Oriented Programming, pages 734–734, 2005.

<span id="ref-143">[143]</span> D L Parnas, J Madey, and M Iglewski. Precise documentation of well-structured programs. IEEE Transactions on Software Engineering, 20(12):948–976, 1994.

<span id="ref-144">[144]</span> David Lorge Parnas. Document based rational software development. Journal of Knowledge Based Systems, 22:132–141, April 2009.

<span id="ref-145">[145]</span> David Lorge Parnas. Precise documentation: The key to better software. In Sebastian Nanz, editor, The Future of Software Engineering, pages 125–148. Springer Berlin Heidelberg, 2011.

<span id="ref-146">[146]</span> David Lorge Parnas and Jan Madey. Functional documents for computer systems. Sci. Comput. Program., 25(1):41–61, October 1995.

<span id="ref-147">[147]</span> F. Pastore, L. Mariani, and G. Fraser. Crowdoracles: Can the crowd solve the oracle problem? In Proceedings of the International Conference on Software Testing, Verification and Validation (ICST), 2013.

<span id="ref-148">[148]</span> Doron Peled, Moshe Y. Vardi, and Mihalis Yannakakis. Black box checking. Journal of Automata, Languages and Combinatorics, 7(2), 2002.

<span id="ref-149">[149]</span> D K Peters and D L Parnas. Using test oracles generated from program documentation. IEEE Transactions on Software Engineering, 24(3):161–173, 1998.

<span id="ref-150">[150]</span> Dennis K. Peters and David Lorge Parnas. Requirements-based monitors for real-time systems. IEEE Trans. Softw. Eng., 28(2):146–158, February 2002.

<span id="ref-151">[151]</span> Mauro Pezzè and Cheng Zhang. Automated test oracles: A survey. In Ali Hurson and Atif Memon, editors, Advances in Computers, volume 95, pages 1–48. Elsevier Ltd., 2014.

<span id="ref-152">[152]</span> Nadia Polikarpova, Ilinca Ciupa, and Bertrand Meyer. A comparative study of programmer-written and automatically inferred contracts. In ISSTA, pages 93–104. ACM, 2009.

<span id="ref-153">[153]</span> S.J. Prowell and J.H. Poore. Foundations of sequence-based software specification. Software Engineering, IEEE Transactions on, 29(5):417–429, 2003.

<span id="ref-154">[154]</span> Sam Ratcliff, David R. White, and John A. Clark. Searching for invariants using genetic programming and mutation testing. In Proceedings of the 13th annual conference on Genetic and evolutionary computation, GECCO ’11, pages 1907–1914, New York, NY, USA, 2011. ACM.

<span id="ref-155">[155]</span> F. Ricca and P. Tonella. Detecting anomaly and failure in web applications. MultiMedia, IEEE, 13(2):44 –51, april-june 2006.

<span id="ref-156">[156]</span> D.S. Rosenblum. A practical approach to programming with assertions. Software Engineering, IEEE Transactions on, 21(1):19–31, 1995.

<span id="ref-157">[157]</span> G. Rothermel, M. J. Harrold, J. von Ronne, and C. Hong. Empirical studies of test-suite reduction. Software Testing, Verification and Reliability, 12:219—249, 2002.

<span id="ref-158">[158]</span> N. Walkinshaw S. Ali, K. Bogdanov. A comparative study of methods for dynamic reverse-engineering of state models. Technical Report CS-07-16, The University of Sheffield, Department of Computer Science, October 2007. http://www.dcs.shef.ac.uk/intranet/research/resmes/CS0716.pdf.

<span id="ref-159">[159]</span> David Schuler and Andreas Zeller. Assessing oracle quality with checked coverage. In Proceedings of the 2011 Fourth IEEE International Conference on Software Testing, Verification and Validation, ICST ’11, pages 90–99, Washington, DC, USA, 2011. IEEE Computer Society.

<span id="ref-160">[160]</span> R. Schwitter. English as a formal specification language. In Database and Expert Systems Applications, 2002. Proceedings. 13th International Workshop on, pages 228–232, sept. 2002.

<span id="ref-161">[161]</span> Sergio Segura, Robert M. Hierons, David Benavides, and Antonio Ruiz-Cortés. Automated metamorphic testing on the analyses of feature models. Information and Software Technology, 53(3):245 –258, 2011.

<span id="ref-162">[162]</span> Koushik Sen, Darko Marinov, and Gul Agha. CUTE: a concolic unit testing engine for C. In ESEC/FSE, pages 263–272. ACM, 2005.

<span id="ref-163">[163]</span> Seyed Shahamiri, Wan Wan-Kadir, Suhaimi Ibrahim, and Siti Hashim. Artificial neural networks as multinetworks automated test oracle. Automated Software Engineering, 19(3):303–334, 2012.

<span id="ref-164">[164]</span> Seyed Reza Shahamiri, Wan Mohd Nasir Wan Kadir, Suhaimi Ibrahim, and Siti Zaiton Mohd Hashim. An automated framework for software test oracle. Information and Software Technology, 53(7):774 –788, 2011.

<span id="ref-165">[165]</span> Seyed Reza Shahamiri, Wan Mohd Nasir Wan-Kadir, and Siti Zaiton Mohd Hashim. A comparative study on automated software test oracle methods. In ICSEA, pages 140–145, 2009.

<span id="ref-166">[166]</span> M. Shahbaz. Reverse Engineering and Testing of Black- Box Software Components. LAP Lambert Academic Publishing, 2012.

<span id="ref-167">[167]</span> K. Shrestha and M.J. Rutherford. An empirical evaluation of assertions as oracles. In ICST, pages 110–119. IEEE, 2011.

<span id="ref-168">[168]</span> Guoqiang Shu, Yating Hsu, and David Lee. Detecting communication protocol security flaws by formal fuzz testing and machine learning. In FORTE, pages 299–304, 2008.

<span id="ref-169">[169]</span> J. Sifakis. Deadlocks and livelocks in transition systems. Mathematical Foundations of Computer Science 1980, pages 587–600, 1980.

<span id="ref-170">[170]</span> A. J. H. Simons. JWalk: a tool for lazy systematic testing of java classes by design introspection and user interaction. Automated Software Engineering, 14(4):369–418, December 2007.

<span id="ref-171">[171]</span> Rishabh Singh, Dimitra Giannakopoulou, and Corina S. Pasareanu. Learning component interfaces with may and must abstractions. In Tayssir Touili, Byron Cook, and Paul Jackson, editors, Computer Aided Verification, 22nd International Conference, CAV 2010, Edinburgh, UK, July 15-19, 2010. Proceedings, volume 6174 of Lecture Notes in Computer Science, pages 527–542. Springer, 2010.

<span id="ref-172">[172]</span> J. Michael Spivey. Z Notation - a reference manual (2. ed.). Prentice Hall International Series in Computer Science. Prentice Hall, 1992.

<span id="ref-173">[173]</span> M. Staats, G. Gay, and M. P. E. Heimdahl. Automated oracle creation support, or: How I learned to stop worrying about fault propagation and love mutation testing. In Proceedings of the 34th International Conference on Software Engineering, ICSE 2012, pages 870–880, 2012.

<span id="ref-174">[174]</span> M. Staats, M.W. Whalen, and M.P.E. Heimdahl. Programs, tests, and oracles: the foundations of testing revisited. In ICSE, pages 391–400. IEEE, 2011.

<span id="ref-175">[175]</span> Matt Staats, Shin Hong, Moonzoo Kim, and Gregg Rothermel. Understanding user understanding: determining correctness of generated program invariants. In ISSTA, pages 188–198. ACM, 2012.

<span id="ref-176">[176]</span> Matt Staats, Pablo Loyola, and Gregg Rothermel. Oracle-centric test case prioritization. In Proceedings of the 23rd International Symposium on Software Reliability Engineering, ISSRE 2012, pages 311–320, 2012.

<span id="ref-177">[177]</span> Ari Takanen, Jared DeMott, and Charlie Miller. Fuzzing for Software Security Testing and Quality Assurance. Artech House, Inc., Norwood, MA, USA, 1 edition, 2008.

<span id="ref-178">[178]</span> Ramsay Taylor, Mathew Hall, Kirill Bogdanov, and John Derrick. Using behaviour inference to optimise regression test sets. In Brian Nielsen and Carsten Weise, editors, Testing Software and Systems - 24th IFIP WG 6.1 International Conference, ICTSS 2012, Aalborg, Denmark, November 19-21, 2012. Proceedings, volume 7641 of Lecture Notes in Computer Science, pages 184–199. Springer, 2012.

<span id="ref-179">[179]</span> A. Tiwari. Formal semantics and analysis methods for Simulink Stateflow models. Technical report, SRI International, 2002. http://www.csl.sri.com/users/tiwari/html/stateflow.html.

<span id="ref-180">[180]</span> Jan Tretmans. Test generation with inputs, outputs and repetitive quiescence. Software - Concepts and Tools, 17(3):103–120, 1996.

<span id="ref-181">[181]</span> Alan M. Turing. Checking a large routine. In Report of a Conference on High Speed Automatic Calculating Machines, pages 67–69, Cambridge, England, June 1949. University Mathematical Laboratory.

<span id="ref-182">[182]</span> Mark Utting and Bruno Legeard. Practical Model-Based Testing: A Tools Approach. Morgan Kaufmann Publishers Inc., San Francisco, CA, USA, 2007.

<span id="ref-183">[183]</span> Mark Utting, Alexander Pretschner, and Bruno Legeard. A taxonomy of model-based testing approaches. Softw. Test. Verif. Reliab., 22(5):297–312, August 2012.

<span id="ref-184">[184]</span> G. v. Bochmann, C. He, and D. Ouimet. Protocol testing using automatic trace analysis. In Proceedings of Canadian Conference on Electrical and Computer Engineering, pages 814–820, 1989.

<span id="ref-185">[185]</span> A. van Lamsweerde and M. Sintzoff. Formal derivation of strongly correct concurrent programs. Acta Informatica, 12(1):1–31, 1979.

<span id="ref-186">[186]</span> J.M. Voas. PIE: a dynamic failure-based technique. Software Engineering, IEEE Transactions on, 18(8):717–727, 1992.

<span id="ref-187">[187]</span> N. Walkinshaw, K. Bogdanov, J. Derrick, and J. Paris. Increasing functional coverage by inductive testing: A case study. In Alexandre Petrenko, Adenilso da Silva Simão, and José Carlos Maldonado, editors, Testing Software and Systems - 22nd IFIP WG 6.1 International Conference, ICTSS 2010, Natal, Brazil, November 8-10, 2010. Proceedings, volume 6435 of Lecture Notes in Computer Science, pages 126–141. Springer, 2010.

<span id="ref-188">[188]</span> Neil Walkinshaw and Kirill Bogdanov. Inferring finite-state models with temporal constraints. In ASE, pages 248–257, 2008.

<span id="ref-189">[189]</span> Neil Walkinshaw, John Derrick, and Qiang Guo. Iterative refinement of reverse-engineered models by model-based testing. In FM, pages 305–320, 2009.

<span id="ref-190">[190]</span> Yabo Wang and DavidLorge Parnas. Trace rewriting systems. In Michaël Rusinowitch and Jean-Luc Rémy, editors, Conditional Term Rewriting Systems, volume 656 of Lecture Notes in Computer Science, pages 343–356. Springer Berlin Heidelberg, 1993.

<span id="ref-191">[191]</span> Yabo Wang and D.L. Parnas. Simulating the behaviour of software modules by trace rewriting. In Software Engineering, 1993. Proceedings., 15th International Conference on, pages 14–23, 1993.

<span id="ref-192">[192]</span> Yi Wei, Carlo A. Furia, Nikolay Kazmin, and Bertrand Meyer. Inferring better contracts. In Proceedings of the 33rd International Conference on Software Engineering, ICSE ’11, pages 191–200, New York, NY, USA, 2011. ACM.

<span id="ref-193">[193]</span> Yi Wei, H. Roth, C.A. Furia, Yu Pei, A. Horton, M. Steindorfer, M. Nordio, and B. Meyer. Stateful testing: Finding more errors in code and contracts. In Automated Software Engineering (ASE), 2011 26th IEEE/ACM International Conference on, pages 440–443, 2011.

<span id="ref-194">[194]</span> E.J. Weyuker. Assessing test data adequacy through program inference. ACM Transactions on Programming Languages and Systems (TOPLAS), 5(4):641–655, 1983.

<span id="ref-195">[195]</span> E.J. Weyuker and F.I. Vokolos. Experience with performance testing of software systems: issues, an approach, and case study. Software Engineering, IEEE Transactions on, 26(12):1147–1156, 2000.

<span id="ref-196">[196]</span> Elaine J. Weyuker. On testing non-testable programs. The Computer Journal, 25(4):465–470, November 1982.

<span id="ref-197">[197]</span> Jeannette M. Wing. A specifier’s introduction to formal methods. IEEE Computer, 23(9):8–24, 1990.

<span id="ref-198">[198]</span> Qing Xie and Atif M. Memon. Designing and comparing automated test oracles for GUI-based software applications. ACM Transactions on Software Engineering and Methodology, 16(1):4, 2007.

<span id="ref-199">[199]</span> Tao Xie. Augmenting automatically generated unit-test suites with regression oracle checking. In Proc. 20th European Conference on Object-Oriented Programming (ECOOP 2006), pages 380–403, July 2006.

<span id="ref-200">[200]</span> Tao Xie and David Notkin. Checking inside the black box: Regression testing by comparing value spectra. IEEE Transactions on Software Engineering, 31(10):869–883, October 2005.

<span id="ref-201">[201]</span> Yichen Xie and Alex Aiken. Context-and path-sensitive memory leak detection. ACM SIGSOFT Software Engineering Notes, 30(5):115–125, 2005.

<span id="ref-202">[202]</span> Zhihong Xu, Yunho Kim, Moonzoo Kim, Gregg Rothermel, and Myra B. Cohen. Directed test suite augmentation: techniques and tradeoffs. In Proceedings of the eighteenth ACM SIGSOFT international symposium on Foundations of software engineering, FSE ’10, pages 257–266, New York, NY, USA, 2010. ACM.

<span id="ref-203">[203]</span> Shin Yoo. Metamorphic testing of stochastic optimisation. In Proceedings of the 2010 Third International Conference on Software Testing, Verification, and Validation Workshops, ICSTW ’10, pages 192–201. IEEE Computer Society, 2010.

<span id="ref-204">[204]</span> Shin Yoo and Mark Harman. Regression testing minimisation, selection and prioritisation: A survey. Software Testing, Verification, and Reliability, 22(2):67–120, March 2012.

<span id="ref-205">[205]</span> Bo Yu, Liang Kong, Yufeng Zhang, and Hong Zhu. Testing Java components based on algebraic specifications. Software Testing, Verification, and Validation, 2008 International Conference on, 0:190–199, 2008.

<span id="ref-206">[206]</span> A. Zeller and R Hildebrandt. Simplifying and isolating failure-inducing input. IEEE Transactions on Software Engineering, 28(2):183–200, 2002.

<span id="ref-207">[207]</span> S. Zhang, D. Saff, Y. Bu, and M.D. Ernst. Combined static and dynamic automated test generation. In ISSTA, volume 11, pages 353–363, 2011.

<span id="ref-208">[208]</span> Wujie Zheng, Hao Ma, Michael R. Lyu, Tao Xie, and Irwin King. Mining test oracles of web search engines. In Proc. 26th IEEE/ACM International Conference on Automated Software Engineering (ASE 2011), Short Paper, ASE 2011, pages 408–411, 2011.

<span id="ref-209">[209]</span> Zhi Quan Zhou, ShuJia Zhang, Markus Hagenbuchner, T. H. Tse, Fei-Ching Kuo, and T. Y. Chen. Automated functional testing of online search services. Software Testing, Verification and Reliability, 22(4):221–243, 2012.

<span id="ref-210">[210]</span> Hong Zhu. A note on test oracles and semantics of algebraic specifications. In Proceedings of the 3rd International Conference on Quality Software, QSIC 2003, pages 91–98, 2003.

<span id="ref-211">[211]</span> B. Zorn and P. Hilfinger. A memory allocation profiler for C and Lisp programs. In Proceedings of the Summer USENIX Conference, pages 223–237, 1988.
