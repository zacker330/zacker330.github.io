---
layout: post
title: "我是如何将同事的代码改成DDD风格的"
Description: "一次亲自代码教学"
date: 2024-02-26
tags: [DDD,领域驱动设计]
---
DDD是领域驱动设计的简写。前段时间听群友说行业里少有DDD的代码案例，进而对DDD没有一个感性的认识。我想这是行业里普遍存在的现象吧。所以，我就有了写此文的想法。

本文开篇介绍了行业里比较普遍的代码风格，接着，我采用DDD风格对其进行修改。

我无意说服读者要按照我认为的DDD的风格来写代码，只是想告诉大家，这个世界上，还存在另一种代码风格。

如果各位觉得这样的风格好，可以尝试一下。非常欢迎大家反馈，平时太少人和我交流这些了。

文章标题说的是“同事的代码”，其实只是为了让此文更具传播，没别的意思。

如果你觉得此文对你有帮助，麻烦转发。干货好文不易。谢谢。

本文虽是以Java语言为案例演示，也希望对其它语言的读者朋友有帮助。

# 行业里普遍的代码风格，简称A风格

代码结构如下：
```
├── domain 
    domain模块被同事认为是用于存放专门和DB打交道的类的地方
	- src/main/java/com/xx/domain/account/repository/AbcLoginInfoRepository.java
	- src/main/java/com/xx/domain/account/AbcLoginInfo.java
├── repository-impl
	-  包路径太长省略/AbcLoginInfoRepositoryImlp.java
├── server
	 - src/main/java/com/xx/server/login/LoginService.java
	 - src/main/java/com/xx/server/login/LoginController.java
	 - src/main/java/com/xx/server/login/AuthCodeVo.java
	 - src/main/java/com/xx/server/login/UserInfoVo.java
	 - src/main/java/com/xx/config/AbcWebMvcConfigurer.java
```

## Server模块
A风格下，整个业务系统的业务逻辑都在此模块中。

LoginController.java 实现http服务：
```java
  
@Controller  
@RequestMapping  
public class LoginController {  
  
    @Autowired  
    LoginService loginService;  
	// 省略一些不重要的代码
  
    @GetMapping(value = "/login")  
    @ResponseBody  
    public UserInfoVo login(String code) throws IOException {  
        UserInfoVo userInfoVo = loginService.login(code, httpServletResponse);  
        httpServletResponse.sendRedirect("/");  
        return userInfoVo;  
    }  
  
    @GetMapping(value = "/logout")  
    @ResponseBody  
    public boolean logout() {  
        return loginService.logout(httpServletRequest,httpServletResponse);  
    }  
}
```
UserInfoVo.java是返回给前端的用户信息的结构体：
```java
  
public class UserInfoVo {  
    private String id;  
    private String userType;  
	// 省略一些其它字段
	// 省略一些getter setter方法
}
```

AuthCodeVo.java是用于存储一些认证过程中的数据的结构体
```java
public class AuthCodeVo {  
    private String token;  
    private Integer expiresIn;  
	// 省略一些getter setter方法
}
```

A风格的特点是：除了VO，行业里，还有各种O，如PO、DTO、DO。

刚入行的小伙伴很难分清各种O，所以，只有跟着前辈的老代码依葫芦画瓢。进而导致大家对于Java代码的印象：不就是各种O之间的转换嘛。

这里并不是说DDD风格下的代码没有O。在DDD风格下，O本身是有业务逻辑方法的，并不只是一堆字段、getter和setter方法。

