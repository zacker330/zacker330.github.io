---
layout: post
title: "Shell Bash能力对于运维很重要吗？"
Description: "不重要是假的，重要也是假的"
date: 2023-10-22
tags: [Testing]
---
> Bash能力对于一个运维重要吗？

这个问题本身该不该问？我觉得是有必要的思考的。这关乎团队的能力建设。

对于这个问题的答案，我的答案是看情况。

先说一个现实中真实发生的案例。

多年前，某部门所维护的系统经常出现一些“异常”的流量。部长让架构师对20多台机器上的系统日志进行分析，以确认是否真的有“异常IP”在做坏事。

这下可难倒这位架构师了，三天时间没有搞定这个需求。

最后，过了没有多久，这位架构师就被毕业了。

纵然这位架构师被毕业的原因很多，但是他是真不会做这个事情，也是事实。

在手工运维情况下，使用Bash对日志进行分析，在运维行业里一件很常见的事情，是必备技能。

所以，这位架构师在部长面前就是“没有能力”。

这时，你觉得Shell/Bash的能力重要吗？

再说我做DevOps这几年的感受。

我经历过将手工运维升级至自动化运维的过程。这整个过程，从手工，到使用Ansible自动化部署到虚拟机，再到使用Helm实现自动化部署应用到Kubernetes。

以上的那位架构师遇到问题，在手工运维阶段，我们也遇到过。

而且这个问题，是有一个专门的“熟手”负责。他可以熟练的同时登录上多台服务器，然后在多个窗口中娴熟地敲打命令。因为只有他懂grep哪些关键字能快速找到问题，所以，团队里的成员经常找他grep排查问题。

然而，在我们将日志进行结构化后，所有有权限的人（不论开发还是运维），只要简单的学习一个sql就可以轻松统计分析日志了。

结果就是不仅这位“熟手”的生产力被释放了，团队里其他经常排队等他帮忙的人的生产力也被释放了。

在这样的场景下，Shell/Bash的能力重要吗？

Shell/Bash的能力，除了被应用于日志分析，还有一个很大应用：部署。

比如以下类似的Bash脚本（示例代码是从网上获取的）：
```bash
group1_deploy(){ # 代码解压部署函数
    writelog "group1_code_deploy"
    for node in ${GROUP1_LIST};do # 循环生产服务器节点列表
        cluster_node_remove $node  
        echo "group1, cluster_node_remove $node"
        ssh ${node} "cd /opt/webroot && tar zxf ${PKG_NAME}.tar.gz" # 分别到各web服务器节点执行压缩包解压命令
        ssh ${node} "rm -f /webroot/web-demo && ln -s /opt/webroot/${PKG_NAME} /webroot/web-demo" # 整个自动化的核心，创建软连接
    done
    scp ${CONFIG_DIR}/other/192.168.3.13.server.xml 192.168.3.13:/webroot/web-demo/server.xml  # 将差异项目的配置文件scp到此web服务器并以项目结尾
}
```

当你所在部门还在使用这样的脚本进行自动化部署时，你就必须要有Shell/Bash的能力。但是，当你使用Ansible来实现wordpress的部署，几乎不需要写任何Bash脚本。

因此，团队里，你不需要招Bash高手，你只需要招一个刚毕业没多久的运维或者开发，就可以维护此Ansible脚本。代码如下：

```yaml
- hosts: all
  become: true
# 省略部分代码
  tasks:
    - name: ==> 0 - add host info
      lineinfile: dest=/etc/hosts line="10.0.0.10  {{ hostname }}" state=present

    - name: ==> 1 - add PPA of php7 (community)
      apt_repository: repo="ppa:ondrej/php"
      
    - name: add Nginx stable repository (deb)
      apt_repository: >
        repo='deb http://nginx.org/packages/ubuntu/ trusty nginx'
        state=present
# 省略部分代码
    - name: ==> 4 - install nginx, php-fpm, and php-mysql
      apt: name={{ item }} state=present
      with_items:
        - nginx
        - php7.0-fpm
        - php7.0-mysql
    - name: download wordpress tarball
      get_url:
        url: "https://tw.wordpress.org/wordpress-{{ wordpress_version }}-zh_TW.tar.gz"
        dest: /tmp/

    - name: extract wordpress tarball
      unarchive:
        src: "/tmp/wordpress-{{ wordpress_version }}-zh_TW.tar.gz"
        dest: "{{ wordpress_parent_path }}"
        owner: "{{ wordpress_owner }}"
        group: "{{ wordpress_group }}"
        copy: no
# 省略部分代码
    - name: copy wordpress site conf for nginx
      template:
        src: ./templates/nginx-wordpress.conf.j2
        dest: /etc/nginx/conf.d/nginx-wordpress.conf

    - name: fix listen.owner for php-fpm
      lineinfile:
        dest: /etc/php/7.0/fpm/pool.d/www.conf
        regexp: '^listen.owner\s*=.*$'
        line: "listen.owner=nginx"
        state: present

    - name: restart php-fpm
      service: name=php7.0-fpm state=restarted
```

在这样的场景下，Shell/Bash的能力重要吗？

## 小结
在手工运维或者基于Bash的运维的场景下，Shell/Bash的能力很重要，他关乎你的饭碗。

在基于声明式的自动化运维场景，Shell/Bash的能力就没有那么重要了。你能看懂Bash脚本就可以了。即使要写，你让GPT给你写个模板出来即可。

当然，即使真要写非声明式的自动化脚本，写Python脚本会不会更好？





