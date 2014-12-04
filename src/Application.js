var path = require('path');
var fs = require('fs');
var colors = require('colors');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;

var Plugin = require('./Plugin.js').Plugin;
var PluginIdentifier = require('./Plugin.js').PluginIdentifier;
var PluginDescriptor = require('./Plugin.js').PluginDescriptor;
var PluginManager = require('./PluginManager.js');
var ApplicationError = require('./ApplicationError.js');
var cli = require('./cli.js');

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

var rmdirRecursive = function(path) {
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

var Application = function(homedir, argv) {
	if( !homedir ) throw new ApplicationError('missing home directory', homedir);
	
	argv = argv || {};
	if( argv.debug ) this.debug = true;
	
	this.ee = new EventEmitter();
	
	if( this.debug ) {
		this.on('detected', function(plugin) {
			console.log('* [' + plugin.id + '] plugin detected!');
		}).on('bound', function(plugin) {
			console.log('* [' + plugin.id + '] plugin bound!');
		}).on('started', function(plugin) {
			console.log('* [' + plugin.id + '] plugin started!');
		}).on('stopped', function(plugin) {
			console.log('* [' + plugin.id + '] plugin stopped!');
		}).on('detect-error', function(plugin) {
			console.log('* [' + plugin.id + '] plugin error!');
		}).on('require', function(name, plugin, caller, exports) {
			console.log('* [' + caller.id + '] plugin require "' + name + '" [' + plugin.id + ']');
			console.log('\texports: ', exports);
		});
	}
	
	var home = this.home = homedir;
	var manifest = require(path.resolve(home, 'package.json'));
	var plexipkg = require('../package.json');
	var plexi = manifest.plexi || {};
	var dependencies = plexi.dependencies || {};
	var version = plexipkg.version;
	
	var preferences, env, links;
	
	Object.defineProperty(manifest, 'save', {
		value: function(fn) {
			var data = JSON.stringify(this, null, '\t');
			fs.writeFileSync(path.resolve(home, 'package.json'), data, {encoding:'utf8'});
		},
		enumerable: false,
		configurable: false,
		writable: false
	});
	
	if( !argv.ignorelinks ) {
		var linksfile = path.resolve(home, '.plexilinks');
		if( fs.existsSync(linksfile) && fs.statSync(linksfile).isFile() ) {
			var links_text = fs.readFileSync(linksfile, {encoding:'utf8'});
			if( links_text ) {
				var links_array = links_text.toString().split('\r').join('').split('\t').join('').split('\n');
				
				if( links_array.length ) {
					links = [];
					for(var i=0; i < links_array.length; i++) {
						var link = links_array[i];
						if( link ) link = link.trim();
						if( link ) links.push(link);
					}
					if( !links.length ) links = null;
				}
			}
		}
	}
	
	// read preference file
	if( true ) {		
		var pref_js_file = path.resolve(home, 'plexi.js');
		var pref_json_file = path.resolve(home, 'plexi.json');
		
		if( fs.existsSync(pref_js_file) && fs.statSync(pref_js_file).isFile() ) {
			preferences = require(pref_js_file);
		} else if( fs.existsSync(pref_json_file) && fs.statSync(pref_json_file).isFile() ) {
			preferences = require(pref_json_file);
		} else {
			preferences = {};
		}
	}
	
	// read env
	env = preferences.env || {};
	
	this.PLUGINS_DIR = path.resolve(home, env['plugins.dir'] || 'plexi_modules');
	this.WORKSPACE_DIR = path.resolve(home, env['workspace.dir'] || 'workspace');
	this.LOG_DIR = path.resolve(home, env['log.dir'] || 'logs');
	
	//if( !fs.existsSync(this.PLUGINS_DIR) ) fs.mkdirSync(this.PLUGINS_DIR);
	//if( !fs.existsSync(this.WORKSPACE_DIR) ) fs.mkdirSync(this.WORKSPACE_DIR);

	// read properties
	var properties = {};
	if( typeof(argv) === 'object' ) {
		for( var key in argv ) {
			if( !key || !argv.hasOwnProperty(key) ) continue;
			properties[key] = argv[key];
		}
	}		
	
	if( preferences.properties ) {
		for( var key in preferences.properties ) {
			if( !key || !preferences.properties.hasOwnProperty(key) ) continue;
			properties[key] = preferences.properties[key];
		}
	}
	
	properties['home'] = this.home;
	properties['plexi.version'] = version;
	properties['workspace.dir'] = this.WORKSPACE_DIR;
	properties['plugins.dir'] = this.PLUGINS_DIR;
	properties['log.dir'] = this.LOG_DIR;
	
	try {
		preferences = JSON.stringify(preferences);
		for(var k in properties) {
			var value = properties[k] || '';
			preferences = preferences.split('{' + k + '}').join(value);
		}
		
		preferences = preferences.split('\\').join('/');
		preferences = JSON.parse(preferences);
	} catch(err) {
		throw new ApplicationError('application_load_error:config_file_parse:' + pref_file + ':' + err.message, err);
	}

	// setup instance attributes
	this.manifest = manifest;
	this.links = links;
	this.properties = properties;
	this.preferences = preferences.preferences || {};
	this.plugins = new PluginManager(this);
	
	// set host plugin
	this.plugins.host(new PluginDescriptor(this, process.cwd()).instantiate());
	
	// links 가 있다면 활성화
	var links = this.links;
	if( links ) {
		for(var i=0; i < links.length; i++) {
			var link = links[i];
			if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
				var descriptor = new PluginDescriptor(this, link);
				if( !this.plugins.exists(descriptor.name, descriptor.version) ) {
					this.plugins.add(descriptor.instantiate());
				} else {
					console.warn(('* [' + descriptor.id + '] already exists, ignored.').yellow, link);						
				}
			} else {
				console.warn(('[WARN] path in .plexilinks : "' + link + '" does not exists, ignored.').underline.bgBlack.yellow);
			}
		}
	}
	
	// plugins.dir 에서 활성화
	if( fs.existsSync(this.PLUGINS_DIR) ) {
		var files = fs.readdirSync(this.PLUGINS_DIR);

		for(var i=0; i < files.length; i++) {
			var dirname = files[i];
		
			if( dirname.startsWith('-') || dirname.startsWith('.') ) continue;

			var dir = path.resolve(this.PLUGINS_DIR, dirname);
			if( fs.statSync(dir).isDirectory() ) {
				var descriptor = new PluginDescriptor(this, dir);
				if( this.plugins.exists(descriptor.name, descriptor.version) ) {
					console.warn(('* [' + descriptor.id + '] already exists, ignored.').yellow, dir);
				} else {
					this.plugins.add(descriptor.instantiate());
				}
			}
		}
	}
};

