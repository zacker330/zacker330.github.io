---
layout: post
title: "The Hidden Trap in Technical Decisions: Trading a One-Time Cost for Continuous Debt"
Description: "Using the case of building an in-house AI Gateway to talk about the trap of trading continuous debt for a one-time cost"
date: 2026-06-14
tags: [Technical Decisions, AI Gateway, Architecture, ROI, Software Engineering]
---

Our team uses more and more AI services—OpenAI, Deepseek, Tongyi, Doubao, Claude... Each platform has its own API, its own keys, its own billing model. The configuration gets messier, the calls get more scattered, and so sooner or later someone proposes:

> Why don't we build our own AI Gateway? Either build it ourselves, or buy one off the shelf.

It's a very natural idea. I've had it too.

Build an AI Gateway and solve all the problems at once—what a great KPI story.

But after thinking it through and running the numbers, I decided **not** to build an in-house AI Gateway.

## The conclusion first

**For the vast majority of companies, the ROI of building or buying an AI Gateway is low.**

Note that the deciding factor is **not** how many AI services you use. Even if you've integrated a dozen platforms, as long as the project scale isn't there and the team capability isn't there, the investment still doesn't pay off.

There's really only one combination of conditions that makes it worthwhile: **you have enough projects, AND you already have an ops/platform team that can hold up under 7×24 on-call.** Otherwise, you're most likely trading a **permanent liability** for a **nuisance you could absorb in a day or two**.

Let me explain why.

## 1. What does an AI Gateway actually solve?

First, let's give it credit—an AI Gateway does solve some real problems:

- **Multi-platform fallback**: The same model needs a backup path across multiple providers. For example, with Deepseek you might want a fallback path of Deepseek official → Volcano Engine → Alibaba Cloud Bailian, and every service has to write this itself.
- **Rotating API keys requires restarting services**: Changing a key means restarting the app. With three services using it, that's at least three rotations, multiplied across environments (dev / staging / prod)—the number adds up fast.
- **Fragmented request monitoring**: Monitoring for AI calls has to be implemented separately by each service.
- **Inconsistent interfaces**: To switch models, you have to re-integrate against another platform's SDK, instead of having one interface to rule them all.
- **Slow key-request process**: Services request keys from ops, and the approval process takes time.
- **Coarse cost tracking**: Many AI platforms have weak cost reporting—they can't break costs down by key or by project, so you end up instrumenting it yourself in business code.

This sounds wonderful, and it's very persuasive to the bosses.

## 2. What it doesn't tell you: it solves problems, but it also creates them

An AI Gateway solves problems, but at the same time, it introduces some:

- **Single point of failure.** This is the most lethal one. Before, when one platform went down, it only affected the service using it; now all AI calls go through the Gateway, so **Gateway down = the whole company's AI features down together**. What you've really done is merge "scattered, mutually independent failures" into "one correlated, global failure."
- **The cost of updates and restarts gets amplified.** This is the most ironic part. Restarting a business service only affects that one service if it hiccups—anyone dares to do it. But the Gateway is the throat of the whole company's AI; every upgrade, restart, or config change of it ripples out to every service. So you become more and more "afraid to touch it"—updates need a scheduled window, change review, late-night operations, canary rollout and rollback plans on standby. **The result: one of the pain points the AI Gateway was supposed to solve was "rotating keys requires restarting business services," yet in the end a single restart of the Gateway itself becomes an even more nerve-wracking event.** You haven't eliminated "the fear of restarting"; you've just consolidated it from scattered small fears into one concentrated big fear.
- **Lagging support for new models / services.** When a new model or platform comes out, the Gateway may not support it right away. If you built it, you have to write the adapter yourself; if you bought it, you wait for the vendor's roadmap. The result: a service that wants to use something new immediately gets blocked by the Gateway instead.
- **Can't accommodate complex business needs.** Some calls require platform-specific parameters, a specific streaming protocol, or a specific multimodal format. A unified abstraction layer always "leaks," and in the end the business has to open a backdoor around the Gateway—which cuts the value of that abstraction layer in half.
- **Onboarding actually gets slower.** It used to be a few lines of code for a service to connect directly; now you first have to get the Gateway to support it, then connect the service to the Gateway. The chain got longer.

## 3. Running the numbers

Putting the two sections above together, the key is to see clearly **the fundamental difference between two kinds of cost**.