AbcWebMvcConfigurer.java这个类用于实现对所有的请求的拦截，以实现统一认证：
```java
  
@Configuration  
public class AbcWebMvcConfigurer implements WebMvcConfigurer {  
  
    @Autowired  
    LoginService loginService;  
  
    @Override  
    public void addInterceptors(InterceptorRegistry registry) {  
        registry.addInterceptor(new UserAuthInterceptorRegistry())  
        // 省略代码
    }  
  
    class UserAuthInterceptorRegistry implements HandlerInterceptor {  
        @Override  
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)  throws Exception {  
            if (loginService.isLoginSuccess(request)) {  
                return true;  
            }  
            response.sendRedirect("登录页面的url");  
            return false;  
        }  
    }  
}
```
AbcLoginInfo.java，AbcLoginInfoRepository.java，AbcLoginInfoRepositoryImlp.java 三个文件实现了登录信息的存储。其中AbcLoginInfo.java只是用户的信息及getter和setter方法，典型的贫血型模型。AbcLoginInfoRepository是AbcLoginInfo对象的持久化接口，而AbcLoginInfoRepositoryImlp是该接口的实现。

## 登录逻辑LoginService
这个就是登录服务直接实现逻辑所在。源代码将近200行代码
```java
  
@Service  
public class LoginService {  
	// 省略一些不重要的代码
    public UserInfoVo login(String code, HttpServletResponse response) {  
        AuthCodeVo authCodeVo = authCode(code);  
		// 省略部分代码
        UserInfoVo userInfoVo = getUserInfo(authCodeVo.getAccessToken(), authCodeVo.getExpiresIn());  
        // 省略部分代码
        LoginInfo loginInfo =loginInfoRepository.findByUid(userInfoVo.getUid());  
        if (loginInfo == null) {  
            loginInfo = new LoginInfo();  
        }  
        setLoginInfo(loginInfo, authCodeVo, userInfoVo);  
        loginInfoRepository.save(loginInfo);  
        addLoginCookie(loginInfo, response);  
        return userInfoVo;  
    }  
  
    private void addLoginCookie(LoginInfo loginInfo, HttpServletResponse response) {  
        Cookie tokenCookie = new Cookie(TOKEN_COOKIE, loginInfo.getAccessToken());  
        response.addCookie(tokenCookie);  
    }  
  
    public boolean isLoginSuccess(HttpServletRequest request) {  
        Cookie[] cookies = request.getCookies();  
        if (cookies == null) {  
            return false;  
        }  
        String token = null;  
        String uid = null;  
        // 此处省略代码，即从cookies中取出token和uid将设置到变量中。  
        LoginInfo loginInfo = loginInfoRepository.findByUid(uid);  
		// 此处对acessToken和过期时间进行校验
        if (token.equals(loginInfo.getAccessToken())  
                && new Date().compareTo(loginInfo.getExpiresDate()) < 0) {  
            return true;  
        }  
        return false;  
    }  
  
    public boolean logout(HttpServletRequest request, HttpServletResponse response) {  
        Cookie[] cookies = request.getCookies();  
        // 对cookie进行过期处理
        return true;  
    }  

    private LoginInfo setLoginInfo(LoginInfo loginInfo,  
                                         AuthCodeVo authCodeVo,  
                                         UserInfoVo userInfoVo) {  
  
        long nowTime = System.currentTimeMillis();  
        // 根据过期时长计算过期时间，并设置到LoginInfo中
        Date expiresDate = new Date(nowTime + authCodeVo.getExpiresIn() * 1000);  
		// 此处省略一些拿authCodeVo和userInfoVo中的信息set到loginInfo的代码
        return loginInfo;  
    }  
  
    public AuthCodeVo authCode(String code) {  
        Map<String, String> params = new HashMap<>();  
	    // 省略params参数的组装的代码
	    // 请求access token的地址，并拿到AuthCodeVo结构体的内容
        Map<String, Object> resultMap =  restTemplate.postForObject(ACCESS_TOKEN_URL, null, Map.class, params);  
        AuthCodeVo authCodeVo = new AuthCodeVo();  
        // 将resultMap中的值set到authCodeVo中
        return authCodeVo;  
    }  
  
  
    public UserInfoVo getUserInfo(String accessToken, Integer expiresIn) {  
        Map<String, Object> params = new HashMap<>();  
		// 省略params参数的组装的代码
		// 请求用户的信息的地址，并拿到用户信息。注意这里直接使用restTemplate这个技术实现。
        Map<String, Object> resultMap = restTemplate.getForObject(PROFILE_URL, Map.class, params);  
        UserInfoVo userInfoVo = new UserInfoVo();  
        // 将resultMap中的值set到userInfoVo中
        return userInfoVo;  
    }  
  
}
```

