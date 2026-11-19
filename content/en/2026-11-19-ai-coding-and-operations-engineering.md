---
layout: post
title: "When Developers Use AI to Do Ops, the Same Pitfalls Remain"
Description: "Reflections on AI-assisted development, the gap between faster coding and faster delivery, and the engineering work required for security, reliability, cost control, and maintainability."
date: 2026-11-19
draft: false
slug: "ai-coding-and-operations-engineering"
tags: [AI, DevOps, SRE, Software Engineering]
categories: ["Software Engineering"]
---

[中文版](/zh-cn/ai-coding-and-operations-engineering/)

Let me introduce myself first. I have more than ten years of software engineering experience, beyond coding alone: about half in backend development and architecture, and half in DevOps, SRE, and platform engineering.

Over the years, I have found that many people still equate DevOps, SRE, and platform engineering with traditional operations: people who manually deploy software and operate production services. I find it surprising that this view is still around.

Someone once asked me: "If we move all our services to platforms like Railway and Cloudflare, does that mean we no longer need ops?"

My answer at the time was: "Yes, if the system is small and doesn't need to live very long, that can work." What I was thinking was that, under those conditions, even deploying everything manually could work.

It is easy to see how people then conclude that developers can replace operations engineers.

To me, debating whether developers should replace operations engineers, or the other way around, misses the forest for the trees. Software engineering is too broad to reduce to one role replacing another.

The first chapter of *Software Engineering at Google*, published in March 2020, puts it this way:

> Software engineering is programming integrated over time.

The chapter explains that programming is an important part of software engineering: it is how we create software in the first place. Software engineering also encompasses its modification and maintenance. Time adds another dimension. The book uses a dimensional analogy: a cube is different from a square, just as distance is different from velocity.

It also discusses time and change, scale and efficiency, and trade-offs and costs. We need to consider how long the code is expected to live and how many people will work on it. A one-person project has different constraints from a team project; a team of five has different constraints from a team of a hundred. ([Chapter 1](https://abseil.io/resources/swe-book/html/ch01.html))

In early 2026, Kuaishou's engineering team reported that, during the stage when they primarily promoted AI coding tools, developers felt their coding efficiency had improved by 20–40%, while the organization's overall delivery lead time had not shortened significantly. I sincerely appreciate Kuaishou making this valuable engineering experience public. ([Kuaishou's account, in Chinese](https://www.infoq.cn/article/9rX1Ov951gKtaTmQb8Jq))

Taken together, these observations point to something I keep seeing in the excitement around AI coding: people readily equate faster coding with a more efficient software engineering process as a whole.

Consider two historical references:

- In 1975, Fred Brooks recommended allocating one-sixth of a project's schedule, about 16.7%, to coding in *The Mythical Man-Month*.
- The study *Today Was a Good Day: The Daily Life of Software Developers*, published online in 2019, reported that coding, including reading or writing code and tests, accounted for 15% of developers' time. Adding debugging and bug fixing, at 14%, and running tests, at 8%, brings the total to about 37%. ([Table 2](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/04/devtime-preprint-TSE19.pdf))

This suggests a hypothesis: if AI significantly reduces coding time while other activities do not shrink at the same rate, those activities will account for a larger share of the total time and will be more likely to become delivery bottlenecks.

Security provides an example. AI coding tools help us write code faster, and AI also helps discover vulnerabilities faster. If vulnerability discovery and the demand for fixes keep growing while build, test, and deployment capacity fail to keep pace, delivering those fixes can become a bottleneck. By mid-November 2026, the number of CVEs disclosed during the year had passed 100,000, more than twice the 2025 count, according to VulnCheck. ([VulnCheck's public statement](https://www.vulncheck.com/press/2026-deloitte-technology-fast-500))

> Here is my hot take: build engineering is about to demand much more attention.
>
> I have already seen plenty of cases where more efficient code generation leads to higher build costs, a pattern reminiscent of Jevons paradox. Of course, many companies will not be as far along as company A, already running into problems with their version-control service.

Job titles alone tell us very little about whether a team has the full set of software engineering capabilities it needs. We need to look at how the work is divided and who is responsible for the results.

For now, though, people are still enjoying the rush of rapid code generation, especially when they see headlines like "2,500 PRs in a Month." Let the code fly for a while.

At this point, I may sound like an old-school operations engineer who does everything manually and opposes AI coding.

For more than six years, I have consistently followed the Everything as Code approach. AI coding has given that approach a substantial boost. In a way, it has reinforced my conviction.

For more than a year now, I have used AI to write almost all my code. These days, my hands-on involvement is mainly in reviewing architectural decisions at critical points; AI writes the rest. I have even built my own IaC-based version of PagerDuty, a leading incident management platform.

Here are some of the practices I have observed:

- Giving every machine in an application cluster a public IP address. I assume the people doing this are unfamiliar with NAT.
- Deploying a data server as a single node, even though it is expected to run for the long term.
- Hosting test and production environments on the same server.
- Deploying application services through cloud instance startup scripts, without scalability or flexibility.
- Exposing a database directly to the internet for the convenience of local development, either hoping nothing will go wrong or assuming there is no problem.
- Using Vercel, Cloudflare, or Railway to host production environments intended to remain in service for the long term.
- Monitoring backend services from within the application itself: once the application starts, its own code checks whether it has a problem.
- Having eight different deployment and configuration approaches in a company with fewer than fifty people. Sometimes, even one person uses more than two approaches.
- Putting plaintext secrets in source code.
- Writing all webhook data into a database without considering capacity. With AI available, I find myself wondering why capacity was never considered.
- Using logs to monitor performance problems.
- Deploying applications to machines through Bash and SSH.
- And so on.

These observations remind me that generating runnable code completes only part of the software engineering work. Security, reliability, operating costs, and maintainability still require engineering design and verification.

People often say that "taste" matters most. To me, we have not even reached the point where that is the most useful discussion. I am not even sure I accept the idea of a general theory of taste in software engineering. What I see are trade-offs under different circumstances.

Someone will say: "We don't even know whether the product will survive that long. Why worry about the code's lifetime or software engineering?" That is a fair point.

The question I have been thinking about and trying to solve for years is how to build a software engineering system at a low cost that can grow with the business.

Let me end with this: accept that we are all human.
