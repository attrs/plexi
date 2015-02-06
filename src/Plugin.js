var path = require('path');
var fs = require('fs');
var semver = require('semver');
var chalk = require('chalk');
var EventEmitter = require('events').EventEmitter;
var util = require("util");
var ApplicationError = require('./ApplicationError.js');
var Logger = require('./Logger.js');
var Workspace = require('./Workspace.js');

// define util functions
function readonly(o, name, value, enumerable) {
	Object.defineProperty(o, name, {
		value: value,
		enumerable: enumerable === false ? false : true,
		configurable: false,
		writable: false
	});
}

function getset(o, name, gettersetter, enumerable) {
	Object.defineProperty(o, name, {
		get: gettersetter.get,
		set: gettersetter.set,
		enumerable: enumerable === true ? false : true,
		configurable: false			
	});
}

function error(id, err) {
	if( err instanceof Error ) {
		console.error('\n' + chalk.bold('[' + id + '] ') + chalk.red(err.name + ': ') + chalk.bold(err.message));
		if( err.stack ) console.error(chalk.white(err.stack.split(err.name + ': ' + err.message + '\n').join('')) + '\n');
	} else {
		console.error('\n' + chalk.bold('[' + id + '] ') + chalk.bold(err));
		var err = new Error();
		console.error(chalk.white(err.stack.split(err.name + ': ' + err.message + '\n').join('')) + '\n');
	}
}


// Plugin Context
var PluginContext = function PluginContext(plugin) {
	if( !(plugin instanceof Plugin) ) throw new ApplicationError('illegal_arguments:plugin', plugin);
	
	readonly(this, 'plugin', plugin);
	
	readonly(this, 'descriptor', plugin.descriptor);
	readonly(this, 'registry', plugin.application.registry);
	readonly(this, 'application', plugin.application);
	readonly(this, 'home', plugin.home);
	readonly(this, 'dir', plugin.dir);
	readonly(this, 'id', plugin.id);
	readonly(this, 'name', plugin.name);
	readonly(this, 'logger', plugin.logger);
	readonly(this, 'version', plugin.version);
	readonly(this, 'manifest', plugin.manifest);
	readonly(this, 'activator', plugin.activator);
	readonly(this, 'dependencies', plugin.dependencies);
	readonly(this, 'workspace', plugin.workspace);
	readonly(this, 'preference', plugin.preference);
	readonly(this, 'dynamicRequire', plugin.dynamicRequire);
	
	getset(this, 'status', {
		get: function() {
			return plugin.status;
		}
	});
	
	getset(this, 'exports', {
		get: function() {
			return plugin.exports;
		},
		set: function(o) {
			plugin.exports = o;
		}
	});
};

PluginContext.prototype = {
	on: function(event, fn) {
		this.plugin.application.on(event, fn);
	},
	off: function(event, fn) {
		this.plugin.application.off(event, fn);
	},
	plugin: function(name) {
		var id = PluginIdentifier.parse(name);		
		var version = id.version || current.dependencies[id.name] || 'latest';
		return this.application.plugins.maxSatisfy(id.name, version);
	},
	require: function(name) {
		if( name === 'plexi' ) return this.application;
		
		try {			
			var id = PluginIdentifier.parse(name);
			
			if( !this.dynamicRequire && !this.dependencies[id.name] )
				throw new ApplicationError('[' + this.id + '] cannot access non-dependency plugin [' + id + ']');
			
			var current = this.plugin;
			var version = id.version || this.dependencies[id.name] || 'latest';
			var plugin = this.application.plugins.maxSatisfy(id.name, version);
				
			if( plugin ) {
				if( plugin.status === Plugin.STATUS_ERROR ) throw new ApplicationError('dependency plugin is error state [' + plugin.id + ']');
				
				if( !plugin.isStarted() ) {
					//console.log('\t- plugin', plugin.id);
					//console.log('\t- caller', current.id);				
					plugin.start();
				}

				var exports = plugin.exports || {};
				var result = {};
			
				for(var key in exports) {
					var o = exports[key];
					if( typeof(o) === 'function' ) {
						result[key] = (function(o) {
							return function() {
								return o.apply(current, arguments);
							}
						})(o);
					} else {
						result[key] = o;
					}
				}

				this.application.emit('require', name, plugin, current, result);			
				//console.log('\t- [' + plugin.id + '] exports', plugin.exports, result);

				return result;
			} else {
				throw new ApplicationError('not found dependency plugin [' + name + '@' + version + ']');
			}
		} catch(err) {
			error(this.id, err);
			this.application.emit('requireerror', this.plugin, err);
		}
		
		return null;
	}
};

