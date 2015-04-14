var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;

var Plugin = require('./Plugin.js').Plugin;
var PluginIdentifier = require('./Plugin.js').PluginIdentifier;
var PluginDescriptor = require('./Plugin.js').PluginDescriptor;
var PluginManager = require('./PluginManager.js');
var Logger = require('./Logger.js');
var Workspace = require('./Workspace.js');
var cli = require('./cli.js');
var commands = require('./commands.js');
var util = require('attrs.util');
var ApplicationError = util.createErrorType('ApplicationError');

if( !String.prototype.startsWith ) {
	String.prototype.startsWith = function(s) {
		if( !s ) return false;
		return (this.indexOf(s)==0);
	};
}

if( !String.prototype.endsWith ) {
	String.prototype.endsWith = function(s) {
		if( !s ) return false;

		return this.indexOf(s, this.length - s.length) !== -1;
	};
}

if( !String.prototype.trim ) {
	String.prototype.trim = function() {
		return this.replace(/(^ *)|( *$)/g, "");
	};
}

function rmdirRecursive(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                rmdirRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

function makeSaveReload(o, file, options) {
	options = options || {};
	var root = options.root || o;
	
	Object.defineProperty(o, 'save', {
		value: function(fn) {
			var data = JSON.stringify(root, null, '\t');
			fs.writeFileSync(file, data, {encoding:'utf8'});
			
			if( options.save ) options.save.call(this, data);
			return this;
		},
		enumerable: false,
		configurable: false,
		writable: false
	});
	
	Object.defineProperty(o, 'reload', {
		value: function(fn) {
			var data = fs.readFileSync(file);
			
			var result;
			if( options.reload ) result = options.reload.call(this, data);
			return result || data;
		},
		enumerable: false,
		configurable: false,
		writable: false
	});
}

var instances = [];

var Application = function(homedir, argv) {
	if( !homedir || typeof(homedir) !== 'string' ) throw new ApplicationError('missing or illegal home directory', homedir);
	
	var self = this;
	process.on('exit', function(code) {
		if( code !== 0 ) util.error(self, 'abnormal termination(' + code + ')');
		self.stop();
	});
	
	argv = argv || {};
	if( argv.debug ) this.debug = true;
	
	var home = this.home = path.normalize(path.resolve(process.cwd(), homedir));
	var manifest = require(path.resolve(home, 'package.json'));
	var plexipkg = require('../package.json');
	var plexi = manifest.plexi || {};
	var dependencies = plexi.dependencies || {};
	var version = plexipkg.version;
	
	makeSaveReload(manifest, path.resolve(home, 'package.json'));
	
	var preferences = (function(argv) {
		var raw = {}, prefs = {}, properties = {}, env = {}, file = path.resolve(home, 'plexi.json');
		
		var result = {
			get env() {
				return env;
			},
			get properties() {
				return properties;
			},
			get raw() {
				return raw;
			},
			get prefs() {
				return prefs;
			},
			get: function(id) {
				return prefs[id.toString() || id.name];
			},
			set: function(id, pref) {
				if( id instanceof PluginIdentifier ) id = id.name;
				if( typeof id !== 'string' ) return util.error(self, 'invalid plugin id', id);
				if( typeof pref !== 'object' ) return util.error(self, 'preference must be an object', id, pref);
				
				if( !raw.preferences ) raw.preferences = {};
				raw.preferences[id] = pref;
				
				pref = JSON.stringify(pref);	
				pref = pref.split('\\').join('/');
				
				for(var k in properties) {
					pref = pref.split('{' + k + '}').join(properties[k]);
				}
								
				pref = JSON.parse(pref);				
				prefs[id] = pref;
				
				return pref;
			},
			save: function() {
				fs.writeFileSync(file, JSON.stringify(raw, null, '\t'), {encoding:'utf8'});
				return this;
			},
			reload: function() {
				try {
					if( fs.existsSync(file) && fs.statSync(file).isFile() ) {
						raw = require(file);
					}
					
					var newenv = raw.env ? util.mix({}, raw.env) : {};
					newenv['plugin.dir'] = env['plugin.dir'] || path.resolve(home, newenv['plugin.dir'] || '.plexi/plugins');
					newenv['workspace.dir'] = env['plugin.dir'] || path.resolve(home, newenv['workspace.dir'] || '.plexi/workspace');
					newenv['log.dir'] = env['plugin.dir'] || path.resolve(home, newenv['log.dir'] || '.plexi/log');
					env = newenv;
					
					properties = util.mix({}, raw.properties || {}, argv || {});
					properties['home'] = home;
					properties['plexi.version'] = version
					properties['plugin.dir'] = env['plugin.dir'];;
					properties['workspace.dir'] = env['workspace.dir'];
					properties['log.dir'] = env['log.dir'];
					
					for(var k in raw.preferences) {
						result.set(k, raw.preferences[k]);
					}
				} catch(err) {
					return util.error(self, err);
				}
				return this;
			}
		};
		
		return result;
	})(argv);
		
	preferences.reload();
	
	this.PLUGIN_DIR = preferences.env['plugin.dir'];
	this.WORKSPACE_DIR = preferences.env['workspace.dir'];
	this.LOG_DIR = preferences.env['log.dir'];
	
	// init commands
	this.commands = commands(this);
	
	// init registry
	var registry = {
		types: {},
		properties: {}
	};
		
	Object.defineProperty(registry.types, 'create', {
		value: function(typename, checker) {
			if( !typename || typeof(typename) !== 'string' ) throw new TypeError('illegal type name:' + typename);
			if( typeof(checker) !== 'function' ) throw new TypeError('illegal type checker:' + checker);
			
			this[typename] = {};
			Object.defineProperty(this[typename], 'add', {
				value: function(name, object) {
					if( name && typeof(name) === 'string' && checker(object) ) {
						this[name] = object;
					} else {
						console.error(('[registry] illegal binding: ' + name + '.' + name).red, object);
					}
				},
				enumerable: false,
				configurable: false,
				writable: false
			});
			
			// Available in nodejs >= 0.11.13
			if( Object.observe ) {
				Object.observe(this[typename], function(changes) {
					// [{name: 'baz', object: <obj>, type: 'add'}]
					changes.forEach(function(change) {
						if( change.type === 'add' || change.type === 'update' ) {
							if( !change.name || !checker(change.object) ) {
								console.error('illegal binding: registry.' + name + '.' + change.name, change.object);
								delete this[typename][change.name];
							}
						}
					});
				});
			}
		},
		enumerable: false,
		configurable: false,
		writable: false
	});
	
	Object.defineProperty(this, 'registry', {
		value: registry,
		enumerable: true,
		configurable: false,
		writable: false
	});
	
	// init event emitter
	this.ee = new EventEmitter();	
	if( this.debug ) {
		this.on('detected', function(plugin) {
			util.debug(plugin, 'plugin detected!');
		}).on('bound', function(plugin) {
			util.debug(plugin, 'plugin bound!');
		}).on('started', function(plugin) {
			util.debug(plugin, 'plugin started!');
		}).on('stopped', function(plugin) {
			util.debug(plugin, 'plugin stopped!');
		}).on('detect-error', function(plugin) {
			util.debug(plugin, 'plugin error!');
		}).on('require', function(name, plugin, caller, exports) {
			util.debug(caller, 'call require', name, plugin.id.toString(), '\n\texports: ', exports);
		});
	}

	// setup instance attributes
	this.version = version;
	this.manifest = manifest;
	this.links = links;
	this.preferences = preferences;
	this.properties = preferences.properties;
	this.plugins = new PluginManager(this);
	this.autoStart = plexi.autoStart === false ? false : true;
	
	// set host plugin
	this.plugins.host(new PluginDescriptor(this, process.cwd()).instantiate());
	
	// links 가 있다면 활성
	var links = this.links = [];
	if( !argv.ignorelinks ) {
		var linksfile = path.resolve(home, '.plexilinks');
		if( fs.existsSync(linksfile) && fs.statSync(linksfile).isFile() ) {
			var links_text = fs.readFileSync(linksfile, {encoding:'utf8'});
			if( links_text ) {
				var links_array = links_text.toString().split('\r').join('').split('\t').join('').split('\n');
				
				if( links_array.length ) {
					for(var i=0; i < links_array.length; i++) {
						var link = links_array[i];
						
						link = link.split('#')[0];
						
						if( link ) links.push(link.split('\t').join('').trim());
					}
					if( !links.length ) links = null;
				}
			}
		}
		
		links.forEach(function(link) {
			link = path.normalize(path.resolve(process.cwd(), link));
			if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
				var descriptor = new PluginDescriptor(self, link);
				if( !self.plugins.exists(descriptor.name, descriptor.version) ) {
					self.plugins.add(descriptor.instantiate());
				} else {
					util.warn(descriptor, 'already exists', link);					
				}
			} else {
				util.warn(self, '.plexilinks : "' + link + '" not found');
			}
		});
	}
	
	// plugin.dir 에서 활성화
	if( fs.existsSync(this.PLUGIN_DIR) ) {
		var files = fs.readdirSync(this.PLUGIN_DIR);

		for(var i=0; i < files.length; i++) {
			var dirname = files[i];
		
			if( dirname.startsWith('-') || dirname.startsWith('.') ) continue;

			var dir = path.resolve(this.PLUGIN_DIR, dirname);
			if( fs.statSync(dir).isDirectory() ) {
				var descriptor = new PluginDescriptor(this, dir);
				if( this.plugins.exists(descriptor.name, descriptor.version) ) {
					util.warn(descriptor, 'already exists', dir);
				} else {
					this.plugins.add(descriptor.instantiate());
				}
			}
		}
	}
	
	instances.push(this);
};

