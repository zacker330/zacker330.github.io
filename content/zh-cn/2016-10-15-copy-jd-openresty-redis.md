---
layout: post
title: "模仿京东使用Openresty+Redis做读服务"
Description: "直接在Nginx上开发web应用是怎么一回事？"
date: 2016-10-15
tags: [Nginx, Openresty, Lua, Redis, lua-resty-template, lua-resty-redis]
comments: true
share: true
---
看了[开涛的Nginx+Lua开发教程](http://www.iteye.com/blogs/subjects/nginx-lua)，很是感兴趣。所以，自己也把环境搭建起来玩。

跟开涛的不同，我使用Vagrant + Ansible来搭建（不要问我为什么不使用Docker）。这样，所有的人只要两条命令就可以搭建好了，而不需要手工一条命令一条命令打。

所谓使用Openresty来做读服务，是指Openresty直接从数据源读数据，然后渲染输出，而不经过应用服务器，比如Tomcat服务器。[Openresty](http://openresty.org/en/) 是一个基于Nginx和LuaJIT的动态Web开发平台。我不知道京东是否是直接使用Openresty还是自己编译Nginx + Lua。反正，我直接使用Openresty。

本次文章就是根据开涛的教程，实现使用[lua-resty-template](https://github.com/bungle/lua-resty-template) 做模块引擎，使用Redis做数据源。我把Openresty和Redis都安装在同一台机器上，以方便做实验，当然，如果你想装在不同的服务器，只需要修改下配置就好了。以下是架构：

![openresty_redis](/assets/images/openresty_redis-1.png)

#### 搭建的步骤：

1. 安装Openresty及其相关的Openresty module: lua-resty-template、lua-resty-redis
2. 安装Redis，启动Redis
3. 配置Openresty，启动Openresty
4. 写页面逻辑代码

整个步骤我都写成了Ansible自动化配置脚本。所以，你已经不需要自己搭建。所有的代码都托管在：http://git.oschina.net/zacker330/openresty-lab 。

#### 启动方法

启动前，你必须安装Vagrant 和 Ansible 2.0+。

```shell
git clone https://git.oschina.net/zacker330/openresty-lab.git
cd openresty-lab
vagrant up 
ansible-playbook ./ansible/playbook.yml -i ./ansible/inventory -u vagrant -k
>> 输入ssh密码 `vagrant`
```

PS. ansible-playbook需要通过ssh登录上目标机器来执行我们的任务。

接下来，我们解释下代码。

Openresty的配置如下：

```nginx
## 省去了一些不重要的nginx配置

http {
    default_type  application/octet-stream;
    ## 省去了一些不重要的nginx配置
  
    ## 初始化所需要对象
    init_by_lua '
        require "resty.core"
        redis = require "resty.redis"
        template = require "resty.template"
        template.caching(false); -- you may remove this on production
    ';

   server{
      listen       80;
      server_name  192.168.8.10;
      charset        utf-8;      
  	  ## 指定 模块路径	
      set $template_root "/usr/local/openresty/nginx/html/templates";
      location ~ \.lsp$ {
        default_type text/html;
        content_by_lua 'template.render(ngx.var.uri)'; ## 访问index.lsp，将使用index.lsp模板
      }

	}
}
```

页面逻辑代码 index.lsp：
{% raw %} 

```lua
    {%

        layout = "layouts/default.lsp" -- 模板

        local  blogid= ngx.var.arg_blogId
        local  title = "博客标题"
        local    author = {name = "fooname", gender = "female", level= 3}
        local    description = "<script>alert(1);</script>"
        local    content = "java8的流式处理极大了简化我们对于集合、数组等结构的操作，让我们可以以函数式的思想去操作，<br/>本篇文章将探讨java8的流式数据处理的基本使用。"
        local    tags = {"life", "lua", "openresty"}
        local    radar = {lua = 90, openresty = 80, nginx = 70}

  		-- 使用nginx的内置变量
        local a = ngx.var.arg_a
        local b = ngx.var.arg_b
        local ip = ngx.var.remote_addr

  	    -- 使用redis读数据源
        local red = redis:new()
        red:set_timeout(1000)
        local ok, err = red:connect("127.0.0.1", 6379)
        if not ok then
           ngx.say("failed to connect: ", err)
           return
        end

        local ok, err = red:lpush("list", a, b)
        local member, err = red:llen("list")

    %}
<div>
 member: {{ member }}<br/>
 remote ip: {{ ip }}

 blogId: {{blogid}}<br/>
 作者: {{author.name}} {{author.gender}} level: {{author.level}}<br/>
 description: {{description}} <br/>
 tags:  {% for i = 1, #tags do %}
     {% if i > 1 then %},{% end %}
     {* tags[i] *}
  {% end %}<br/>
</div>
```
{% endraw %}


最终访问效果：http://192.168.8.10/index.lsp?a=12&b=asdfasdf&blogId=111


![result](/assets/images/openresty_redis-2.png)

#### 小结

1. 这种不经过应用服务器的方式，读的速度似乎更快，毕竟省去了中间的Tomcat服务。但是，谁来填充数据给Redis和什么时机填充数据，又是另一回事了。

2. 开发过程似乎有些麻烦，因为修改nginx配置后，不能像普通的页面开发那样立马看到效果，还要nginx -s reload一下。这个，我想到的解决方案是使用Ruby的guard gem来监控文件变动，然后reload nginx配置，最后使用浏览器的livereload来自刷新页面。https://github.com/guard/guard-livereload 目前还没有时间实现，希望有热心朋友实现提pr。或者开涛能分享下他们的实践。希望他本人能看到这篇博客。:P




#### 参考：

[第五章 常用Lua开发库3-模板渲染](http://jinnianshilongnian.iteye.com/blog/2187775)

[lua-resty-template](https://github.com/bungle/lua-resty-template)



2016.10 于深圳西丽人民医院
