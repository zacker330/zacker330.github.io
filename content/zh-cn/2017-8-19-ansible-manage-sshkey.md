---
layout: post
title: "简单易懂Ansible系列 —— 实现ssh key主机之间复制"
Description: ""
date: 2017-08-19
tags: [ansible,devops]
comments: true
share: true
---
我们在搭建Hadoop完全分布式环境时，Hadoop的name node节点（理解为master节点）需要无密码登录到所有的data node节点。

当然，我们使用手工的方式很容易就实现了：

1. 在name node节点上生成ssh key：ssh-keygen
1. 将public key copy到所有的data node节点上：ssh-copy-id slave1

同时，你还必须设置`~/.ssh/config`，以防止登录时不停的问yes or no：

    ```yml
    Host *
        StrictHostKeyChecking no
    ```

完了，还要设置这个文件的权限为**400**。

以上步骤当然可以手工一步步执行。但是，总有那么一些人：希望所有的操作都可以版本化，所有的操作都应该自动化。我属于这些人。

再说了，我发现在搭建Jenkins环境时，也遇到了同样的问题：需要将Jenkins master的public key加入到Jenkins agent机器中。

可以预见到将来我还会遇到类似的问题。于是，我找到一个方法来自动化以上操作。

### 在name node机器上执行task如下
1. 创建用户的时候生成ssh_key：

    ```yml
    - name: create hadoop user
      user:
        name: "{{hadoop_user}}"
        group: "{{hadoop_group}}"
        createhome: yes
        generate_ssh_key: yes
        ssh_key_bits: 2048
        ssh_key_file: .ssh/id_rsa
      tags:
        - hadoop
    ```
2. 将id_rsa.pub拉取到ansible执行机器上

    ```yml
    - name: fetch public key
      fetch:
        src: "/home/{{hadoop_user}}/.ssh/id_rsa.pub"
        dest: /tmp/
        flat: yes
      tags:
        - hadoop

    ```
3. 设置`StrictHostKeyChecking no`
因为我们只想修改这个用户的ssh行为，所以我们的ssh的配置只是针对当前这个用户的：

    ```yml
    - name: namenode ssh config
      template:
        src: ssh.conf
        dest: "{{hadoop_user_home}}/.ssh/config"
        mode: "400"
        owner: "{{ hadoop_user }}"
        group: "{{ hadoop_group }}"
      tags:
        - hadoop

    ```
**ssh.conf** 的内容如下：

    ```yml
    Host *
      StrictHostKeyChecking no
    ```



### 在data node机器上执行的task如下
1. 将public key加入到data node的机器中，`/tmp/id_rsa.pub`就是刚由name node机器生成将拉取到本地的key

    ```yml
    ## 此时，会在data node机器中相应的用户目录的.ssh文件夹中生成authorized_keys文件，并将public key内容放到里面
    - name: add master public key to slaves
      authorized_key:
        user: "{{hadoop_user}}"
        key: "{{ lookup('file', '/tmp/id_rsa.pub') }}"
      tags:
        - hadoop

    ```
2. 设置.ssh目录的权限为700
不清楚为什么authorized_key模块自动生成的.ssh的权限过高，所以还需要将目录设置成700：

    ```yml
    - name: make .ssh folder 700
      file:
        path: "{{hadoop_user_home}}/.ssh/"
        state: directory
        mode: "700"
        owner: "{{ hadoop_user }}"
        group: "{{ hadoop_group }}"
      tags:
        - hadoop
    ```
