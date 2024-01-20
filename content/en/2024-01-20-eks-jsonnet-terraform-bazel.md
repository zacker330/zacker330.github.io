---
layout: post
title: "Setting up EKS with Bazel, Jsonnet and Terraform"
Description: ""
date: 2024-01-20
tags: [Jsonnet,Bazel,EKS,Terraform]
---

# Overview
In this document, I'll describe my solution from the following parts:
- Part1 Architecture: describe the desired state of the architecture
- Part2 Implementation:
    - Code Structure Introduce
    - How to Build it
    - Deploy Nginx Controller using Helm

# Part1: Architecture

We assume that the project has a project named: health. Here's the architecture graph, which draw by [Excalidraw](https://excalidraw.com/)


![](/assets/images/eks-bazel-arch.png)



### Network Architecture
I created 4 subnets that are evenly distributed to 2 Availability Zones. Each availability zone has 2 subnets, one is public subnet,and another one is private subnet. 
The public subnet goes out through the Internet gateway and the private subnet goes out through the NAT gateway.

### Log
We also want to log events in CloudWatch for the cluster, so we create a log group for the eks cluster. 

### Security

In order to ensure network security, we create some security groups and rules for eks cluster.

# Part2: Implementation

## Code Structure 


### Why Monorepo
> A monorepo is a single repository containing multiple distinct projects, with well-defined relationships.

This is a monorepo. So everything of code in it. It's one of reason we choose [Bazel](https://bazel.build/about/intro) as our build tool.

Many benefits from monorepo as below:
- No overhead to create new projects:Use the existing CI setup, and no need to publish versioned packages if all consumers are in the same repo.
- Atomic commits across projects: Everything works together at every commit. There's no such thing as a breaking change when you fix everything in the same commit.
- One version of everything: No need to worry about incompatibilities because of projects depending on conflicting versions of third party libraries.
- Developer mobility: Get a consistent way of building and testing applications written using different tools and technologies. Developers can confidently contribute to other teams’ applications and verify that their changes are safe.

### Structure Introduce

```shell
% tree -L 5
.
├── BUILD.bazel
├── README.md 
├── WORKSPACE # It's a kind of Bazel project's file that to defined external dependencies.  
├── charts # It stores all Helm charts.
│   ├── BUILD.bazel
│   └── nginx-ingress # It's downloaded from Nginx official 
├── doc # It stores all docs in the monorepo. Each subfolder presents a project.
│   ├── BUILD.bazel
│   └── health
│       ├── BUILD.bazel
│       ├── architecture.excalidraw
│       ├── architecture.svg
│       └── terraform-graph.svg
├── docker-compose.yaml #  It's useful on local environment.
├── environments # It stores all the configuration of 3 environments. 
                 # Each environment folder has the same structure, by convention.
│   ├── BUILD.bazel
│   ├── production
│   │   └── BUILD.bazel
│   ├── staging # Store the configuration code of the staging environment for all projects. Each directory represents a project.
                # for more details, we can see it on test folder. 
│   │   ├── BUILD.bazel
│   │   └── health
│   │       ├── BUILD.bazel
│   │       ├── app
│   │       │   ├── BUILD.bazel
│   │       │   └── nginx-ingress.jsonnet
│   │       ├── infra
│   │       │   ├── BUILD.bazel
│   │       │   └── main.tf.jsonnet
│   │       ├── secrets.libsonnet
│   │       ├── secrets.libsonnet.secret
│   │       └── vars.libsonnet
│   ├── template
│   │   ├── BUILD.bazel
│   │   ├── aws # It stores all templates of aws terraform resource. 
│   │   │   ├── BUILD.bazel
│   │   │   ├── eip.libsonnet
│   │   │   ├── security_group_rule.libsonnet # security groups and rules for eks
│   │   │   ├── example-main.tf.json
│   │   │   ├── eks_cluster.libsonnet
│   │   │   ├── eks_node_group.libsonnet
│   │   │   ├── iam_role.libsonnet
│   │   │   ├── iam_role_policy_attachment.libsonnet
│   │   │   ├── internet_gateway.libsonnet
│   │   │   ├── main.libsonnet
│   │   │   ├── nat_gateway.libsonnet
│   │   │   ├── route_table.libsonnet
│   │   │   ├── route_table_association.libsonnet
│   │   │   ├── subnet.libsonnet
│   │   │   ├── tags.libsonnet
│   │   │   └── vpc.libsonnet
│   │   ├── azure # It stores all templates of azure terraform resource.
│   │   │   └── BUILD.bazel
│   │   └── gcp # It stores all templates of gcp terraform resource.
│   │       └── BUILD.bazel
│   └── test #  Store the configuration code of the test environment for all projects. Each directory represents a project. 
│       ├── BUILD.bazel
│       └── health # health project
│           ├── BUILD.bazel
│           ├── app # applications in health project
│           │   ├── BUILD.bazel
│           │   └── nginx-ingress.jsonnet # the values file, which in json format.
│           ├── infra
│           │   ├── BUILD.bazel
│           │   └── main.tf.jsonnet # terraform main file
│           ├── secrets.libsonnet # It's already ignored by gitignore. Here is just a example that show you that a file stores some secrets. 
│           ├── secrets.libsonnet.secret # It is the file that is encrypted by git-secrets and will eventually be committed to the git repository.
│           └── vars.libsonnet # All variables of this project. The variable in it can be referenced by anywhere.
└── tools   # Store some useful scripts
    ├── BUILD.bazel
    └── delete-vpc.sh
```

