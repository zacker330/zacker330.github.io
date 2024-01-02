---
layout: post
title: "Ansible 开发环境的搭建"
Description: ""
date: 2019-11-7
comments: true
share: true
---
通常我不喜欢写开发环境搭建类文章的，但是见到不少同学在 Ansible 的开发环境花了很多时间。所以，就想写这么一篇文章。希望能帮助到有需要的同学。

在介绍开发环境搭建之前，需要介绍 Ansible 脚本的开发流程。

不像普通的业务系统的开发，只需要打开 IDE 就可以写代码，然后调试了。当然 Ansible 脚本也可以进行单元测试，但是 Ansible 脚本还是需要真实运行并部署，才能验证脚本的正确性。

所以，Ansible 脚本的开发过程通常是这样的：

1. 启动一台虚拟机。
1. 在开发机上编辑 Ansible 脚本。
1. 在开发机上执行 `ansible-playbook -i hosts playbook.yml` 命令。

![image.png](/assets/images/292372-d7b06e6bd82792df.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

通过 Ansible 脚本的开发过程了解到，开发环境的搭建可以分成3部分：
1. 测试机器的准备。
1. 文本编辑器的准备。
1. Ansible 的安装。

### 1. 测试机器的准备
见到不少同学使用 Vmware 或 VirtualBox 手工创建虚拟机。这种方式是可以达到搭建测试机器的目的。但是笔者认为这样不够好。因为验证 Ansible 脚本，我们需要频繁创建新的虚拟机。手工创建虚拟机的效率太低。而且不利于版本控制。

所以，测试机器的准备，笔者使用的是 Vagrant。通过它，可以自动化创建和配置虚拟机。当然，整个过程还是版本控制的。

同时需要注意，Vagrant 本身并不是一个虚拟机的实现，它是基于 VirtualBox 和 Vmware 的。换句说就是我们可以通过 Vagrant 去控制 Vmware 和 VirtualBox。所以，在安装 Vagrant 的同时，也需要安装 VirtualBox 或 Vmware。本文使用 VirtualBox。

Vagrant 和 VirtualBox 的具体安装在本文末有官方教程。

### 2. Vagrant 介绍
Vagrant 本身只是一个软件，提供了 `vagrant` 命令。我们通过一个名为 Vagrantfile 的文件声明启动什么配置的虚拟机。

Vagrantfile 文件的编写，不需要从零开始，可以使用 vagrant 命令生成：

```bash
vagrant init ubuntu/trusty64
vagrant up 
```
`ubuntu/trusty64` 是在 Vagrant 官网搜索到的虚拟机的镜像：
[https://app.vagrantup.com/boxes/search](https://app.vagrantup.com/boxes/search)：
![image.png](/assets/images/292372-7eee3c4260dd4feb.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

`vagrant init` 会在本地生成一个 Vagrantfile 文件。接着执行 `vagrant up` 时，Vagrant 读取当前目录下的 Vagrantfile 文件。然后会检查本地缓存是有 ubuntu/trusty64 镜像，如果没有则从 Vagrant 网站下载。

最终，你就可以得到一个装有 ubuntu 的虚拟机了。

接下来介绍 Vagrantfile。生成的 Vagrantfile 内容如下：

```ruby
# -*- mode: ruby -*-
# vi: set ft=ruby :
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
end
```
如果想自定义宿主机与虚拟机的网络、虚拟机的内存及 CPU 个数，Vagrantfile 可以修改成：

```ruby
# -*- mode: ruby -*-
# vi: set ft=ruby :
Vagrant.configure("2") do |config|
  config.vm.define "local-env-1" do |machine|
    machine.vm.box = "ubuntu/trusty64"
    machine.vm.hostname = "local-env-1"
    machine.vm.network "private_network", ip: "192.168.33.11"
    machine.vm.provider "virtualbox" do |node|
        node.name = "local-env-1"
        node.memory = 2048
        node.cpus = 2
    end
   end
end
```

现实中，往往还会需要同时虚拟化出多台机器，以测试分布式。Vagrant 也是支持的，只要将以上单台的配置复制出并修改：

```ruby
# -*- mode: ruby -*-
# vi: set ft=ruby :
Vagrant.configure("2") do |config|
  machine_box = "ubuntu/trusty64"

  config.vm.define "local-env-1" do |machine|
    machine.vm.box = machine_box
    machine.vm.hostname = "local-env-1"
    machine.vm.network "private_network", ip: "192.168.33.11"
    machine.vm.provider "virtualbox" do |node|
        node.name = "local-env-1"
        node.memory = 2048
        node.cpus = 2
    end
   end

   config.vm.define "local-env-2" do |machine|
    machine.vm.box = machine_box
    machine.vm.hostname = "local-env-2"
    machine.vm.network "private_network", ip: "192.168.33.12"
    machine.vm.network "forwarded_port", guest: 26379, host: 26380
    machine.vm.provider "virtualbox" do |node|
        node.name = "local-env-2"
        node.memory = 2048
        node.cpus = 2
    end
   end
end
```
在 `local-env-2` 机器中，我们设置机器的 IP，内存大小，CPU 个数，与宿主机器端口的映射。

Vagrantfile 使用的是 Ruby 语言写的。但是写 Vagrantfile 基本不需要 Ruby 知识。不懂的地方谷歌查一下就可以解决。

另外，如果你真实环境的机器的操作系统比较特殊，这种情况下你就需要制作一个自定义的镜像了。这不在本文讨论范围。

Vagrant 常用命令有：

* vagrant up：启动虚拟机。
* vagrant destroy：销毁虚拟机。
* vagrant status：查看当前虚拟机的状态。
* vagrant reload：修改 Vagrantfile 后重新启动虚拟机。
* vagrant restart：重启虚拟机。 
* vagrant box list：列出当前机器已经缓存了的镜像。

最后需要提醒的是：目前 Vagrant 只能适配部分 VirtualBox 版本：4.0.x, 4.1.x, 4.2.x, 4.3.x, 5.0.x, 5.1.x, 5.2.x, and 6.0.x。建议整个开发团队统一一个版本。


### 3. Ansible 的安装
Ansible 的安装根据你的开发机的操作系统分成两种情况：

1. 类 Linux 系统
1. Windows 系统

#### 类 Linux 系统下安装 Ansible
如果你的开发机是一台 Linux 或 Mac 电脑，那么恭喜。你可以直接在开发机上安装并使用 Ansible。

Ansible 是使用 Python 开发的。所以，开发机上必须安装 Python。Python 版本必须在 2.7 以上。P.S. 在命令行中输入 `python --version` 可了解当前版本。

接着安装 Ansible：

```bash
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
sudo python get-pip.py
sudo pip install --trusted-host mirrors.aliyun.com \
 --index-url=  http://mirrors.aliyun.com/pypi/simple/  ansible==2.7.1
```
为安装指定版本的 Ansible，我们决定通过 pip 安装 Ansible。这样就可以保持生产环境与实验环境的 Ansible 的版本一致。

#### Windows 系统下如何使用 Ansible
如果开发机是 Windows 机器，那么，笔者建议你放弃安装 Ansible。笔者尝试了 N 种在 Windows 上安装 Ansible 的办法，都以失败告终。

但是，如果不使用图形界面的方式编辑 Ansible 脚本。我们生产力会受到影响。我们不可能在开发机编辑 Ansible 脚本，然后，再手工将脚本上传到测试机器，最后在测试机器上执行 ansible-playbook 命令进行调试。

这个生产力问题，我们后文会解决。

### 4. 文本编辑器准备
因为 Ansible 脚本的开发需要同时在多个文件夹及文件之间进行来回切换，所以文本编辑器至少需要以下3个基本功能：
1. 文件夹的树状视图。
2. 快速搜索文件的。
3. 语法高度。

笔者强烈推荐使用 VS Code，效果如下图：
![image.png](/assets/images/292372-9dd8f7241845c8a8.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

了解 Java 开发的同学都知道。IDEA 和 Eclipse 都非常强大。能做到变量定义快速跳转、重构、自动补全等等。但是对于 Ansible 脚本开发，目前没有哪个编辑器有这些功能（反正笔者没有找到）。

所以，笔者常常需要将屏幕分成多个块，以实现多个文件之间的对比，拷贝。VS Code 有分屏功能：

![image.png](/assets/images/292372-db1ae660d02f1d43.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

另，Vagrantfile 是基于 Ruby 语言的。所以编辑 Vagrantfile 时，注意将文本语法高亮设置为 Ruby。在 VS Code 的右下角可以轻松设置：
![image.png](/assets/images/292372-4732b45d0b27db1f.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

#### 使用 SFTP 扩展解决 Windows 下的生产力问题
笔者想到一个办法提升开发 Ansible 脚本的效率：那就是我们在本地编辑，然后内容自动同步到测试机器上。接着，我们就可以在测试机器上执行 `ansible-playbook` 命令。

推荐 VS Code 编辑器有一个原因是它的扩展非常丰富。VS Code SFTP 扩展就可以实现我们的需求，如下图：

![](/assets/images/292372-20cd53069aa3a4b7.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

安装扩展后，根据VS Code SFTP 扩展的使用说明配置即可使用。

### 后记
在考虑企业效能提升时，也需要考虑开发人员在开发环境搭建方面的耗时。所以，以上所说的也应该做成自动化。当做到自动初始化开发环境后，你会发现它还会带来另一个好处：统一开发环境。

相信不少人觉得统一开发环境没有必要。笔者觉得有必要，原因如下：
1. 从根本上避免了由于开发环境不同引起的没有必要沟通效率损耗
2. 统一了所有的基本软件的版本（比如 Ansible 的版本）。有没有想过，某个同学使用了在本地安装 Ansible 的最新版本，谁知道生产环境使用的却是老版本的 Ansible。进而导致这们同学写的 Ansible 在生产环境下无法使用。

### 附录
* VS Code：[https://code.visualstudio.com/](https://code.visualstudio.com/)
* Vagrant：[https://www.vagrantup.com/](https://www.vagrantup.com/)
* VirtualBox：[https://www.virtualbox.org/](https://www.virtualbox.org/)
* Vagrant 支持的 VirtualBox 的版本：[https://www.vagrantup.com/docs/virtualbox/](https://www.vagrantup.com/docs/virtualbox/)
