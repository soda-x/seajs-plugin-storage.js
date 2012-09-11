# plugin-storage

还在纠结我们的站点费流量么?想支持combo服务? 还在纠结seajs不支持显示的版本管理么? 还在抓狂每次更新基础库js却要一一通知其他开发人员重新打包发布么? 

如果有任何以上一点，那救星就闪亮登场了 XD

- - - -

##### 插件特色功能

* 通过插件的方式让seajs支持了文件夹方式的版本管理（后续支持文件名形式）；
* 对js的存储（存于localStorage）可配置，支持存储js的单点更新（更新方式模拟manifest实现）；
* 插件内置combo支持，对combo请求亦可版本管理和获取后细粒度拆分存储。

插件github地址：<https://github.com/pigcan/seajs-plugin-storage.js>

----

##### 插件源来

如果大家还记得我发的年中总结，其中里面提及了我们存储方案上的设定。

回顾一下：

* cookie + localStorage
* applicationCache

基于时间原因，我们选择了后者的方案

再来说说方案2 - 因为要推倒一个方案的时候我们总需要很多理由嘛 XD

1. 含有manifest属性的当前请求页无论如何都会被缓存`（对于动态页而言很致命）`

2. 更新需要建立在manifest文件的更新，文件更新后是需要页面再次刷新的`（需要2次刷新才能获取新资源）`

3. 更新是全局性的，无法单独更新某个文件`（无法单点更新）`

4. 最有效的方式是让manifest文件找不到 可以大部分解决掉由于2)出现的问题

5. 对于链接的参数变化是敏感的，任何一个参数的修改都会被（master）重新缓存`（重复缓存含参页面）`

6. 所有自定义UI事件都发生在load事件执行完毕后 `（UI事件执行反馈结果太过延时）`



> 正因为applicationCache使用非常简便，所以在具体业务使用上可能会滥用，从目前http://m.taobao.com首页来看就是如此，缓存条目达到了60+条 ，缓存量达到近1MB ，这意味着什么呢？

**再来回顾下manifest具体的执行：**

首次访问含有manifest属性的站点的时候：

1. 首先进行的过程是如同没有manifest属性时候是一致的（文档与资源文件的下载）
2. 接下来会触发manifest清单所列文件的下载

这是两个同步的过程。

所以意味着：如果用户在进入淘宝首页时候，如果在资源并没有被完全下载完成的时候去点击了一个链接，那么manifest所列文件下载失败，再次进入首页的时候，资源还是重新开始下载，其实只要用户停留首页的时间并不能满足下载近1MB内容的时候，用户每次都必须去重新下载资源，所以流量是巨大的。

一般情况下我们都会设置 `http expire header` 以及 `max-age`  ，这会什么时候生效呢？

常见场景就是：浏览器回退。

但是很多细心的人会发现如果我首先进入A页面，然后通过A页面点击进入B页面，此时如果直接点击浏览器返回，那么A页面将瞬间出现在我们视野，此时不会有任何的请求产生。 但是此时 如果我在 B页面操作时间够久后，我们再点击可以发现A是会刷新的 ， 和点击刷新按钮刷新页面是相当的。 通过测试 如上方式 资源文件都会以 `max-age:0`的参数方式去请求资源，由于此时`http expire header`是生效的所以返回304.

**304是祸害**

为何这么说：

如下表格是不同手机网络下DNS查询时间，Conn网络连接三次握手时间，RTT网络延迟时间，还有Tran传输时间。以下分别对2G网络 、3G网络和wifi网络做的一次分析。

网络类型| DNS | Conn | RTT | Tran
------------ | ------------- | ------------
2G| 27% | 25%  | 25% | 27%
3G| 31% | 26%  | 33% | 10%
wifi| 33% | 17%  | 40% | 10%

所以更新一个含60条条目的applicationCache是一个非常可怕的事情。


> 我们需要约定applicationCache应该存一些基本永远不会改变的数据！！！

**现在碰到的资源打包的问题**

A同学引用了全局公用组件a，通过打包成一个js的方式发布上线，但是没过几天，B同学，由于项目需求，稍微更新了全局公共组件a， 这个时候存在的一个就在于B同学必须通知A同学重新进行打包再发布上线，如果涉及项目之多，这个工作量是相当之大的！又容易出错！怎么解决？

