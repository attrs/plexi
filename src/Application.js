var path = require('path');
var fs = require('fs');
var npm = require("npm");
var colors = require('colors');

npm.on('log', function(message) {
	console.log('log:' + message);
});

var Plugin = require('./Plugin.js');
var semver = require('semver');
var PluginManager = require('./PluginManager.js');
var Workspace = require('./Workspace.js');
var ApplicationError = require('./ApplicationError.js');
var EventEmitter = require('events').EventEmitter;

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
	
	if( argv && argv.debug ) this.debug = true;
	
	this.ee = new EventEmitter();
	
	if( this.debug ) {
		this.on('loaded', function() {
			console.log('* plexi application loaded');
		}).on('detected', function(plugin) {
			console.log('* [' + plugin.identifier + '] plugin detected!');
		}).on('bound', function(plugin) {
			console.log('* [' + plugin.identifier + '] plugin bound!');
		}).on('started', function(plugin) {
			console.log('* [' + plugin.identifier + '] plugin started!');
		}).on('stopped', function(plugin) {
			console.log('* [' + plugin.identifier + '] plugin stopped!');
		}).on('detect-error', function(plugin) {
			console.log('* [' + plugin.identifier + '] plugin error!');
		}).on('require', function(pluginId, plugin, caller, exports) {
			console.log('* [' + caller.identifier + '] plugin require "' + pluginId + '" [' + plugin.identifier + ']');
			console.log('\texports: ', exports);
		});
	}
	
	this.load(homedir, argv);
};

Application.prototype = {
	load: function(homedir, argv) {
		var home = this.HOME = this.home = homedir;
		
		var pkg = require(path.join(home, 'package.json'));
		var plexipkg = require('../package.json');
		var plexi = pkg.plexi || {};
		var dependencies = plexi.dependencies || {};
		var version = plexipkg.version;
		
		var preferences, env, links;
		
		if( !argv.ignorelinks ) {
			var linksfile = path.join(home, '.plexilinks');
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
			var pref_js_file = path.join(home, 'plexi.js');
			var pref_json_file = path.join(home, 'plexi.json');
			
			if( fs.existsSync(pref_js_file) && fs.statSync(pref_js_file).isFile() ) {
				preferences = require(pref_js_file);
				this.PREFERENCES_FILE = pref_js_file;
			} else if( fs.existsSync(pref_json_file) && fs.statSync(pref_json_file).isFile() ) {
				preferences = require(pref_json_file);
				this.PREFERENCES_FILE = pref_json_file;
			} else {
				preferences = {};
			}
		}
		
		// read env
		env = preferences.env || {};
		
		this.PLUGINS_DIR = path.join(home, env['plugins.dir'] || 'plexi_modules');
		this.WORKSPACE_DIR = path.join(home, env['workspace.dir'] || 'workspace');
		this.LOG_DIR = path.join(home, env['log.dir'] || 'logs');
		
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
		
		properties['home'] = this.HOME;
		properties['plexi.version'] = version;
		properties['preferences.file'] = this.PREFERENCES_FILE;
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
		this.links = links;
		this.properties = properties;
		this.preferences = preferences.preferences || {};
		this.workspaces = {};
		this.plugins = new PluginManager(this);
		
		// set host plugin
		this.plugins.host(new Plugin(this, process.cwd()));
		
		this.detect();
		this.emit('loaded', this);
	},
	detect: function() {
		// links 가 있다면 활성화
		var links = this.links;
		if( links ) {
			for(var i=0; i < links.length; i++) {
				var link = links[i];
				if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
					var descriptor = new PluginDescriptor(this, link);
					if( !this.plugins.get(descriptor.id) ) {
						console.warn('* [' + descriptor.id + '] already exists version', dir);
					} else {
						this.plugins.add(descriptor.instantiate());
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
	
				var dir = path.join(this.PLUGINS_DIR, dirname);
				if( fs.statSync(dir).isDirectory() ) {
					var descriptor = new PluginDescriptor(this, dir);
					if( !this.plugins.get(descriptor.id) ) {
						console.warn('* [' + descriptor.id + '] already exists version', dir);
					} else {
						this.plugins.add(descriptor.instantiate());
					}
				}
			}
		}
	},
	start: function() {
		var host = this.plugins.host();
		if( host ) host.start();
		this.emit('application-started', this);
		return this;
	},
	plugins: function() {
		return this.plugins;
	},
	link: function(link) {
		if( link && fs.existsSync(link) && fs.statSync(link).isDirectory() ) {
			var plugin = new Plugin(this, link);
			this.plugins.add(plugin);
		} else {
			console.warn(('[WARN] .plexilinks : "' + link + '" does not exists, ignored.').underline.bgBlack.yellow);
		}
	},
	installAll: function(fn) {
		if( fn && typeof(fn) !== 'function' ) throw new ApplicationError('illegal_arguments', fn);
		
		var debug = this.debug;
		if( !fn ) fn = function(err, results) {
			if( debug ) return console.error('* plugin install error'.red, err);
			console.log('* plugin installed'.green, results);
		}; 
			
		var pkg = require(path.join(this.home, 'package.json'));
		var plexi = pkg.plexi || {};
		var dependencies = plexi.dependencies || {};
		var async = require('async');
		
		var tasks = [];
		var plugins = this.plugins;
		for(var pluginId in dependencies) {
			var version = dependencies[pluginId];
			
			tasks.push((function(pluginId, version) {
				return function(callback) {
					plugins.install(pluginId, version, function(err, result) {
						callback(err, result);
					});
				};
			})(pluginId, version));
		}
		
		async.series(tasks, function(err, results){
			fn(err, results);
		});
		return this;
	},
	uninstallAll: function(fn) {
		if( fn && typeof(fn) !== 'function' ) throw new ApplicationError('illegal_arguments', fn);
		
		var debug = this.debug;
		if( !fn ) fn = function(err, results) {
			if( debug ) return console.error('* plugin uninstall error'.red, err);
			console.log('* plugin uninstalled'.green, results);
		}; 
			
		var pkg = require(path.join(this.home, 'package.json'));
		var plexi = pkg.plexi || {};
		var dependencies = plexi.dependencies || {};
		var async = require('async');
		
		var tasks = [];
		for(var pluginId in dependencies) {
			var version = dependencies[pluginId] || '*';
			tasks.push(function(callback) {
				this.plugins.uninstall(pluginId, version, function(err, result) {
					callback(err, result);				
				});
			});
		}
		
		async.series(tasks, function(err, results){
			fn(err, results);
		});
		return this;
	},
	workspace: function(pluginId) {
		if( !pluginId ) throw new ApplicationError('missing:pluginId');

		if( typeof(pluginId) === 'object' && pluginId.pluginId ) {
			pluginId = pluginId.pluginId;
		}

		if( typeof(pluginId) !== 'string' ) throw new ApplicationError('invalid:pluginId:' + pluginId);

		var ws = this.workspaces[pluginId];
		if( !ws ) {
			ws = new Workspace(this.WORKSPACE_DIR, pluginId);
			this.workspaces[pluginId] = ws;
		}

		return ws;
	},
	preference: function(identifier) {
		var prefs = this.preferences;
		if( prefs ) {			
			var pref = prefs[pluginId];
			
			if( version ) {
				pref = prefs[pluginId + '@' + version] || pref;
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


module.exports = Application;