## A风格小结
小结一下A风格的代码：
1. 登录的主逻辑放在LoginService中；
2. LoginService即处理http请求技术逻辑（cookie的操作），也处理业务逻辑（登录信息的持久化、登录判断、token过期时间设置）；
3. LoginService存放在Server模块；
4. 所有的实体、各种O中，只有字段，getter和setter方法。这导致lombok这样的代码生成库大量被使用，因为A风格觉得为每个字段写getter和setter方法是必须，但是又是浪费时间的事情。

我们暂不讨论A风格的问题，接着看DDD风格的代码。

# DDD风格的代码，简称D风格
代码仓库结构：
```shell
├── domain
	- domain是用于存放整个业务系统的核心逻辑
├── abc-o2-auth
	- 存放所有abc-o2的相关逻辑，下文详细介绍
├── server
	 - src/main/java/com/xx/server/login/LoginController.java
	 - src/main/java/com/xx/config/AbcWebMvcConfigurer.java
├── repository-impl
	-  包路径太长省略/AccountRepositoryImpl.java
├── spring-ioc-impl
	- spring的IoC的实现，D风格下，IoC的实现也应该是可以被低成本地替换的
├── tech-lib
	- 公共技术逻辑的接口
├── tech-lib-impl
    - 公共技术逻辑的接口的实现
```

### abc-o2-auth模块
我们所有o2-auth的所有的逻辑放在这个新的模块中。考虑到将来可能需要实现新的认证逻辑。以下是该模块的Java代码的结构：
```shell
./abc-o2-auth/src/main/java/com/xxx/domain/o2
├── AccessToken.java
├── AccessTokenFetcher.java
├── AccessTokenFetcherImpl.java
├── Account.java
├── AccountProfile.java
├── AccountProfileFetcher.java
├── AccountProfileFetcherImpl.java
├── AuthConfig.java
└── repository
   └── AccountRepository.java
```

## 登录逻辑Account
Account.java是整个o2-auth的认证方式的核心逻辑。源代码将近330行。

虽然它是一个实体，但它不是整个业务系统的核心逻辑，所以，没有被放到整个业务系统的domain模块中。

Account类中所有的技术逻辑都被抽象成接口。

公共的技术接口，比如Json数据的操作接口json-util，我们统一放在tech-lib模块中。公共的技术接口的实现，目前统一放在tech-lib-impl中。

当然，也可以以更小粒度的模块来实现解耦，比如创建一个json-util-jackson-impl模块来实现json-util接口。

P.S. 为什么不直接使用Jackson呢？你想想，当发生像Fastjson那样的安全事故时，你该如何快速的更换json的实现？如果按照D风格，是不是就很容易更换了。

当Account中的逻辑被真正运行时，需要用到这些技术接口的具体实现时，就从`InstanceFactory`实例工厂类的`getInstance`静态方法获取。InstanceFactory是什么，我们下面再说。

当前，你只需要知道，通过InstanceFactory的getInstance静态方法可以拿到接口的实现实例就可以了。

采用D风格，在写业务逻辑时，就不需要关心技术逻辑的实现了。这样就能很好的解决“无法写单元测试”的问题。