**"Configuration hassle" is a one-time cost:**

- Fallback logic—write it once, reuse it;
- Rotating a key + restart ≈ 1 hour;
- Onboarding a new platform ≈ a few hours to a day or two.

Its characteristics: **bounded, estimable, naturally amortized across the business, only affects a single service when it breaks, and any business developer can handle it.**

**The "AI Gateway" is a continuous liability:**

It's the mandatory path for all AI calls—a critical single point. To keep a critical single point continuously reliable, you have to pay over the long term: high-availability deployment, monitoring and alerting, capacity planning and rate limiting, version upgrades, security hardening, and—**someone on 7×24 standby**.

Its characteristics: **unbounded, long-term, requires specialized capability, and any failure is global.**

**Build vs. buy—the difference is here too:**

- **Buying a SaaS Gateway** is essentially outsourcing "7×24 ops" to a vendor. You spend money to save headcount. But you take on a new external dependency, data-egress / compliance risk, extra latency, and the vendor's own single point of failure. Not to mention it's designed for generic scenarios—**those complex routing rules of yours (splitting by user tier, routing to the nearest region, switching by cost budget, dynamically choosing a model by business context) may not be supported**, and in the end you either can't do it, or you have to bend the business to fit the product. On top of that, even an industry benchmark like Cloudflare has outages—betting your stability on a single company is a risk you can imagine.
- **Building your own Gateway** requires you to staff "7×24 ops" yourself, plus do ongoing custom development as needs evolve.

## 4. A recurring trap in technical decisions

Abstract the AI Gateway case up one more level and you'll see it's just an example. Behind it sits a technical-decision question that's easy to forget:

**When solving a problem, are you willing to pay a one-time cost, or a continuous cost?**

Almost every "should we adopt this platform / middle layer / framework" decision is, at its core, a choice between these two. And it's a very hard choice.

Take the AI Gateway: in reality, because the one-time cost is usually visible and painful—and people may keep complaining about it inside the company—the problem is easily blown out of proportion, which in turn makes the AI Gateway proposal easier to wrap in a beautiful narrative.

The continuous cost, on the other hand, hasn't happened yet; it's something the decision-maker has to judge from experience. Bluntly put, only those who've been burned truly get it.

As a leader, if you choose the AI Gateway, you have to bear the continuous cost of every problem it brings—and it may not even truly solve the problem. But if you don't, you have to keep absorbing the pressure of complaints, even pressure from above.

I'm writing this article precisely to help everyone see the essence of the problem, and to look at it from a different angle.

## 5. So when should you actually adopt one?

That said, an AI Gateway isn't something you can never adopt. When the following conditions hold **simultaneously**, it turns from a liability into leverage:

1. **Large enough scale**: Many projects, high call volume—so that the benefit of unified governance, once amortized, outweighs its fixed cost.
2. **Ops capability is existing stock, not a new increment**: You already have a platform / SRE team, so adding a Gateway is incidental—rather than hiring a new person or adding an on-call shift out of thin air.
3. **Governance is a hard requirement**: You must aggregate cost by project / key, you must audit, you must unify rate limiting and compliance—things that are hard to do with direct connections. Here the Gateway's value is irreplaceable.
4. **If you really must, buy first, don't build**: Outsource the 7×24 so that at least you don't carry the single point yourself. Building is the heaviest option; consider it only when data compliance, cost, and customization all hit a wall.

The criterion is actually simple—first figure out whether what you lack is "convenience" or "governance":

- **Just annoyed by the configuration** → that's only a day-or-two nuisance. Tough it out, or automate it with scripts / IaC; both are far cheaper than a gateway.
- **You genuinely need global governance, and you can afford it** → then adopt a gateway.

## Closing thoughts

Back to the AI Gateway: for the vast majority of companies, **don't rush to build it—tough it out for now, or automate the configuration with scripts / IaC**; if you really must, wait until both scale and team are in place, and prefer buying off the shelf.

But more worth remembering than the AI Gateway itself is the question behind it—

**A one-time cost is visible pain; a continuous cost is invisible debt.** Our instinct is always to first eliminate the one-time cost that hurts right now and that people complain about daily; yet few stop to calculate how many 7×24 shifts it will take in the future to repay the debt we sign up for in exchange.

To close with a Chinese proverb: **without a diamond drill, don't take on porcelain work.** Don't take on a job you're not equipped to handle.
