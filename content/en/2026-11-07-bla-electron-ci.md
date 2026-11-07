---
layout: post
title: "Using BLA to Counter REA's AI Reverse Engineering: An Electron Example"
Description: "From REA and BLA's approach to Electron CI integration, automated testing, evaluation costs, and software engineering as a competitive advantage."
date: 2026-11-07
draft: false
tags: [Electron, CI, GitHub Actions, Security]
categories: ["Software Engineering"]
comments: true
share: true
---

**English** | [简体中文](/zh-cn/2026-11-07-bla-electron-ci/)

## What AI reverse engineering changes

[REA](https://github.com/morluto/rea) gives AI agents reverse engineering tools to inspect applications without source code and help reconstruct features. Can software companies still protect their implementations?

## How BLA responds

[BLA](https://github.com/qybaihe/bla/blob/8f90e567ebf221a7815f8690fa8a602201cf4aa8/README.md#what-bla-does) adds material that interferes with analysis to release artifacts. Decoy modules and call relationships give agents more leads to check. Expanded metadata can also reach a particular parser's resource limits.

The ASAR approach used here transforms JavaScript and [expands archive directory information](https://github.com/qybaihe/bla/blob/8f90e567ebf221a7815f8690fa8a602201cf4aa8/src/shields/exhaustion/asar-header-amplifier.ts). Its goal is to keep the application usable while increasing analysis overhead or limiting particular entry points. Effectiveness depends on the artifact format and tool versions, so it needs evaluation.

## Integrate BLA into Electron CI

The [zacker330/bla-ci repository](https://github.com/zacker330/bla-ci) contains a small quote calculator and three-platform CI. The build job runs BLA after generating the original `app.asar`, before packaging the final application, generating integrity records, and signing.

Hardening changes delivered files. A later packaging step that regenerates them can overwrite the protection. Making BLA part of the build fixes the order of operations, runs it for every release, and blocks delivery when it fails.

```text
Original artifact → control package → regression tests
        └→ BLA → hardened artifact → packaging and regressions → channel-specific signing and release checks

Both artifacts → evaluate defenses against REA's AI reverse engineering when required
```

The [build script](https://github.com/zacker330/bla-ci/blob/main/scripts/build.mjs) keeps the original ASAR and generates a hardened version:

```sh
npx --no-install bla audit dist/asar/original/app.asar --json
npx --no-install bla protect dist/asar/original/app.asar \
  -o dist/asar/hardened/app.asar --intensity bankrupt \
  --seed bla-ci-demo-v1 --json
npx --no-install bla verify dist/asar/hardened/app.asar \
  dist/asar/original/app.asar --json
```

Lock tool versions and dependencies, and harden a fresh original artifact each time. The fixed seed supports reproducibility; it is not a secret. Stop the build if a command or check fails, and retain reports. `dist/build.json` records versions, configuration, artifact hashes, and durations so tests and evaluations can verify their inputs.

Automated tests run the same key business cases against the original and hardened packages to check that hardening has preserved covered behavior. They launch the packaged program and verify the hashes of loaded files, tying results to the content being delivered. Source-only tests cannot verify this artifact transformation. Keeping these cases in CI reruns them after source or BLA changes, helping catch hardening regressions.

Integrity records and signatures need to describe the final content. Changing files after signing can invalidate checks. The example has no distribution certificates or notarization; products need to add their [release requirements](https://www.electronjs.org/docs/latest/tutorial/code-signing) and verify the final distribution package.

The example pins `bla-agents@3.0.1`. Run `npm ci` and `npm run ci` to build and test it; the README covers Linux setup. For other languages and frameworks, check BLA's [format coverage and limitations](https://github.com/qybaihe/bla/blob/8f90e567ebf221a7815f8690fa8a602201cf4aa8/README.md#format-coverage), then substitute the appropriate artifacts and test entry points.

## Evaluation and cost in an engineering workflow

Hardening adds file-processing and regression work and may enlarge artifacts. Complete AI reverse engineering evaluations also incur model and execution charges and require human review. Teams need to design the evaluation method and its execution policy together.

### How to evaluate defenses against REA's AI reverse engineering

Functional regressions check whether the application still works. This evaluation tests whether BLA lowers REA's success rate at recovering a target feature or increases the time and cost of doing so. That evidence supports decisions about which hardening strategy to use.

`bla verify` uses BLA's own [static simulation](https://github.com/qybaihe/bla/blob/8f90e567ebf221a7815f8690fa8a602201cf4aa8/src/engine/verifier.ts). The [upstream redteam script](https://github.com/qybaihe/bla/blob/8f90e567ebf221a7815f8690fa8a602201cf4aa8/scripts/redteam/run.mjs) runs real REA parsers. A capacity error at one entry point does not establish that a complete agent cannot find another path.

Define a task with an executable acceptance check, such as recovering a calculation rule and submitting an implementation that passes test cases:

1. Retain the original and hardened artifacts from the same build and record their hashes. First establish that the task can be completed against the original.
2. Fix REA, the model, and the task prompt. Keep tool environments consistent. Set time, token, or cost limits and the number of trials in advance.
3. Use real REA and an agent to analyze each artifact in an independent session. Supply only the relevant artifact, excluding source code and results from other sessions.
4. Check submissions against acceptance cases held by the evaluator. Record successful and total trials, actual duration, and cost.

Record budget exhaustion as not completing within that budget. Missing tools or an unavailable model service make an evaluation invalid. If the control also fails, investigate the evaluation design. Conclusions apply to the evaluated artifacts, configuration, and budget; they cannot establish that the software will never be cracked.

The example's source is public. It demonstrates builds and functional regressions, and has not run real REA or implemented this evaluation scheduling. Companies should assess protection using representative artifacts they own.

### When to evaluate

Running a complete evaluation before every build finishes can spend money on versions that fail regressions or are soon replaced. Let the build and regressions pass, then evaluate according to changes and release timing to reduce repeated work:

| Timing | Checks |
| --- | --- |
| Routine commits and pull requests | Build, BLA static checks, and functional regressions |
| Initial integration or important changes | Establish or rebuild the original-versus-hardened evaluation baseline |
| A frozen candidate with passing regressions | Match evaluation records to the current artifact and complete required release checks |
| Scheduled or manual runs | Expand samples and examine new analysis paths within a separate budget |

Important changes include core logic, hardening configuration, packaging, REA, and the model. Give complete evaluations cost caps, timeouts, and concurrency limits. Reuse results only when artifact hashes and evaluation conditions match, and check their expiry. A Git commit alone is insufficient.

Skipping is not passing. Without a built REA checkout, the upstream redteam script reports `unverified` but still exits with code 0. Inspect report status and the checks that actually ran.

### Calculate and control evaluation costs

Estimate the direct cost of complete evaluations as follows. All figures below are hypothetical, not model prices or measurements from this example. The calculation covers one original-and-hardened artifact pair. A trial is one complete task attempt against one artifact, and its model cost includes all calls. Add costs separately for additional platforms or targets.

```text
Cost per complete evaluation = 2 × tasks × trials per task × (average model cost per trial + average execution cost per trial)
                              + review hours × hourly labor cost
Monthly evaluation cost = complete evaluations × cost per complete evaluation
```

Suppose a trial averages 100,000 input tokens and 20,000 output tokens at assumed rates of CNY 10 and CNY 50 per million respectively. Model cost is `0.1 × 10 + 0.02 × 50 = CNY 2`. Assume CNY 1 in execution cost per trial, plus 0.5 hours of review at CNY 100 per hour. For one task repeated five times per artifact, a complete evaluation costs `2 × 1 × 5 × (2 + 1) + 0.5 × 100 = CNY 80`.

Assume 400 commits a month, with 20 complete evaluations covering all mandatory checks. Other commits leave the evaluated artifact and conditions unchanged, and their evaluation records remain valid:

| Approach | Complete evaluations | Model and execution cost | Review hours | Total including labor |
| --- | ---: | ---: | ---: | ---: |
| Evaluate every commit | 400 | CNY 12,000 | 200 | CNY 32,000 |
| Trigger by mandatory evaluation rules | 20 | CNY 600 | 10 | CNY 1,600 |

The total difference is CNY 30,400: CNY 11,400 in model and execution costs, plus 190 hours of review capacity. Fewer labor hours do not necessarily reduce that month's cash spending. Both approaches cover the mandatory checks; shared costs such as routine builds are excluded.

## Software engineering and competitiveness

Teams remain responsible for delivered versions and evaluation conclusions when AI writes code or assists analysis. Linking source, artifacts, configuration, and evaluation records makes it possible to investigate weaker protection or evaluation costs that exceed their budget.

With mandatory checks and delivery quality held constant, avoiding duplicate evaluations frees budget for more useful tests and review time for important changes. Lower verification cost per release and faster feedback let a company support more iterations with the same resources, creating advantages in cost and delivery speed.