**js,css文件如何存储如何打包才高效？如何最小化请求？**

正因为这些个问题的出现才萌生了这个插件的由来，所以我们要有更好的存储管理方案，所以我们要有更好的管理机制！

** 所以plugin-storage的核心就是： **

* 高效管理资源文件版本
* 彻底磨灭二次访问的网络请求数（主要指 js 和 css 文件），消灭 304 所带来的各种开销（RTT, TCP Connection setup - 3way - handshake）
* 节省用户流量，提升用户体验

> 通俗意义上说，该插件想要达到的效果就是，在加载所需js的同时并予以存储，支持combo，并通过合理的方式进行版本的管理以及一对一的更新

---
##### 迎插件而来的新技术方案  loader + localStorage + cookie

目前我设想的方式为：

1. 没有与之相关的cookie记录 ，判断为用户首次访问：则接下来资源文件会直接输出到页面（google gmail小组测试得出的最佳实践），与此同时设置到本地存储，接下来loader会直接从本地存储里面加载。
 
2. 存在含有版本信息的cookie记录，提交服务器与之对比之后发现无改变，则输出页面本身，前端loader自动调用存储在localStorage的资源文件。
 

3. 存在含有版本信息的cookie记录，提交服务器与之对比之后发现无改变，但是用户清除了缓存，也就是本地已经不存在相关资源文件存储信息，但此时页面根据cookie记录的信息也已经下来了没有相关脚本的html页面。此时就需要异步有序加载资源文件。loader能保证所有的东西正常有序加载
 
 
4. 存在含有版本信息的cookie记录，提交服务器与之对比之后发现有改变，则接下来资源文件会直接输出到页面，与此同时设置到本地存储，server端会记录每个版本改动了什么js或者css，这边会有各个版本的匹配设置过程。
 
 
5. 在一切都顺利但是比较极端的情况是，本地存储空间耗尽，此时需要单独发送请求，请求相关资源文件，予以外链支持，这也由loader实现。  

这个方案的优点：
** 资源文件更新及时成本小，请求适量，通用性强大，可覆盖全网（只要用loader加载便可以通过该插件全面存储资源文件），非临界情况资源文件请求数为0  **

这个方案的缺点：
** 需要描述文件的支持（之后会详细描述该文件的价值），不支持资源文件的跨域（之后会兼容），不支持对主体文件的存储（比如插件本身，之后也会兼容，但这已经在seajs之外了，在这不做详细说明） **


---


##### 插件如何使用


《1》** 页面端调用 **

在页面端如下调用`seajs`
```js
<script src="http://path/??./libs/seajs/1.2.1/sea.js,./startup.js,./libs/seajs/1.2.0/plugin-base.js,./libs/store/0.1/store.js,./libs/seajs/1.2.0/plugin-storage.js,./index.js"></script>
```
须知：

`./startup.js` 为seajs配置文件，相关文件说明见注释
```js
  seajs.config({
    alias: {
      //本地存储封装接口 - 必须！
      'store' : 'store/0.1/store.js',
      //描述文件 - 必须！
      'manifest' : 'http://path/to/manifest.js'
    },
    preload: [    
      //预加载模块 - 必须！  
      'seajs/plugin-storage'   
    ]
  
  })
```
`./libs/seajs/1.2.1/plugin-base.js` 

seajs基础插件

`./libs/store/0.1/store.js` 

本地存储封装接口

可以使用同时符合pc和mobile的store封装： <https://github.com/seajs/modules/tree/gh-pages/store>

也可以使用我写的store封装，针对移动平台： <https://github.com/pigcan/store>

`./libs/seajs/1.2.1/plugin-storage.js`

主插件


`./index.js`

项目启动启动文件

** 《2》manifest设置（描述文件） **
```js
  ;define({
    //#为不需要版本服务但是需要更新   !为需要版本服务同时需要更新但是无需缓存
    "version" : "12" ,
    "combo" : true,
    "http://localhost/test/SEAJS/a/a.js":"0.2" ,
    "http://localhost/test/SEAJS/b/b.js":"0.2" ,
    "http://localhost/test/SEAJS/c/c.js":"0.2" ,
    "http://localhost/test/SEAJS/pigcan/pigcan2.js":"#2",
    "http://localhost/test/SEAJS/index.js":"" ,
    "http://localhost/test/SEAJS/libs/jquery/1.7.2/jquery-debug.js":"#123"
  })
```

