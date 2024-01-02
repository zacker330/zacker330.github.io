---
layout: post
title: "使用Ansible实现自动化运维的一些技巧"
Description: ""
date: 2018-06-22
tags: [运维]
comments: true
share: true
---

> 提示：本文要求读者有一定的 Ansible 使用经验

最近一年才有机会在生产环境上使用 Ansible。用的过程中，想把一些小技巧记录下来，避免自己忘记。如果能帮助到其他同学就更好了。如果有同学指出有更好的方法，就更更好了。

### 技巧1：校验你的模板文件是否正确
通常我们会使用`template` module 来生成应用的配置，比如生成 Nginx 的配置或者 sudoers 配置。而像 sudoers 文件内的配置错误可能直接导致无法登录。所以，我们希望在生成这些配置文件后能校验一下它的正确性。如果校验失败，直接停止，不生成该配置文件。

而 `template` module 有一个属性 `validate` 就是为了实现这一需求的：

```yaml
- template:
    src: "user-sudoers"
    dest: "/etc/sudoers.d/abc"
    validate: visudo -cf %s
```

校验 Nginx 配置文件的文件：

```yaml
- name: Copy the nginx file
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    validate: "/usr/sbin/nginx -t -c %s"
  notify:
   - restart nginx
```

校验 Prometheus 配置文件：

```yaml
- name: Copy Prometheus config
  template:
    src: prometheus.yml.j2
    dest: "/etc/prometheus.yml"
    validate: "promtool check config %s"
  notify:
    reload prometheus config
```

校验 Logstash 配置文件：

```yaml
- name: template configs
  template:
    src: "logstash-filter.conf"
    dest: "/opt/logstash/conf"
    validate: "logstash -t -f %s"
  environment:
        JAVA_HOME: "{{JAVA_HOME}}" ## logstash 命令需要 JAVA_HOME 环境变量
```

### 技巧2：使用 host 变量解决分布式系统中的 id 问题
在部署 Zookeeper 时，通常会部署 3 台组成集群，同时每台 Zookeeper 都需要在配置一个 myid 的文本文件，而这个文件中只放id。而 id 是要求每台机器都是不同的。这时 host 变量派上用场了。定义 host 变量有两种方式：

#### 第一种：直接在 inventory 文件中定义

```
[zk]
192.168.1.11 myid=1
192.168.1.12 myid=2
192.168.1.13 myid=3
```
#### 第二种：在 host_vars 目录中定义
这种方式笔者认为可维护性更高
```
├── group_vars
├── host_vars
│   ├── 192.168.1.11
│   ├── 192.168.1.12
│   ├── 192.168.1.13
├── hosts
```

```bash
#cat 192.168.1.11
myid: 1
```

**不推荐两种方式都使用，因为变量的作用域问题会把你搞晕**

### 技巧3：在执行 shell 时需要某个环境变量
某个 shell 需要一个临时变量，可以使用 environment 实现
```yaml
  - name: install | Build commons daemon.
    shell: "./configure && make chdir=/opt/pinpoint/"
    environment:
      - JAVA_HOME: "{{ JAVA_HOME }}"
```
### 技巧4：Jinjia2 语法：去除最后的逗号

以下方式会生成：`a,a,a,a,` 注意最后的逗号我们是不需要的：  

```
{%raw%}
{% for f in files %}
a,
{% endfor %}
{% endraw %}
```

这时，我们可以这样：

```
{%raw%}
{% for f in files %}
a{%- if not loop.last -%},{% endif %}
{% endfor %}
{% endraw %}
```

### 技巧5： 利用 host 变量解决机器连接方式的不统一的问题
机器标准化要求每台机器的ssh连接方式及管理员用户名及密码都是一样的。但是事实中，面对老机器，常常做不过。所以，我们的 Ansible 脚本必须能做到不同的机器可以使用不同的连接方式、管理员用户名和密码。利用 host 变量就可以实现了。

举个例子，当前的文件内容如下：

```
├── group_vars
├── host_vars
│   ├── 192.168.1.11
│   ├── 192.168.1.12
│   ├── 192.168.1.13
├── hosts
```

```yaml
#cat  192.168.1.11
ansible_ssh_user: abc
ansible_become_method: sudo
ansible_ssh_private_key_file: /users/abc/id_rsa
```

```yaml
#cat  192.168.1.12
ansible_ssh_user: bcd
ansible_become_method: sudo
ansible_ssh_pass: 1234567
```

```yaml
#cat  192.168.1.13
ansible_ssh_user: bcd
ansible_become_method: su
ansible_ssh_private_key_file: /users/bcd/id_rsa
ansible_ssh_pass: 1234567
```

### 小结
常识和技巧之间的界限很模糊。总之，希望对读者有帮助。
