---
layout: post
title: "性别字段存储时应该使用的字符串，还是数字？"
Description: "软件设计过程需要考虑的问题"
date: 2016-04-15
tags: [软件设计, 面向对象分析与设计]
comments: true
share: true
---

在我和同事结对时，发现数据库中多个表中，分别都会有gender这个字段。比如A表，B表，C表。这三个表中，gender字段都是int类型。但是同一性别，在各个表中的值是不同的。比如A表中，1代表男，在B表中却代表了女，在C表中代表未知。

我突然意识到这背后存在更大的问题。从而引发我对“性别字段存储时应该使用的字符串，还是数字？”这个问题思考。也许已经有前辈思考过这个问题并写在某本书的某页，如果有，请告知。谢谢。

 

#### 0代表女，1代表男

首先，你可能会问，对于这样的问题还用想吗？不是都使用数字吗？0代表女，1代表男。

其实，淘宝就是这么做的：

![性别字段存储时应该使用的字符串，还是数字？01](/assets/images/2016-4-01.png)

html代码是这样的：


![性别字段存储时应该使用的字符串，还是数字？02](/assets/images/2016-4-02.png)

 

这时，我会问如果这个用户没有填写性别信息呢？那你可能将原来的实现改成0代表空，1代表男，2代表女。我提醒你，当你开发的是一个大型网站时，你要将原来的“0代表女”改成“0代表空”，不会那么容易。历史数据要处理。你还需要修改所有用到0，1的代码，即使你使用的是常量代替而不是魔法数字，也不会容易到哪里去。

 

#### 有经验的程序员

是的，有经验的程序员写代码时，一开始就会想到这个问题，所以一开始就设计“0代表空，1代表男，2代表女”。从前端到后端都统一使用数字。比如：

    class User{
    
       final static int GENDER_NULL = 0
    
       final static int GENDER_MALE = 1
    
       final static int GENDER_FEMALE = 2
    
       int gender
    
    }
    
    class UserController{
    	void saveUser(int gender)
    }
    <div>gender: #if($user.gender == 1)男#elseif($user.gender == 2)女 blabla….</div>

当然前端这样写有些难看，那我们使用宏来代替，比如`<div>#displayGender($user.gender)</div>`。这里我想留一个疑问：如果想国际化呢？你的displayGender怎么实现的？

#### 实习生来了

某天公司招来了一个实习生要实现一个活动申请表页面。领导觉得这个功能应该不难，所以就将这个任务分配给他。他为了表现自己，哐啷哐啷很快就写完了，还得到了领导的表扬。但实习生根本没有参照前面有经验的程序员的写法（有时不是他的问题，可能是没有人告诉他需要参照某个功能的写法来实现）。有意识一些的实习生还知道将gender的值写成常量，没有意识的，可能你只有去到前端页面看源码才能知道0, 1分别代表什么。

     class ActivityApply{
         final static int GENDER_MALE = 0
         final static int GENDER_FEMALE = 1
         int gender
     }

如果他没有参照前面有经验程序员的写法，我不确定他是否会重用那个前端宏。所以，讲到这里，你应该明白，有时你设计好的“重用”，并不一定会被重用。为什么呢？:P

这里不是故意贬低所有实习生，只是情节需要。

 

#### 0和1到底放在哪里？

也许你意识到了（通常不包括架构师），我们需要统一将gender常量的值放在某个地方。那位有经验的程序员将其放到了User类中。这样，所有使用的gender的地方都应该变成User.GENDER_MALE blabla，如 activityApply.gender = User.GENDER_MALE。

也许有人想到了，建立一个Gender的类，或者枚举不就行了。比如：

    public enum Gender {
    	UNKNOWN(0), MALE(1), FEMALE(2);
    	private final int value;
    	Gender(int value) {
       	 	this.value = value;
    	}
    	public int getValue() {
        	return value;
    	}
    }

然后使用的时候就变成了：

```
user.gender = Gender.UNKNOWN
activityApply.gender = Gender.MALE
```