`manifest.js` 是一个非常重要的文件，设计思想上主要参考了manifest，但是它非常非常的简单，它一共才三个可用参数

* _version_ --- 指明了app资源文件总的版本号，**资源文件的更新必须建立在version发生改变的基础上**
* _combo_ --- 指明了当前是否需要combo服务的支持， _true_ : 为支持  _false_ : 为不支持
* _entry_ --- 指明了资源文件的条目
    * 第一个字段写明了资源文件的地址，**注意资源文件无需写明文件夹版本**，
    * 第二个字段，书写文件的文件夹版本号，同时附加`# ` 和 `!`两个特殊符号， `#`为不需要版本服务但是我可以通过修改后续的字符来达到存储资源文件的更新； ` !`为需要版本服务同时需要通过版本号来更新但是它无需缓存

未来该js将自动化生成！ - 该工作徐宁同学风风火火进行中

######特别强调

**《3》seajs.use**
```js
  // Right !!!!!
  seajs.use('./a/a.js',function(a){
    // to do someting
  })
  
  // Wrong !!!!!
  seajs.use('./a/0.2/a.js',function(a){
    // to do someting
  })
```


> **注意！！！！！！**在seajs调用使用一个模块的时候，无需指明你需要哪个版本的模块，指明这个动作要体现在`manifest`上！

---

##### 插件设计原理


首先先来看seajs正常use一个模块其内部是如何运行的
```js
   seajs.use('./a',function(a){
     // to do something
   })
```

a.js:

```js
  /* a.js */
  define(function(require, exports, module) {
    var b = require(‘./b’)        
  })
```

1. 首先会从`seajs.config`中读取是否有需要预先加载`preload`的模块，存在则加载并执行，没有则正常执行流程
2. 接下来使用`resolve`方法，其实质将调用id2Uri方法解析'./a'的绝对路径，即在该过程中['./a'] ---> ['http://path/to/a.js']
3. 接下来将执行`Module._load(uris,callback)`,该方法主要会先判断那些资源文件还没有ready，如果全部资源文件都处于ready状态就执行callback()，在这其中还会做循环依赖的判断，以及对没有加载的js执行加载 ，经过该过程判断'http://path/to/a.js'并未被加载过
4. 创建模块a信息 `cachedModules('http://path/to/a.js') = new Module('http://path/to/a.js',1)` 
5. 加载模块a , `fetch('http://localhost/test/SEAJS/a.js',onFetched)`
   * 首先会根据请求的uri -> http://path/to/a.js 会调用 map 去做一次匹配，如果map中已经存在相关规则，那么替换uri为匹配规则后的uri
   * 加载完毕后执行define ，保存meta信息，主要获取deps,和factory，即得到a的依赖b，并保存a的factory
   * define执行完后 紧接着 触发onload ， onload事件执行中 得到 meta 信息缺失的 id 并加载b
   * ……之上过程再走一遍
4. 执行a.factory（compile过程，会逐个对所依赖的模块从内到外执行回调链）,得到a的module.exports 

