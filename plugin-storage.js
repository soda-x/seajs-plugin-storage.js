
;define('seajs/plugin-storage', ['./plugin-base', 'store', 'manifest'], function(require) {

  var Module = seajs.pluginSDK.Module

  var latestManifest = require('manifest')
  if (!latestManifest) return

  var plugin = require('./plugin-base')
  var util = plugin.util
  var store = require('store').createStorage('localStorage')

  var storedManifest = store.get('manifest')
  var updatedList = {}
  
  var unRealPath = {}

  //本地不存在描述文件或者本地存储的描述文件的版本号并不是最新的才认为需要更新
  var isNeedUpdate = !storedManifest ||
      storedManifest.version !== latestManifest.version

  if (isNeedUpdate) {
    //需要更新则获取更新列表
    updatedList = getUpdatedList()

    // 更新本地缓存至最新版本
    storedManifest = latestManifest
    store.set('manifest', storedManifest)
  }


  // Hack Module._resolve method
  extendResolve()


  // Register plugin information
  plugin.add({
    name: 'storage',

    ext: ['.js'],

    fetch: function(url, callback) {
      
      var cachedCode = store.get(url)
      var realPath = getRealPath(url, storedManifest)
      //本地存储中存在该url的条目信息但是新配置文件中不需要缓存与此同时他又不存在更新列表中
      //那么将直接从本地读取js
      if (cachedCode && !(storedManifest[url].indexOf('!')==0) && !updatedList[url]) {
        util.globalEval(cachedCode)
        callback()
      }
      else {

        util.xhr(realPath, function(code) {
          setComboCode(url,code)
          storedManifest[url] && !(storedManifest[url].indexOf('!')==0) && store.set(url, code)
          util.globalEval(code)
          callback()
        })
      }

    }
  })


  // Helpers
  // -------

  function getUpdatedList() {
    //如果本地不存在描述文件则认为全部需要更新
    if (!storedManifest) {
      return latestManifest
    }
    
    var list = {}

    for (var key in latestManifest) {
      // 如果manifest的属性为`version`时中断此次循环
      if (!latestManifest.hasOwnProperty(key) || key === 'version') continue

      var storedItem = storedManifest[key]
      var latestItem = latestManifest[key]
      
      // 如果本地存储中不存在该条目或者本地存储中的版本号并不相等，则把该条目加入到更新列表中
      if (!storedItem || storedItem.version !== latestItem.version) {
        list[key] = latestItem
      }
    }

    return list
  }
  
  function extendResolve() {
    var _resolve = Module._resolve
    Module._resolve = function(id, refUri) {
      // 修正 refUri
      return _resolve(id, getRealPath(refUri, storedManifest))
    }
  }

  //获取真实地址
  function getRealPath(url, manifest) {
    
    var version = manifest[url]

    //如果manifest中不存在该条目，或者它并不存在版本信息，或者版本信息中首字母为‘#’
    //那么就认为它不需要版本服务，则直接返回url
    if (!version || version.indexOf('#') == 0) return url
    version.indexOf('!')==0 && (version = version.slice(1))
    var m = url.match(/^(.*)\/([^\/]+)$/)
    if (!m) return url

    var dirname = m[1]
    var name = m[2]
    var realPath = dirname + '/' + version + '/' + name
    unRealPath[realPath] = url
    return realPath
  } 

  //获取combo信息 在确认需要combo请求的时候，combo请求链接拆分，并得到需缓存url
  //splitScript的作用是指明数组第几个序列需要被存储，以及存储的key值为什么
  function getComboInfo(url){
      var isCombo = storedManifest.combo,
          splitScript = {}
      //为了省略for in 判断是否对象为空 加一属性
      splitScript['empty'] = true
      if(isCombo){
        var uris = getSplitComboUri(url)

        if(uris.length == 0) return splitScript
        var i = 0 

        gutil.map(uris,function(item){
          i++
          //地址有通过realPath方法的需反向过去，如果没有通过manifest版本上的管理则直接拼接地址（代表其并未出现在manifest描述文件中抑或并不需要版本管理的js）
          var list = unRealPath[item] || item
          //如果该url被manifest罗列，并且指明了他需要被缓存则进行记录循环索引以及修改的url
          if(storedManifest[list] && !(storedManifest[list].indexOf('!')==0)){
            splitScript['empty'] = false
            splitScript[i] = list         
          }
        })
        
      }
      return splitScript
  }

  function setComboCode(url,code){
    var splitScript = getComboInfo(url)
    if(!splitScript['empty']){
      var comboArray = splitCombo(code)
      for(var i in splitScript){
        if(!splitScript.hasOwnProperty(i) || i === 'empty' || i=== 'lList') continue
          store.set(splitScript[i], comboArray[parseInt(i)-1])
        }
    }
  
  }


  function getSplitComboUri(uri){

    var comboSyntax = config.comboSyntax || ['??', ',']
    var uris = []
    if(uri.indexOf(comboSyntax[0]) > -1){
      var i = 0 
      var urlSplit = uri.split(comboSyntax[0])
      var host = urlSplit[0]
      var sList = urlSplit[1]
      var sourceListItem = urlSplit[1].split(comboSyntax[1])
      uris = gutil.map(sourceListItem,function(item){
        return host+item
      })
    }
    return uris
  }

  var gutil = seajs.pluginSDK.util
  var config = seajs.config
  var cachedModules = seajs.cache

  function hackLoad() {
    var MP = Module.prototype

    var _load = MP._load

    MP._load = function(uris, callback) {
           
      setComboMap(uris)

      _load.call(this, uris, callback)
    }
  }
  

  function setComboMap(uris) {
    // 得到本地存储中并不存在的 并且 不以 css和js为结尾的资源文件
    uris = gutil.filter(uris,function(uri){
      if(!uri.match(/\.(css|js)$/) && !store.get(uri))  return true
    })

    //console.log('匹配前',uris)

    uris = gutil.map(uris,function(uri){
      return getRealPath(uri,storedManifest)
    })
    //console.log('匹配后',uris)
    var comboExcludes = config.comboExcludes

    // Removes fetched or fetching uri
    var unFetchingUris = gutil.filter(uris, function(uri) {
      var module = cachedModules[uri]

      return (!module || module.status < Module.STATUS.FETCHING) &&
          (!comboExcludes || !comboExcludes.test(uri))
    })

    if (unFetchingUris.length > 1) {
      seajs.config({ map: paths2map(uris2paths(unFetchingUris)) })
    }
  }


  // No combo in debug mode or No needed
  if (seajs.debug || !storedManifest.combo) {
    seajs.log('Combo is turned off in debug mode')
  } else {
    hackLoad()
  }


  // Uses map to implement combo support
  // -----------------------------------------------

  function uris2paths(uris) {
    return meta2paths(uris2meta(uris))
  }

  // [
  //   'http://example.com/p/a.js',
  //   'https://example2.com/b.js',
  //   'http://example.com/p/c/d.js',
  //   'http://example.com/p/c/e.js'
  // ]
  // ==>
  // {
  //   'http__example.com': {
  //                          'p': {
  //                                 'a.js': { __KEYS: [] },
  //                                 'c': {
  //                                        'd.js': { __KEYS: [] },
  //                                        'e.js': { __KEYS: [] },
  //                                        __KEYS: ['d.js', 'e.js']
  //                                 },
  //                                 __KEYS: ['a.js', 'c']
  //                               },
  //                          __KEYS: ['p']
  //                        },
  //   'https__example2.com': {
  //                            'b.js': { __KEYS: [] },
  //                            _KEYS: ['b.js']
  //                          },
  //   __KEYS: ['http__example.com', 'https__example2.com']
  // }
  function uris2meta(uris) {
    var meta = { __KEYS: [] }

    gutil.forEach(uris, function(uri) {
      var parts = uri.replace('://', '__').split('/')
      var m = meta

      gutil.forEach(parts, function(part) {
        if (!m[part]) {
          m[part] = { __KEYS: [] }
          m.__KEYS.push(part)
        }
        m = m[part]
      })

    })
    //console.log('meta',meta)
    return meta
  }


  // {
  //   'http__example.com': {
  //                          'p': {
  //                                 'a.js': { __KEYS: [] },
  //                                 'c': {
  //                                        'd.js': { __KEYS: [] },
  //                                        'e.js': { __KEYS: [] },
  //                                        __KEYS: ['d.js', 'e.js']
  //                                 },
  //                                 __KEYS: ['a.js', 'c']
  //                               },
  //                          __KEYS: ['p']
  //                        },
  //   'https__example2.com': {
  //                            'b.js': { __KEYS: [] },
  //                            _KEYS: ['b.js']
  //                          },
  //   __KEYS: ['http__example.com', 'https__example2.com']
  // }
  // ==>
  // [
  //   ['http://example.com/p', ['a.js', 'c/d.js', 'c/e.js']]
  // ]
  function meta2paths(meta) {
    var paths = []

    gutil.forEach(meta.__KEYS, function(part) {
      var root = part
      var m = meta[part]
      var KEYS = m.__KEYS

      while(KEYS.length === 1) {
        root += '/' + KEYS[0]
        m = m[KEYS[0]]
        KEYS = m.__KEYS
      }

      if (KEYS.length) {
        paths.push([root.replace('__', '://'), meta2arr(m)])
      }
    })
    //console.log('paths',paths)
    return paths
  }


  // {
  //   'a.js': { __KEYS: [] },
  //   'c': {
  //          'd.js': { __KEYS: [] },
  //          'e.js': { __KEYS: [] },
  //          __KEYS: ['d.js', 'e.js']
  //        },
  //   __KEYS: ['a.js', 'c']
  // }
  // ==>
  // [
  //   'a.js', 'c/d.js', 'c/e.js'
  // ]
  function meta2arr(meta) {
    var arr = []

    gutil.forEach(meta.__KEYS, function(key) {
      var r = meta2arr(meta[key])

      // key = 'c'
      // r = ['d.js', 'e.js']
      if (r.length) {
        gutil.forEach(r, function(part) {
          arr.push(key + '/' + part)
        })
      }
      else {
        arr.push(key)
      }
    })
    //console.log('arr',arr)
    return arr
  }


  // [
  //   [ 'http://example.com/p', ['a.js', 'c/d.js', 'c/e.js', 'a.css', 'b.css'] ]
  // ]
  // ==>
  //
  // a map function to map
  //
  // 'http://example.com/p/a.js'  ==> 'http://example.com/p/??a.js,c/d.js,c/e.js'
  // 'http://example.com/p/c/d.js'  ==> 'http://example.com/p/??a.js,c/d.js,c/e.js'
  // 'http://example.com/p/c/e.js'  ==> 'http://example.com/p/??a.js,c/d.js,c/e.js'
  // 'http://example.com/p/a.css'  ==> 'http://example.com/p/??a.css,b.css'
  // 'http://example.com/p/b.css'  ==> 'http://example.com/p/??a.css,b.css'
  //
  function paths2map(paths) {
    var comboSyntax = config.comboSyntax || ['??', ',']
    var map = []

    gutil.forEach(paths, function(path) {
      var root = path[0] + '/'
      var group = files2group(path[1])

      gutil.forEach(group, function(files) {

        var hash = {}

        var comboPath = root + comboSyntax[0] + files.join(comboSyntax[1])

        // http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url
        if (comboPath.length > 2000) {
          throw new Error('The combo url is too long: ' + comboPath)
        }

        gutil.forEach(files, function(part) {
          var uri = unRealPath[root+part] || (root + part)
          hash[uri] = comboPath
        })
        //console.log('hash',hash)
        map.push(function(url) {
          return hash[url] || url
        })

      })

    })
    //console.log('map',map)
    return map
  }


  //
  //  ['a.js', 'c/d.js', 'c/e.js', 'a.css', 'b.css', 'z']
  // ==>
  //  [ ['a.js', 'c/d.js', 'c/e.js'], ['a.css', 'b.css'] ]
  //
  function files2group(files) {
    var group = []
    var hash = {}

    gutil.forEach(files, function(file) {
      var ext = getExt(file)
      if (ext) {
        (hash[ext] || (hash[ext] = [])).push(file)
      }
    })

    for (var ext in hash) {
      if (hash.hasOwnProperty(ext)) {
        group.push(hash[ext])
      }
    }
    //console.log('group',group)
    return group
  }


  function getExt(file) {
    var p = file.lastIndexOf('.')
    return p >= 0 ? file.substring(p) : ''
  }

  function splitCombo(code){

    return code.match(/define\([\s\S]*?\)(?=;*define\(|;*$)/g)

  }

  // For test
  gutil.toComboPaths = uris2paths
  gutil.toComboMap = paths2map
});