问题是不是解决了？就算是实习生来了，也能保证大家的gender的值是一致的。前提是他要知道关于gender的值我们取的都Gender枚举里的值。不论是入职时老员工跟他说，还是他自己发现的。

问题解决了？并没有。当前端发来了个gender参数时，我们如何校验这个参数呢？比如前文提到的淘宝表单里，我们看到：

![性别字段存储时应该使用的字符串，还是数字？03](/assets/images/2016-4-03.png)


`_fm._0.g`就是gender参数。

校验时，我们的controller里，有人可能会写成：

    if(gender == 2){
    	user.gender = Gender.FEMALE 
    }else if(gender == 1){ 
    	user.gender = Gender.MALE
    }else { 
        user.gender = Gender.UNKNOWN
    }
高明一些人的会在gender枚举中加入一个静态方法： 

    public static Gender genderOf(int aGenderValue){
        for (Gender gender : Gender.values()) {
            if (gender.value == aGenderValue) {
                return gender;
            }
        }
        return Gender.UNKNOWN;
    }
然后校验时，

```
user.gender = Gender.genderOf(genderParameter).value
```


Gender以数字值存到数据库中，真是最好的方法？

以上，我们的思路看似没有问题。只是，我们没有看到其中的假设。以上思路的假设是：

代码使用者知道有Gender这个枚举类，然后再使用Gender枚举赋值给User.gender字段。

对于数据库中的0、1、2，只有我们的程序进行解释，其它程序里可能使用的是10、11、12

因为是性别可能的值不多，所以，前端代码写成if elseif elseif else，没所谓。但要知道，我们服务不仅仅输出html，还会输出json等其它格式。当然，你可以将这部分逻辑封装起来，这样别人就可以重用了。但是你这里又假设了“TA人知道你的重用”存在，然后正确使用。

首先，你可能认为这些不是问题。我猜想你给出的理由是：

关于1，一进入公司，我们就培训他，gender就使用这个类。或者写一个开发文档。

关于2，我们不需要其它程序解释这个数据库里的值，其他程序都是通过调用我们程序的。

关于3，性别来来回回就那几个，不会扩展到哪里去。

 

问题不在于Gender而在于别处

我觉得你这些理由是有道理的，但是不是最好的。

关于1：我们的代码应该设计得尽量可靠，可靠到连代码使用者都不会使用错。而User、ActivityApply的gender是int和String这类基础数据类型，不管你培训还是写开发文档，都会给代码使用者有写错的机会。更好的办法是什么，使用枚举类型。这样就可以由编译器来给我们检查代码使用者有没有调用错了。而且，这也解放了代码使用者的大脑。当你在写user.setGender(value)时，如果setGender接收的是一个枚举，IDE自然会提示你，gender有哪些值。

这很像地铁上的门写着“请勿倚靠”，你就认为真没有人倚靠？在合理成本内，地铁门应该设计成就算10个200斤的人倚靠都不怕。

![性别字段存储时应该使用的字符串，还是数字？04](/assets/images/2016-4-04.png)


这时，你会提问，如果User gender使用的枚举，那么我们怎么持久化到数据库中呢？如果使用ORM框架，它会给你解决。如果不使用ORM，也可以有技巧解决的。这个问题留你自己思考。但是，有一点需要提下，你的业务代码不应该和数据库这样具体技术耦合！可以看看我写的《耦合的本质》

关于2：如果养成了所有有限值内的字段都使用数字来存到数据库中的习惯，问题就没有使用gender这么简单了。在未来的几年，你的代码会充满魔法数字，最终架构腐化。

关于3：和2是同一个问题。

 

小结

回答本文标题的问题：出现像gender这样有限值的字段，我会优先使用枚举包装起来，持久化时，我会优先使用人看得懂的字符串。

深度一些的思考：

* 本文的标题是个问题吗？
* 设计模式能解决本文标题的问题吗？呵呵
* 为什么人们趋向于使用数字而不是字符串？
* 为什么架构会腐化？
* 架构师不写代码？