```java
@Entity  
@Table(name = "abc_o2_accounts")
public class Account {
	// 省略所有的字段，getter和setter代码

	public static Optional<Account> login(String code) {  
		// AccessTokenFetcher是accessToken的拉取接口
		// 因为accessToken需要请求第三方系统
	    AccessTokenFetcher accessTokenFetcher = InstanceFactory.getInstance(AccessTokenFetcher.class);  
	    Optional<AccessToken> accessTokenOptional = accessTokenFetcher.auth(code);  
	    if (accessTokenOptional.isEmpty()) {  
	        throw new LoginBizException("401");  
	    }  
		// AccountProfileFetcher是accountProfile的拉取接口
	    AccountProfileFetcher accountProfileFetcher = InstanceFactory.getInstance(AccountProfileFetcher.class);  
	    Optional<AccountProfile> accountProfileOptional = accountProfileFetcher.fetch(accessTokenOptional.get().getAccessToken(), accessTokenOptional.get().getExpiresIn());  
	    if (accountProfileOptional.isEmpty()) {  
	        throw new LoginBizException("401");  
	    }  
		// 登录成功后，将登录信息持久化
	    AccountRepository accountRepository = InstanceFactory.getInstance(AccountRepository.class);  
	    Optional<Account> accountOptional = accountRepository.findByUid(accountProfileOptional.get().getUid());  
	    if (accountOptional.isEmpty()) {  
	        Account account = buildBy(accessTokenOptional.get(),accountProfileOptional.get());  
	        account.save();  
	        return Optional.of(account);  
	    } else {  
	        Account account = accountOptional.get();  
	        account.update(accessTokenOptional.get(), accountProfileOptional.get());  
	        return Optional.of(account);  
	    }  
	}  
	// 登录的url是从配置中获取的。至于是从数据库，还是Etcd配置中心获取，登录核心逻辑并不关心，
	// 而由AuthConfig的实现决定。这样，将来我们想换配置中心，成本就很低了。
	public static String loginUrl(){  
	    AuthConfig authConfig = InstanceFactory.getInstance(AuthConfig.class);  
	    return authConfig.getLoginUrlWithRedirect();  
	}  
	// 再次review此代码时，发现这个方法叫isLoggedIn更能体现方法内的逻辑。
	public static boolean isLoginSuccess(String token, String uid) {  
	    AccountRepository accountRepository = InstanceFactory.getInstance(AccountRepository.class);  
	    Optional<Account> accountOptional = accountRepository.findByUid(uid);  
	    if (accountOptional.isEmpty()) {  
	        return false;  
	    }  
	    return StringUtils.equals(token, accountOptional.get().getAccessToken()) && new Date().before(accountOptional.get().getExpiresDate());  
	}  
	  
	public AccountProfile getProfile() {  
	    AccountProfile result = new AccountProfile();  
	    // 将Account中的信息设置到AccountProfile中，因为前端只需要Account中的部分信息
	    return result;  
	}  
	  
	private void update(AccessToken accessToken, AccountProfile accountProfile) {  
	    Date expiresDate = calExpiredDate(accessToken.getExpiresIn());  
		// 省略部分更新Account对象的代码。
		// save方法即保存此对象
	    save();  
	}  
	
	// 计算出最新的过期时间
	private static Date calExpiredDate(int expiresIn) {  
	    long nowTime = System.currentTimeMillis();  
	    return new Date(nowTime + expiresIn * 1000L);  
	}  
	// D风格的代码的一大特点：行为跟着数据走。
	// 因为数据结构在Account类中，所以数据的持久化方法save也应该放在Account类中。
	// 虽然底层实现都是accountRepository.save(xxx)
	// A风格下，持久化方法放在LoginService中，而数据结构放在另一个类中。
	private void save() {  
	    AccountRepository accountRepository = InstanceFactory.getInstance(AccountRepository.class);  
	    accountRepository.save(this);  
	}  
	  
	private static Account buildBy(AccessToken accessToken, AccountProfile accountProfile) {  
	    Account result = new Account();  
	    // calExpiredDate方法的实现放在AccessToken类中更合理，我们只需要调用accessToken。getExpiresDate()。
	    // 因为根据过期时长计算过期日期的逻辑应该属于AccessToken，而不属于Account
	    Date expiresDate = calExpiredDate(accessToken.getExpiresIn());  
		// 省略根据accessToken和accountProfile构建一个Account实例
	    return result;  
	}
}
```