// static
Application.instance = function(file) {
	if( !file ) file = process.cwd();
	file = path.normalize(path.resolve(process.cwd(), file));
	var app = instances[file];
	if( app ) return app;
		
	var instance;	
	instances.sort().reverse().every(function(item) {
		if( file.startsWith(item.home) ) {
			instance = item;
			return false;
		}
		return true;
	});
	
	return instance;
};

// instance
Application.prototype = {
	path: function(f) {
		return path.join(this.home, f);
	},
	cli: function() {
		return this._cli = this._cli || cli.application(this);
	},
	start: function() {
		try {
			console.log(chalk.cyan.bold('[' + this.toString() + ']'), chalk.black(chalk.white('application startup'), chalk.white(this.home)));
			var host = this.plugins.host();
			if( host ) host.start();
		
			if( this.autoStart ) {
				this.plugins.all().forEach(function(plugin) {
					plugin.start();
				});
			}
		} catch( err ) {
			util.error(this, err);
			process.exit(1);
		}
		
		return this;
	},
	plugins: function() {
		return this.plugins;
	},
	link: function(link) {
		if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
			var descriptor = new PluginDescriptor(this, link);
			if( !this.plugins.exists(descriptor.name, descriptor.version) ) {
				var plugin = descriptor.instantiate();
				this.plugins.add(plugin);
				this.links.push(descriptor.dir);
				return plugin;
			} else {
				util.warn(this, '"' + descriptor.id + '" already exists', link);				
			}
		} else {
			util.warn(this, '.plexilinks : "' + link + '" not found');
		}
		
		return false;
	},
	unlink: function(link) {
		if( !link || typeof(link) !== 'string' ) return false;
		
		link = path.normalize(path.resolve(this.home, link));
		var links = this.links;
		var plugins = this.plugins.all();
		if( !~links.indexOf(link) ) return false;
		
		for(var index;(index = links.indexOf(link)) >= 0;) {
			links.splice(index, 1);
		}
		
		var matched, plugins = this.plugins;
		plugins.all().forEach(function(plugin) {
			if( plugin.dir === link ) {
				matched = plugin;
				plugins.drop(plugin);
			}
		});
		
		return matched || false;
	},
	install: function(pkgs, fn) {				
		var tasks = [];
		var plugins = this.plugins;
		pkgs.forEach(function(pkg) {
			util.debug('plexi', 'installing...', pkg);		
			tasks.push((function(pkg) {
				return function(callback) {
					plugins.install(pkg, function(err, result) {
						callback(err, result);
					});
				};
			})(pkg));
		});
		
		require('async').series(tasks, function(err, results){
			if( fn ) fn(err, results);
		});
		return this;
	},
	installAll: function(fn) {
		var manifest = this.manifest;
		var dependencies = (manifest.plexi && manifest.plexi.dependencies) || {};
		
		var pkgs = [];
		for(var name in dependencies) {
			var version = dependencies[name];
			if( ~version.indexOf('/') || !version.indexOf('file:') ) pkgs.push(version);
			else pkgs.push(name + '@' + version);
		}
		this.install(pkgs, fn);
		return this;
	},
	uninstall: function(pkgs, fn) {
		var tasks = [];
		var plugins = this.plugins;
		pkgs.forEach(function(pkg) {
			util.debug('plexi', 'uninstalling...', pkg);
			tasks.push((function(pkg) {
				return function(callback) {
					plugins.uninstall(pkg, function(err, result) {
						callback(err, result);
					});
				};
			})(pkg));
		});
		
		require('async').series(tasks, function(err, results){
			if( fn ) fn(err, results);
		});
		return this;
	},
	uninstallAll: function(fn) {
		var all = this.plugins.all();
		var pkgs = [];
		for(var i=0; i < all.length; i++) {
			var plugin = all[i];
			if( !~pkgs.indexOf(plugin.name) ) pkgs.push(plugin.name);
		}
		
		this.uninstall(pkgs, fn);
		return this;
	},
	preference: function(identifier) {
		identifier = PluginIdentifier.parse(identifier);
		
		var prefs = this.preferences;
		var pref = prefs.get(identifier.name);
					
		if( identifier.version ) {
			pref = prefs.get(identifier.name + '@' + identifier.version) || pref;
		}
		
		return pref;
	},
	on: function(type, fn) {
		this.ee.on(type, fn);
		return this;
	},
	once: function(type, fn) {
		this.ee.once(type, fn);
		return this;
	},
	off: function(type, fn) {
		this.ee.off(type, fn);
		return this;
	},
	emit: function() {
		this.ee.emit.apply(this.ee, arguments);
		return this;
	},
	stop: function() {
		this.plugins.all().forEach(function(plugin) {
			plugin.stop();
		});
		return this;
	},
	toString: function() {
		return 'plexi';
	}
};

