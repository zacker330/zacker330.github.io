---
layout: post
title: "你们的 save 方法是写在实体上，还是写 Dao 上？"
Description: ""
date: 2019-07-31
comments: true
share: true
---

> 注：Dao 在不同语言中的叫法可能不一样。Dao 可以理解为对数据进行持久化的具体实现。


关于实体的保存，笔者知道行业内有两种方式：
1. dogDao.save(dog);
2. dog.save();

相信不少同学，现实中，通常使用第一种，很少见到第二种写法。

为了让大家站在同一个讨论上下文，笔者决定贴出更详细的代码。

注：以下代码会省略很多本文不相关的代码，比如数据校验。读者朋友不必太纠结。

#### 第一种写法：save 方法写在 Dao 上
```java
Dog dog = new Dog()
dog.setName('didi');
dog.setColor('white');
dogDao.save(dog);
```

#### 第二种写法：save 方法写在实体上

```java
// DogService.java
Dog dog = new Dog()
dog.setName('didi');
dog.setColor('white');
dog.save();
```

这两种写法，有什么区别吗？事实上，从字面上看，没有什么区别。因为 Dog 类的 save() 方法是这样实现：

```java
// Dog.java
public void save(){
  dogDao.save(this);
}
```

但是从抽象的角度来看，就不一样了。


假如你的项目中存在这样的抽象：
![image.png](/assets/images/292372-a0fbd312da0a8264.png)

如果采用第一种写法，意味着，每多出多一种 Animal，我们就必须多写一套 Service。Service 中会很多这样的方法：

```java
// DogService.java
void save(Dog dog){
  dogDao.save(dog);
}

// FishService.java
void save(Fish fish){
  fishDao.save(fish);
}

// BirdService.java
void save(Bird bird){
  birdDao.save(bird);
}
```
相信大家对于以上代码并不陌生。

但是如果采用第二种方法就不一样了，不论 Animal 新增多少种子类，只需要一个 Service，并只需要一个方法：

```java
// AnimalService.java
void saveAnimal(Animal animal){
  animal.save();
}
```

相对第一种方法，第二种方法更内聚，更简洁。

### 如何更优雅将前端传过来的数据结构转成抽象类？
采用第一种方法，我们还必须在 Controller 上，类似于 Service 也要针对不同的子类写不同的方法。所以，会出现 N 个接口：

```java
// AnnimalController.java
@PostMapping("/dog")
public String saveDog(@RequestBody Dog dog){
  dogService.save(dog);
}

@PostMapping("/fish")
public String saveFish(@RequestBody Fish fish){
  fishService.save(fish);
}

@PostMapping("/bird")
public String saveBird(@RequestBody Bird bird){
  birdService.save(bird);
}
```
这不是我们想要的。我们更希望类似这样的：

```java
// AnnimalController.java
@PostMapping("/animal")
public String saveDog(@RequestBody Animal animal){
  animal.save();
}
```
也就是说，每次 Animal 新增子类，我都不用动 Controller 。但是 Controller 并不会自动将前端传入的 JSON 结构转换成 Animal 抽象类。

这个问题的关键点在于序列化过程，我们是否可以定制。换句个说法，就是定制 JSON 结构转成对象的过程，我们就可以将前端的 JSON 数据转成子类，再赋值给 Animal 抽象类了。

笔者使用的是 Spring Boot 的默认 JSON 序列化库，定制某个类的反序列化，只需要在该类上使用注解就可以，代码样例如下：

```java
@JsonDeserialize(using = AnimalDeSerializer.class)
public abstract class Animal{
}
```
而 AnimalDeSerializer 的实现如下：

```java
    public static class AnimalDeSerializer extends StdDeserializer<Animal> {
    @Override
    public Animal deserialize(JsonParser jsonParser, DeserializationContext deserializationContext) throws IOException, JsonProcessingException {
        TreeNode treeNode = jsonParser.getCodec().readTree(jsonParser);
        TreeNode animalTypeNode = treeNode.get("animalType");
        if(animalTypeNode == null){
            return Animal.emptyImplement();
        }
        String animalType = ((TextNode) animalTypeNode).asText();
        switch (animalType){
            case "dog": return JSON.parseObject(treeNode.toString(), Dog.class);
            case "fish": return JSON.parseObject(treeNode.toString(), Fish.class);
            ....
        }
    }
    }

```
前提是JSON数据中必须有能区分不同子类的字段，这样才可以使用。例如示例中，我们使用 `animalType` 来进行区分。

嗅觉灵敏的同学会觉得这个 `switch` 味道不好。但是如何重构呢？笔者常说：要学会使用枚举消除 switch。点到为止。懂的同学就就懂了。不懂的，就算是留给大家的思考题。

### 后记
现实中并不一定要完全按第一种写法或第二种写法，还要视具体情况而定。本文的主要目的是想让更多人知道，save 方法放哪里这个问题，还有另一种答案。