## Server模块
LoginController.java 只负责调用Account实体的的login方法和操作Cookie这类、HTTP服务相关的技术逻辑。

```java
@Controller  
@RequestMapping  
public class LoginController {  

    @GetMapping(value = "/login")  
    @ResponseBody  
    public AccountProfile login(String code, HttpServletResponse response) throws IOException {  
        Optional<Account> accountOptional = Account.login(code);  
        if (accountOptional.isPresent()) {
            responseLoginCookie(accountOptional.get().getAccessToken(), accountOptional.get().getUid(), response);  
            response.sendRedirect("/");  
            return accountOptional.get().getProfile();  
        } 
        // 此处省略部分代码
    }  
  
    @GetMapping(value = "/logout")  
    @ResponseBody  
    public boolean logout(HttpServletRequest request, HttpServletResponse response) {  
        Cookie[] cookies = request.getCookies();  
        // 遍历Cookie，并设置cookie过期
        return true;  
    }  
    private void responseLoginCookie(String accessToken, String uid, HttpServletResponse response) {  
	    // 登录成功，设置cookie
    }
}
```


以下是D风格AbcWebMvcConfigurer的代码：
```java
@Configuration  
public class AbcWebMvcConfigurer implements WebMvcConfigurer {  

    @Override  
    public void addInterceptors(InterceptorRegistry registry) {  
        registry.addInterceptor(new UserAuthInterceptorRegistry())  
               // 部分代码省略
    }  
  
    class UserAuthInterceptorRegistry implements HandlerInterceptor {  
        @Override  
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)  
                throws Exception {  
  
            Cookie[] cookies = request.getCookies();  
            //省略代码
            String token = null;  
            String uid = null;  
            // 从Cookie中取值，并设置到token和uid变量中 
            if (Account.isLoginSuccess(token, uid)) {  
                return true;  
            }  
            response.sendRedirect(Account.loginUrl());  
            return false;  
        }  
    }  
}
```
D风格的AbcWebMvcConfigurer.java 与A风格的区别是：
1. 关于Cookie的操作，A风格放在LoginService类中，而D风格放在AbcWebMvcConfigurer。因为D风格认为Cookie的操作属于HTTP服务行为，不属于核心业务。另，UserAuthInterceptorRegistry，可以考虑移到abc-o2-auth模块中；
2. 关于是否已经登录的判断逻辑，A风格放在LoginService类中，而D风格放在Account类中。因为是否已经登录的判断逻辑，D风格认为属于abc-o2-auth模块的核心逻辑，而不属于server模块。
3. 
## InstanceFactory实例工厂的魔法
在D风格中会大量使用InstanceFactory静态类，它使我们能做到与IoC的实现的解耦。

InstanceFactory代码来自https://github.com/dayatang/dddlib 。

DDDLib是我的恩师所创建。我在十年前跟他学习到的DDD。大家可以start并从该仓库学习到DDD的一些代码样例。

## D风格小结
小结一下D风格：
1. 登录的主逻辑放在abc-o2-auth中模块的Account实体中。D风格中的实体类包含各种业务方法，是充血型模型。每一类的设计都有业务含义的，不仅仅只是一个数据结构；
2. 在写代码时，时刻在思考：这是技术逻辑，还是业务逻辑？这是核心业务逻辑，还是非核心逻辑。

# 篇外话
5年前，我还是一名Java程序员的时候，我一直按照DDD风格要求自己。

但是，软件行业的绝大数公司才不管你写的代码好，还是坏。更不会管这代码在几年后还能否被维护，维护成本是多少。

这是DDD风格不流行的原因之一。另一个原因就是：根本没有几个人知道这样写代码。所以，本文算是一篇科普文。

(全文完)



