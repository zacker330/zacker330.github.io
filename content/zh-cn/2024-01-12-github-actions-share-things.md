---
layout: post
title: "DevOps架构师是如何看待Github Actions的共享制品解决方案的？"
Description: "只要对这一问题深入理解，所有的平台一通百通。"
date: 2024-01-16
tags: [Github Actions,Pipeline as Code, DevOps]
---
## 前言

Github Actions是Github提供的一个CICD Pipeline服务。除了Pipeline，它还提供Secret和简单的配置管理。

本文并不是它的一个完整介绍和知识的罗列。而是我在实际使用Github Actions后，对Github Actions的“共享问题”的解决方案的总结。

不要小看这个问题，它是所有的Pipeline平台（包括Gitlab CI）都会遇到的问题。只要对这一问题深入理解，所有的平台一通百通。

> 提示1：下文可能会是Workflows和Pipeline两个术语共用。因为它们本质上就是同一个东西，只是不同平台不同的叫法。
> 提示2：下文可能会共用DevOps平台和Pipeline平台，虽然它们可能是完全不同的平台，但是在本文中，它们都是能提供Pipeline的平台。

## 共享问题
只要是Pipeline平台，都会遇到共享问题。那么，什么是共享问题？

共享问题就是Pipeline中不同的位置之间共享资源，以实现不重复执行、生成准确结果的目标。

定义听起来有些枯燥。我们列举一个有共享的场景，就比较好理解了：
1. 比如对于一个单仓库，它同时包含多个前端工程，这些前端工程同时依赖于一个common模板。其它前端工程只有等它构建完成，并取得构建，才能开始自己的构建。如果common模板的构建结果不能被其它工程构建共享使用，就会存在构建结果不一致、重复构建的问题；
2. 比如一个Pipeline中，版本号是有特定格式的，需要在第一步骤计算出来后，其它步骤取得这个版本号，进行打包工作。如果没有实现版本号在多个步骤之间共享，很可能会导致版本号不一致问题。

我们稍微对共享问题进行抽象和理解，根据共享的范围，共享问题，可以分为：
1. Workflows之间进行共享；
2. Workflow内的Jobs之间进行共享；
3. Job内的Step之间进行共享。

根据共享的内容，可以分为：
1. 共享源码；
2. 共享制品；
3. 共享变量。


### Github Actionsr制品的定义
在Github Actions中的制品（Artifact）的概念和我们平时所说的“制品”有一定的区别。在Github Actions中，制品指的是Job生成的文件或者文件夹。

我们平时所说的，更广意的“制品”，在Github Actions叫Packages。

### Workflows之间的共享制品
一般只有在大型项目才会存在Workflows之间的共享。而我个人是不建议将依赖Pipeline实现大型项目的构建的，而是依赖构建工具本身的能力。

由于笔者时间有限，不再亲身做实验，本节内容，请读者自行测试。

如果Workflow是由workflow_run事件触发的情况下，它们就可以直接使用`actions/upload-artifact`和`actions/download-artifact`两个actions来实现制品的共享。相关文档：https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts#downloading-artifacts-during-a-workflow-run

有趣的是Github Actions提供了一种reusable的Workflow概念。说到底是一种模板化Workflow的方式。但是这种方式不适合用来实现共享制品。因为它并不是共享制品。相关文档：https://docs.github.com/en/actions/using-workflows/reusing-workflows#using-outputs-from-a-reusable-workflow

### Jobs之间共享制品
在同一个Workflow中，多个Job进行制品共享。如下代码：
```yaml
jobs:
// 生成制品的job
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build and export
        uses: docker/build-push-action@v5
        with:
          context: .
          tags: myimage:latest
          outputs: type=docker,dest=/tmp/myimage.tar
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: myimage
          path: /tmp/myimage.tar
// 使用制品的job
  use:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v3
        with:
          name: myimage
          path: /tmp
      - name: Load image
        run: |
          docker load --input /tmp/myimage.tar
          docker image ls -a         
```

以上案例来自：https://docs.docker.com/build/ci/github-actions/share-image-jobs/

注意: `actions/download-artifact`和`actions/upload-artifact`截止到2024年1月，它们都已经升级v4的版本。

好奇心强的同学就要问：
1. 这些制品会存放在哪里？存多久？
2. 制品大小有限制吗？
3. 需要收费吗？

答案在这里：https://github.com/actions/upload-artifact?tab=readme-ov-file#limitations 

关于Workflow存储数据为制品的更多信息：https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts

### Jobs之间共享变量

我有一个习惯，每使用一种Pipeline平台，我首先，会问该如何自定义版本吗？因为我的设计的版本号都会增加git的commitID前8位。

为什么要这么做？是因为过去，我看到的DevOps平台似乎都无法做到通过制品反查相应的源代码的能力。而在版本号上增加commitID是实现这一能力的最低成本方案。

如果平台没有提供这样的能力，我就通过自定义版本号来实现。实现方法就是在一个step生成版本号，其它step共享这一版本号。

但是，在Github Actions里，想实现这样的功能，是一件非常痛苦的事情。

以下是定义共享变量的代码：

```yaml
jobs:
  init_build_version:
    name: init build version
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: init version Properties
        id: properties
        shell: bash
        run: |
          VERSION="$(echo $(date +'v%Y.%m.%d')_${{ github.run_number }}_$(git rev-parse --short=8 HEAD))"
          echo "VERSION=$VERSION" >> "$GITHUB_OUTPUT"
          ... define other vars

    outputs:
      VERSION: ${{ steps.properties.outputs.VERSION }}
      ... other outputs
```

以下是其它Job使用共享变量的方法

```yaml
jobs:
  build_devops:
    name: package
    runs-on: ubuntu-latest
    # required
    needs:
      - init_build_version
    steps:
      # .. other steps
      - name: create a release draft
        id: create_prerelease
        uses: softprops/action-gh-release@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          tag_name: ${{ needs.init_build_version.outputs.VERSION }}
          name: ${{ needs.init_build_version.outputs.VERSION }}
          draft: true
          prerelease: false
          files: |
            # some files prepare to be uploaded
```
在Job中，通过`needs.init_build_version.outputs`来引用另一个Job的output。

这样的解决方案的问题：
1. 大量的重复代码
2. 这个Pipeline无法在本地验证和独立测试

官方文档：https://docs.github.com/en/actions/using-jobs/defining-outputs-for-jobs

### Step之间共享变量
同一个Job中多个step之间，通过环境变量进行共享变量。以下展示的是由一个step生成一个变量，再由后一step使用：
```yaml
jobs:
  steps:
    - name: define env
      shell: bash
      run: |
          VERSION="$(echo $(date +'v%Y.%m.%d')_${{ github.run_number }}_$(git rev-parse --short=8 HEAD))"
          echo "VERSION=$VERSION" >> $GITHUB_ENV
    - name: use-env
      run: echo '${{ env.VERSION }}'
```

当然，如果你不需要生成变量，而是固定的变量，则可以直接在Workflows顶层定义环境变量：

```yaml
env:
  APP_ENV: "stag"

jobs: 
  # use that env variable via ${{ env.APP_ENV }}
```

### Step之间共享制品
因为同一个Job下的step是共享一个Workspace的，所以，使用Step之间的制品，就和使用本地文件一样使用。

## 对Github Actions的看法
比较主观，仅供参考：
1. 选择YAML作为Pipeline的DSL，让人有“简单”的错觉，实际使用起来，非常的痛苦；
2. Debug过程非常耗时：因为你没有简单办法在本地进行Debug；

总之，它的开发体验非常差。但是从另一方面看，也是做DevOps产品公司的机会。

