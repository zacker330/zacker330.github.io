---
layout: post
title: "Two Patterns for Rollback"
Description: ""
date: 2024-03-06
tags: [IaC]
---

Rollback is an operations and maintenance procedure. It usually occurs when a problem is discovered during deployment, and the target environment needs to be reverted to its pre-deployment state.

In my opinion, there are two patterns for rollback. One of them is to perform a reverse operation step by step, which I call the **Reverse Operation Pattern**.

## Rollback Pattern Based on Reverse Operation

Probably due to the inertia of the past manual operation mindset, I found that quite a few people only know this one pattern.

For example, the operation of manually deploying an Nginx configuration is as follows:

1. SSH into the target server
2. Navigate to the `/etc/nginx/sites-enabled/` directory where Nginx is stored
3. Edit the target configuration file `vim example.443.conf`
4. Add a location configuration
5. Reload Nginx to apply the configuration changes

In the rollback scenario using the reverse-operation pattern, how should we roll back? Steps 1, 2, 3, and 5 are the same as in deployment. Step 4 requires the operator to find the configuration and remove it.

At this point, the operator may make a mistake in the operation, and it may be difficult to perceive when the mistake is made because it is a manual operation.

Then, some people think it would be better if the above steps could be automatically rolled back.

But how can we automate the rollback? We need to design the corresponding automated rollback script at the time of deployment. When needed, trigger its automatic rollback.

However, this rollback scheme is not generalizable, and it increases the cost of operations and maintenance. Because the average person maintaining an Nginx configuration change is very reluctant to write a rollback script, and they themselves may not be able to write a correct, reliable automated rollback script.

Then, someone might think, "Can I implement a platform to automatically generate the rollback code?"

The answer is yes. You have to pre-define each step action, such as defining the Nginx configuration change as an action in the platform. Then define its inverse action.

If you are implementing a similar platform project, you will know that the amount of work is endless because the operations are endless.

You can say that the platform can provide the ability to customize the step action, but then you will also encounter the problem of "they themselves may not be able to write a correct and reliable automation rollback script." And, since it's a platform, it's the platform's responsibility to define the actions.

So, this is an industry dilemma.

During the interview process, the interviewer usually assumes that I will encounter the same dilemma. However, I won't encounter this problem at all.

## Version-based Rollback Pattern

When I was explaining this pattern, many people couldn't understand it.

Let's take the case of deploying an Nginx configuration, but automate the deployment through Ansible. Assume that the following deployment script already exists:

```yaml
- hosts: prod-nginx
  gather_facts: yes
  become: true
  vars_files:
    - common_vars/nginx.yaml

  roles:
    # Nginx deployment logic, which is declarative and idempotent
    - ansible-role-nginx
```

The above code means roughly: deploy Nginx to a list of prod-nginx hosts and use the configuration in the common_vars/nginx.yaml file.

The configuration of nginx.yaml is as follows:

```yaml
nginx_vhosts:
  - listen: "80"
    server_name: "*.example.com"
    return: "301 https://{{example_domain}}$request_uri"
    filename: "example.80.conf"
```

We version the above code (commit it to Git and build it via automation) to get version number: v1.0.1.

When there's a need to modify the configuration on the line, such as in the case of "Rollback Mode for Reverse Operations," we accomplish this by appending the appropriate configuration to the nginx.yaml file. It will resemble the following structure:

```yaml
nginx_vhosts:
- listen: "80"
  server_name: "*.example.com"
  return: "301 https://{{example_domain}}$request_uri"
  filename: "example.80.conf"
- listen: "80"
  server_name: "*.abc.com"
  return: "301 https://{{example_domain}}$request_uri"
  filename: "abc.80.conf"
```

Subsequently, the code is integrated into the codebase, resulting in the version number: v1.1.0.

During deployment, the v1.1.0 code is simply deployed.

With the version-based rollback mode, reverting is straightforward. It involves executing the code from v1.0.1 (the preceding version of v1.1.0) again.

Creating a platform based on this pattern is equally straightforward. The platform isn't concerned with the specifics of the operation; its primary objective is to select the last correct version of the code for execution, thus facilitating the rollback process without encountering various issues associated with "reverse operation based on rollback mode" implementations.

This simplicity also facilitates the standardization of the platform's deployment process.

However, it's essential to note that the version-based rollback mode necessitates idempotent, declarative deployment code execution. Idempotent implies that running the same code multiple times yields the same outcome.

## Summary
The version-based rollback model essentially constitutes deployment, utilizing an earlier version of deployment in lieu of traditional "rollback" procedures.

In conclusion, I trust this article has sparked some fresh perspectives.