// class Plugin
var Plugin = (function() {
	"use strict"
	
	function Plugin(descriptor) {
		if( !(descriptor instanceof PluginDescriptor) ) throw new ApplicationError('illegal_argument:PluginDescriptor', descriptor);
		
		var app = descriptor.application;
		
		readonly(this, 'application', descriptor.application);
		readonly(this, 'home', descriptor.application.home);
		readonly(this, 'descriptor', descriptor);
		readonly(this, 'dir', descriptor.dir);
		readonly(this, 'id', descriptor.id);
		readonly(this, 'name', descriptor.name);
		readonly(this, 'version', descriptor.version);
		readonly(this, 'manifest', descriptor.manifest);
		readonly(this, 'dynamicRequire', descriptor.dynamicRequire);
		readonly(this, 'activator', descriptor.activator);
		readonly(this, 'dependencies', descriptor.dependencies || {});
		readonly(this, 'preference', app.preference(this.id) || {});
		readonly(this, 'logger', new Logger(path.join(app.LOG_DIR, this.id.toString())));
		readonly(this, 'workspace', new Workspace(this));
			
		readonly(this, 'ctx', new PluginContext(this));		
				
		var exports = {};
		getset(this, 'exports', {
			get: function() {
				return exports;
			},
			set: function(o) {
				exports = o;
			}
		});
		
		var status = Plugin.STATUS_DETECTED;
		getset(this, 'status', {
			get: function() {
				return status;
			}
		});
		
		var starter = function EmptyStarter() { if( app.debug ) console.warn('* [' + descriptor.id + '] executed empty starter'); },
			stopper = function EmptyStopper() { if( app.debug ) console.warn('* [' + descriptor.id + '] executed empty stopper'); };
		
		if( this.activator ) {
			var activatorjs = require(path.resolve(this.dir, this.activator));

			if( typeof(activatorjs) === 'function' ) {
				starter = activatorjs;
			} else if( typeof(activatorjs) === 'object' ) {
				starter = typeof activatorjs.start === 'function' ? activatorjs.start : starter;
				stopper = typeof activatorjs.stop === 'function' ? activatorjs.stop : stopper;
			}
		} else if( this.manifest.main ) {
			var mainjs = require(this.dir);
			starter = function() {
				if( app.debug ) console.warn('* [' + descriptor.id + '] has no activator, executed main instead');
				return mainjs;
			};
		}
		
		readonly(this, 'starter', starter);
		readonly(this, 'stopper', stopper);
		
		readonly(this, 'start', function() {
			if( this.isStarted() || this.status === Plugin.STATUS_ERROR ) return false;
			
			try {
				status = Plugin.STATUS_STARTED;
			
				exports = null;
				var result = this.starter(this.ctx);
				if( result !== null && result !== undefined ) exports = result;
			
				this.application.emit('started', this);
				return true;
			} catch(err) {
				status = Plugin.STATUS_ERROR;
				error(this.id, err);
				this.application.emit('starterror', this, err);
			}
			
			return false;
		}, false);
		
		readonly(this, 'stop', function() {
			if( this.isStarted() ) {
				try {
					var activator = this.activator;
					this.stopper(this.ctx);
		
					status = Plugin.STATUS_STOPPED;
					this.application.emit('stopped', this);
				
					return true;
				} catch(err) {
					error(this.id, err);
					this.application.emit('stoperror', this, err);
				}
			}
			
			return false;
		}, false);
			
		this.application.emit('detected', this);
	};

	Plugin.STATUS_DETECTED = 'detected';
	Plugin.STATUS_STARTED = 'started';
	Plugin.STATUS_STOPPED = 'stopped';
	Plugin.STATUS_ERROR = 'error';

	Plugin.prototype = {
		path: function(f) {
			return path.join(this.dir, f);
		},
		isStarted: function() {
			return (this.status === Plugin.STATUS_STARTED);		
		}
	};
	
	return Plugin;
})();