// static methods
Application.instances = function() {
	return instances.slice();
}

Application.parseIdentifier = function(identifier) {
	return PluginIdentifier.parse(identifier);
};

Application.Plugin = Plugin;
Application.PluginDescriptor = Plugin.PluginDescriptor;
Application.PluginIdentifier = Plugin.PluginIdentifier;
Application.PluginContext = Plugin.PluginContext;
Application.PluginManager = PluginManager;
Application.Logger = Logger;
Application.Workspace = Workspace;
Application.ApplicationError = ApplicationError;

module.exports = Application;


/*
(function() {
	function test(file) {
		var instances = ['/a/b/c/d', '/a/b/c', '/a/b/c/3', '/a/b', '/a/b/c/1', '/b/e/d'];
		
		console.log(instances);

		var instance;
		instances.sort().reverse().every(function(item) {
			console.log('current', item);
			if( file.startsWith(item) ) {
				instance = item;
				return false;
			}
			return true;
		});
		return instance;
	}
	console.log('/a/b/c/d/e/f', test('/a/b/c/d/e/f'));
	console.log('/a/b/c/1/', test('/a/b/c/1/'));
	console.log('/a/b/c/1/b', test('/a/b/c/1/b'));
	console.log('/a/b/c/3', test('/a/b/c/3'));
	console.log('/b/e/d/e/f', test('/b/e/d/e/f'));
})();
*/

/* Registry Usage
// type host
registry.types.create('launcher', function(type) {
	console.log('type', type);
	return true;
});

// type provider
registry.types.launcher.add('mongo', {start:function() {}, stop: function() {}});
or
registry.types.launcher.mongo = {start:function() {}, stop: function() {}};
*/