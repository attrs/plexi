# plexi [![NPM Version][npm-image]][npm-url] [![NPM Downloads][downloads-image]][downloads-url] [![Build Status][travis-image-flat]][travis-url]


Plexi is a plugin system for nodejs. Helps to make a horizontal plugin architecture.

### Getting Started
##### Installation
```sh
$ sudo npm install plexi -g
```

##### Initialize project
```sh
# init with default activator js file (activator.js file will be created)
$ plexi init

# or your own activator js file can be specified
$ plexi init src/youractivator.js
```

##### Install plugins
```sh
# if you want install according to package.json/plexi.dependencies
$ plexi install

# install plexi based packages you want (--save option for save package.json/plexi.dependencies)
$ plexi install plexi.workbench --save
$ plexi install plexi.mongodb@^2.6.5 --save

# also can install from git repository
$ plexi install https://github.com/attrs/plexi.mongodb --save
$ plexi install attrs/plexi.mongodb --save

# uninstall
$ plexi uninstall plexi.workbench --save

# also can install from file system for local test (by symbolic link)
# (useful method for developing several plugins)
$ plexi link file:package_dir_path --save

# unlink
$ plexi unlink file:package_dir_path --save
```

##### Writing activator
See https://github.com/attrs/plexi/tree/master/examples

```js
module.exports = {
	start: function(ctx) {		
		// preference from plexi.json
		var options = ctx.preference;
		
		// simple example for use plexi.http
		var http = ctx.require('plexi.http');
		var bucket = http.create().mount('/myapp');
		bucket.get('/index.html', function(req, res) {
			res.write('Hello, World!\n' + JSON.stringify(options));
		});
		
		console.log('[' + ctx.id + '] start');
	},
	stop: function(ctx) {
		console.log('[' + ctx.id + '] stop');
	}
};
```


##### Start plugin-system
```sh
# will be executed activator.js specified from plexi init (pakage.json/plexi.activator)
$ plexi start
...
plexi$ _
```

##### Internal cli usage
```sh
# plugin system status
plexi$ p
...
 
# plugins status
plexi$ ss
0     started      yourpacakage        0.0.1
1     started      plexi.http          0.1.0 
...

# plugin info ("0" is ss index number)
plexi$ p 0

# stop plugin
plexi$ stop 0

# start plugin
plexi$ start 0

# help
plexi$ h

# quit
plexi$ q
```

### License

  [MIT](LICENSE)
 


[npm-image]: https://img.shields.io/npm/v/plexi.svg?style=flat
[npm-url]: https://npmjs.org/package/plexi
[downloads-image]: https://img.shields.io/npm/dm/plexi.svg?style=flat
[downloads-url]: https://npmjs.org/package/plexi
[travis-image-flat]: https://img.shields.io/travis/attrs/plexi.svg?style=flat
[travis-image]: https://travis-ci.org/attrs/plexi.svg?branch=master
[travis-url]: https://travis-ci.org/attrs/plexi
