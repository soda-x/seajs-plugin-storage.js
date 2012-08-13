plugin-storage.js
======

该插件最核心理想是：

*  彻底磨灭二次访问的网络请求数（主要指代js和css文件），彻底消灭以往304所带来的各种开销（RTT, TCP Connection setup - 3way - handshake）
*  极限节省用户的流量。

useage
---------------


### seajs.config设置

在使用`plugin-storage`中 需要约定一些东西 具体约定如下：


在`seajs.config`中需要添加两个特定条目的别名

`'store' : 'store/0.1/store.js'`
`'manifest' : 'path/manifest.js'`

并且preload顺序必须为`['manifest', 'seajs/plugin-storage']` ，`manifest`必须在`seajs/plugin-storage`之前


具体如下：

```javascript

  seajs.config({
    alias: {
      'store' : 'store/0.1/store.js',
      'manifest' : 'path/manifest.js'
    },
    preload: [
      'manifest', 
      'seajs/plugin-storage'
    ]

  });

```

关于 `store.js` 对于高级浏览器 我做了简单的封装 地址如下： https://github.com/pigcan/store   拿来直接就可以用了

### manifest.js设置

`manifest.js`中所设置的为需要存储的js或者css

具体所需信息如下：


```javascript

define({
  "version" : "1234" ,
  "path/a/a.js":{"version":"0.2"} ,
  "path/b/b.js":{"version":"0.2"} ,
  "path/c/c.js":{"version":"0.2"} ,
  "path/jquery/1.7.2/jquery-debug.js":{"version":""} 
})

```

在这个文件中所列的 `version` 为 当前 项目版本 ，  任何所列的条目的更新必将产生新的版本号 


而在url条目中 ， 需要设置的东西有两个， 一个是绝对路径（本地开发时写本地地址，线上时需要更新到线上地址），以及对应文件的版本号

> 首先声明一下 ， 必须使用文件夹来区分版本，并不能使用文件名来区分版本
> 也就是说 必须采用如下形式 `a/0.1/a.js` 而不能使用a/a.0.1.js


如果说一个url条目中`version`的版本为空 那么他将不采用版本控制

如果一个url含有`version`并且不为空

那么举例 `"path/b/b.js":{"version":"0.2"} ` ---> `path/b/0.2/b.js`


### seajs.use 设置

为了避免在js中出现人为书写大量版本信息，在 使用 ` plugin-storage ` 插件的时候 ，并不需要对`use`的模块设定版本号 ， 但是必须在manifest文件中声明版本号

另外还有个好处就是在对条目进行存储的时候

使用`path/a/a.js`这个作为关键字存储，避免了加入版本存储时，需要对存储进行更多的操作。

具体如下：

```javascript

// right !!!!!

seajs.use('./a/a.js',function(a){
  // to do someting
})

// wrong !!!!!

seajs.use('./a/0.2/a.js',function(a){
  // to do someting
})

```


### 未来做的

1.在项目中加入 `package.json` ，该`json`文件和之前的`manifest.js` 基本一致， 但是这个`json`文件由nodejs来调用，
另外对版本会有更多的控制，如果用户设定不需要版本那则不加入版本信息，如果设定为最新，那每次都会去获取最新版本的js，如果设定为特定版本号，则忽略是否有最新版本
并最终调用该描述文件生成`manifest.js`

2.目前不能对seajs进行持久化存储，之后会加入一个更加纯粹的loader ， 模块化 和 非模块化 一并使用 ，以达到完美 。


如果大家在使用过程中，或者有任何建议都欢迎随时交流， issue ！