Application.prototype = {
	path: function(f) {
		return path.join(this.home, f);
	},
	cli: function() {
		return this._cli = this._cli || cli.application(this);
	},
	start: function() {
		var host = this.plugins.host();
		if( host ) host.start();
		return this;
	},
	plugins: function() {
		return this.plugins;
	},
	link: function(link) {
		if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
			var descriptor = new PluginDescriptor(this, link);
			if( !this.plugins.exists(descriptor.name, descriptor.version) ) {
				this.plugins.add(descriptor.instantiate());
			} else {
				console.warn('[WARN] "' + descriptor.id + '" already exists, ignored.', link);				
			}
		} else {
			console.warn(('[WARN] .plexilinks : "' + link + '" does not exists, ignored.').underline.bgBlack.yellow);
		}
		
		return false;
	},
	install: function(pkgs, fn) {				
		var tasks = [];
		var plugins = this.plugins;
		pkgs.forEach(function(pkg) {			
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
		if( prefs ) {			
			var pref = prefs[identifier.name];
						
			if( identifier.version ) {
				pref = prefs[identifier.name + '@' + identifier.version] || pref;
			}
			
			if( pref ) return JSON.parse(JSON.stringify(pref));
		}

		return null;
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
	}
};

// static methods
Application.parseIdentifier = function(identifier) {
	return PluginIdentifier.parse(identifier);
};


module.exports = Application;