// class PluginIdentifier
var PluginIdentifier = (function() {
	"use strict"
	
	function PluginIdentifier(name, version) {
		if( !name || typeof(name) !== 'string' ) throw new ApplicationError('illegal:name:' + name);
		
		version = version ? (semver.clean(version) || version) : version;
		
		readonly(this, 'name', name);
		readonly(this, 'version', version);
		
		if( version ) {
			var v = semver.parse(version);
			if( v ) {
				readonly(this, 'semver', v);
				readonly(this, 'major', v.major);
				readonly(this, 'minor', v.minor);
				readonly(this, 'patch', v.patch);
			}
		}
	};

	PluginIdentifier.prototype = {
		satisfies: function(v) {
			if( !this.version ) return false;
			return semver.satisfies(this.version, v);
		},
		is: function(v) {
			v = semver.clean(v) || v;
			return this.version === v;
		},
		toString: function() {
			if( !this.version ) return this.name;
			return this.name + '@' + this.version;
		}
	};
	
	PluginIdentifier.parse = function(str) {
		if( str instanceof Plugin ) return str.id;
		if( str instanceof PluginIdentifier ) return str;
		
		var name, version, pos;
		
		if( ~(pos = str.indexOf('@')) ) {
			name = str.substring(0, pos);
			version = str.substring(pos + 1);
		} else {
			name = str;
		}
		
		if( ~str.indexOf('/') ) throw new ApplicationError('invalid_identifier_string:' + str);
					
		return new PluginIdentifier(name, version);
	};
	
	return PluginIdentifier;
})();


// class PluginDescriptor
var PluginDescriptor = (function() {
	"use strict"
	
	function PluginDescriptor(application, dir) {
		if( !application ) throw new ApplicationError('illegal_argument:application', application);
		if( !dir || typeof(dir) !== 'string' ) throw new ApplicationError('illegal_argument:dir', dir);
		
		dir = path.normalize(path.resolve(application.home, dir));
		
		var packagefile = path.resolve(dir, 'package.json');	
		var manifest = require(packagefile);
		var name = manifest.name;
		var version = semver.clean(manifest.version) || manifest.version;
		var id = new PluginIdentifier(name, version);
		var plexi = manifest.plexi || {};
	
		if( !name || typeof(name) !== 'string' )
			throw new ApplicationError('missing_name:' + packagefile + '/name', manifest);
		if( !version || !semver.valid(version) )
			throw new ApplicationError('invalid_version:' + packagefile + '/version', manifest);

		readonly(this, 'application', application);
		readonly(this, 'id', id);
		readonly(this, 'dir', dir);
		readonly(this, 'name', name);
		readonly(this, 'version', version);
		readonly(this, 'manifest', manifest);
		readonly(this, 'activator', plexi && plexi.activator);
		readonly(this, 'dependencies', plexi && plexi.dependencies);
		readonly(this, 'dynamicRequire', manifest.dynamicRequire ? true : false);
	
		var instance;
		this.instantiate = function() {
			return instance || (instance = new Plugin(this));
		};
	}
	
	return PluginDescriptor;
})();


module.exports = {
	PluginDescriptor: PluginDescriptor,
	Plugin: Plugin,
	PluginIdentifier: PluginIdentifier,
	PluginContext: PluginContext
};