> 推荐阅读：
> [seajs 1.2.0 中文注释版(玄寂)](https://github.com/seajs/seajs/issues/305) ,
> [seajs内部执行过程从seajs.use开始(玄寂)](https://github.com/seajs/seajs/issues/308) ,
> [模块状态(玉伯)](https://github.com/seajs/seajs/issues/303)



之上我大概说明了seajs在use过程中所走的流程主线，实际情况更加复杂，涉及兼容性涉及循环依赖等。 但是在插件开发中了解这些其实差不多了 。

**那plugin-storage到底如何工作的呢?**

* 为支持文件描述引入`manifest.js`: 该文件类似于在applicationCache中的manifest文件，但是此manifest并非彼manifest，但是有一点是相通的，他们都有严格的格式要求，尽量扁平化。在该插件中，manifest需要显示指明当前app的version，是否需要combo支持，以及一个个资源条目（链接以及版本），在版本处理上，考虑了灵活性加入了两个特殊符号，#和!，`#`为不需要版本服务但是我可以通过修改后续的字符来达到存储资源文件的更新； ` !`为需要版本服务同时需要通过版本号来更新但是它无需缓存它。
    * 进入应用，事先将会加载manifest文件，如果本地存储中不存在该文件，则认为首次进入站点，不遍历产生需更新列表，并将该文件存入manifest中，即为manifest本身（在fetch阶段会判断到底是否需要存储）
    * 页面再次刷新会重新请求manifest文件
    * 首先我会判断version是否修改，不修改程序就会认为此次访问不需要任何更新，所有文件全部从本地存储中读取；
    * 如果version前后发生了改变，则程序就会认为存储的资源文件发生更动，于是会通过比对存在本地的manifest文件和请求而来的manifest循环递归出哪些资源文件需求修正更新，并在接下来的fetch阶段直接从网络下载（单点更新原理来源于此）

* 为支持版本控制扩展 `Module._resolve()` ：重点代码
    * 修正refUri: Module._resolve = function(id, refUri) {return _resolve(id, getRealPath(refUri, storedManifest)) ，refUri为参考Uri（就像参照物，因为在seajs中允许在内部使用相对路径），因为我们加入了版本的概念所以在真实文件路径选择中其参照Uri会发生改变，举例：http://path/to/a/a.js 在manifest中我们使用的a.js版本为0.2，那么实际访问的a.js路径为http://path/to/a/0.2/a.js ,如果在a.js中存在依赖b.js，b的版本为0.1，且b.js的目录与目录a平行，即http://path/to/b/0.1/b.js,因为我们已经约定了在js文件中我们不使用具体的版本号，所以在a.js中b.js引用为 var b = require('../../b/b.js')
        * 在不修正refUri情况下，针对于b.js其refUri为http://path/to/a/a.js 则最终其访问的js将为 http://path/b/0.2/b.js
        * 修正refUri情况下，针对于b.js其refUri为http://path/to/a/0.2/a.js 则最终其访问的js将为 http://path/b/0.2/b.js

* 为支持对文件获取的控制扩展 `Module._fetch`: 该阶段主要针对js的获取阶段，对uri敏感，如果在js获取过程中，发现该uri条目已经存储在本地存储中了，并且并未出现在更新列表中，并且在版本控制字段中出现了 并未"!" 即并未指定其不需要存储，那么该js将直接从本地存储中获取反之都将发起网络请求获取。
    * 如果获取阶段，发现uri是一个combo请求类型，具体combo标记符可以由seajs.config中指定。如果是combo请求，那么将会根据manifest中的相关指定拆分combo请求，并且根据需要存储的js拆分成细粒度并存储于本地存储中。
    
* 为支持对combo请求的控制扩展 `Module._load`: 该阶段主要有两个过程，假设seajs.use(['./a.js,./b.js,.c/d.js,./c.css'],function(a,b,c){})
    * 过程1：划分资源 - [['http://path/to', ['a.js', 'b.js', 'c/d.js', 'a.css', 'b.css']]并且根据资源文件的类型分组[['a.js', 'c/d.js', 'b.js'], ['a.css', 'b.css']] **注：目前阶段不支持除js和css的资源分组，将会在调用Module._load(uris,callback)时被过滤**
    * 过程2：创建map规则 ，即诸如 'http://path/to/a.js'  ==> 'http://path/to/??a.js,c/d.js,b.js'
    
**对于combo**

场景

```js
seajs.use(['a', 'b'], ...)

require.async(['a', 'b'], ...)

define('id', ['a', 'b'], ...)
```

上面这些场景中的 `a.js` 和 `b.js` 会合并成：`http://example.com/path/to/??a.js,b.js` 一起下载。

[更多详见](https://github.com/seajs/seajs/issues/226)

**特殊说明**

plugin-storage已经自带combo功能，开启与关闭均需要在manifest配置中体现。注意在使用combo时格式需非常严谨，要求收尾不能有折行和空格，并需要有分号进行代码上的分隔

- - - 

##### 致谢

该插件基于seajs开发，感谢玉伯在seajs社区的努力。 插件最终将运用在无线[MIX](https://github.com/mixteam/mix)方案中。


- - - 

##### 未来

**后续工作**

1. 开发不基于seajs的localStorage loader - 目标简约，无需管理依赖
2. seajs线上runtime版本

20%的精力

**view管理**

80%的精力，因为在第一代webApp中涉及比较深，也非常清楚知道哪些地方需要做好，所以接下来更多精力将在view的管理上有更多的突破！