### Where is HCL?

As you notice that there's not exists any HCL file in our repo. Because I choose another solution to declare our infrastructure.

Terraform provides 2 kinds of syntax to declare resources:
- HCL syntax: Most Terraform configurations are written in it.
- [JSON syntax](https://developer.hashicorp.com/terraform/language/syntax/json): Terraform also supports an alternative syntax that is JSON-compatible. However, compared to the HCL language, JSON format used by fewer people.

The reason I choose JSON syntax is that the combine of Jsonnet and Bazel has many benefits as below:
1. Jsonnet is a complete programing language in configuration domain, which supports generating many kinds of configuration file, open source from Google. It can solve many configuration problems natively. And HCL did not do better than Jsonnet. For example, nested loop function is easy use in Jsonnet, but HCL not. For details as below:
   - HCL's way: https://blog.boltops.com/2020/10/06/terraform-hcl-nested-loops/
   - Jsonnet's way:  _Array Comprehensions_ section in https://jsonnet.org/ref/language.html
2. Slow speed of compile and test is painful when your project is big. The ways of reducing painful of them include: cached build, distributed build and build on demand. And Bazel supports them all well. Of course, there's a Bazel rule that supports building Jsonnet.
3. We're able to write unit testing easily.

So, finally, the tools we are using are:
1. Terraform
2. Jsonnet
3. Bazel

![](/assets/images/eks-bazel-tool.png)

Another articles about Jsonnet:
- [Fractal Application](https://jsonnet.org/articles/fractal.1.html)
- [Streamlining Terraform configuration with Jsonnet](https://www.codethink.co.uk/articles/2021/single-configuration-language/)

### What about Secret?
We use [git-secret](https://github.com/sobolevn/git-secret) for hiding our secrets in the monorepo. And the reveal secret key we can save it into GitHub Actions secrets for building.


### Terraform Graph
We can generate a graph with command: `terraform graph | dot -Tsvg > graph.svg`.

It will be updated before each commit by pre-commit, if you installed pre-commit. 

## How to Build it

### on local development environment
You can follow these two steps to build the code at first time:
1. install [Bazelisk](https://github.com/bazelbuild/bazelisk)
2. run `bazel test //... && bazel build //...` in root of project

NOTE: You should install pre-commit that to make sure something is ok before you commit.

### What's the Output after Build

After you build it successfully, you can get a main.tf.json in the bazel folder where is located in _bazel-bin/environments/test/health/infra_.

We give an example of main.tf.json in _environments/template/aws/example-main.tf.json_ .

### on GitHub Actions
We use GitHub Actions as our CI/CD platform. All things of it defined in _.github/workflows_ folder.

## Deploy Nginx Controller using Helm

Helm is a deployment tool for Kubernetes. The deployment command is `helm install -n <release ns> -f <values file> <helm release name> <chart path>`.

The values file of Nginx Controller is written by Jsonnet also. So we have to build them before the deployment.

### on Local Development Environment
You can follow these steps to deploy application to Kubernetes:
1. config your kubernetes config in your `~/.kube/config` file.
2. run command `bazel test //... &&  bazel build //...` in the root of this repo, then you would get a Helm values file with JSON format.  
3. deploy it with `helm install -n nginx-ingress -f bazel-bin/environments/test/health/app/nginx-ingress.json nginx-ingress ./charts/nginx-ingress`

### Verify it
After finishing the deployment, we can get an endpoint of nginx-controller that exposed by NLB. 
A few minutes later, the endpoint is available, so that you can access it. 

