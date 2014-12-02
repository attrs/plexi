var path = require('path');
var fs = require('fs');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;
var util = require("util");
var ApplicationError = require('./ApplicationError.js');
var Logger = require('./Logger.js');

// Plugin Context
var PluginContext = function PluginContext(plugin) {
	Object.defineProperty(this, 'plugin', {
		value: plugin,
		enumerable: true,
		configurable: false,
		writable: false
	});
	
	Object.defineProperty(this, 'application', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.application;
		}
	});
	
	Object.defineProperty(this, 'identifier', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.identifier;
		}
	});
	
	Object.defineProperty(this, 'preference', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.preference;
		}
	});

	Object.defineProperty(this, 'pluginId', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.pluginId;
		}
	});

	Object.defineProperty(this, 'version', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.version;
		}
	});

	Object.defineProperty(this, 'home', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.home;
		}
	});

	Object.defineProperty(this, 'workspace', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.workspace;
		}
	});

	Object.defineProperty(this, 'plugins', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.application.plugins;
		}
	});

	Object.defineProperty(this, 'logger', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.logger;
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
	require: function(pluginId) {
		var current = this.plugin;
		
		var version = current.dependencies[pluginId];
		if( !version ) throw new ApplicationError('not found dependency:' + pluginId);
		if( !semver.valid(version) ) version = '*';
		var plugin = this.plugin.application.plugins.get(pluginId, version);
		
		if( plugin ) {
			//console.log('\t- require -----------------------------------');
			if( ~[Plugin.STATUS_DETECTED, Plugin.STATUS_STOPPED].indexOf(plugin.status) ) {
				//console.log('\t- plugin', plugin.identifier.toString());
				//console.log('\t- caller', current.identifier.toString());
				
				plugin.start();
			} else if( plugin.status === Plugin.STATUS_ERROR ) {
				throw new ApplicationError('plugin status is error', plugin.identifier.toString());
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

			this.application.emit('require', pluginId, plugin, current, result);			
			//console.log('\t- [' + plugin.identifier.toString() + '] exports', plugin.exports, result);

			return result;
		} else {
			throw new ApplicationError('[' + current.identifier + ']: dependency plugin [' + pluginId + '] not found');
		}
	}
};



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

// class Plugin
var Plugin = (function() {
	"use strict"
	
	function Plugin(descriptor) {
		if( !(descriptor instanceof PluginDescriptor) ) throw new ApplicationError('illegal_argument:PluginDescriptor', descriptor);
		
		readonly(this, 'descriptor', descriptor);
		readonly(this, 'dir', descriptor.dir);
		readonly(this, 'id', descriptor.id);
		readonly(this, 'name', descriptor.name);
		readonly(this, 'version', descriptor.version);
		readonly(this, 'manifest', descriptor.manifest);
		readonly(this, 'application', descriptor.application);
		readonly(this, 'activator', descriptor.activator);
		readonly(this, 'dependencies', descriptor.dependencies);
		
		var preference = application.preference(descriptor.id) || {};
		var ctx = new PluginContext(this);
		var logger = new Logger(path.join(application.LOG_DIR, this.id.toString()));
				
		readonly(this, 'preference', preference);
		readonly(this, 'ctx', ctx);
		
		getset(this, 'workspace', {
			get: function() {
				return application.workspace(this);
			}
		});
		
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
		
		var starter = function emptyStarter() { console.warn('* [' + descriptor.id + '] executed empty starter'); },
			stopper = function emptyStopper() { console.warn('* [' + descriptor.id + '] executed empty stopper'); };
		if( this.activator ) {
			var activatorjs = require(path.resolve(this.dir, this.activator));

			if( typeof(activatorjs) === 'function' ) {
				starter = activatorjs;
			} else if( typeof(activatorjs) === 'object' ) {
				starter = typeof(activatorjs.start) === 'function' ? (function(scope) {
					return function(ctx) {
						scope.start(ctx);
					};
				})(activatorjs) : starter;
				stopper = typeof(activatorjs.stop) === 'function' ? (function(scope) {
					return function(ctx) {
						scope.stop(ctx);
					};
				})(activatorjs) : stopper;
			}
		} else if( this.manifest.main ) {
			var mainjs = require(path.resolve(this.dir, this.manifest.main));
			starter = function mainStarter() {
				console.warn('* [' + descriptor.id + '] has no activator, executed main instead');
				return mainjs;
			};
		}
		
		readonly(this, 'starter', starter);
		readonly(this, 'stopper', stopper);
		
		readonly(this, 'start', function() {
			if( this.isStarted() ) {
				console.warn('already_started:' + this.id + ':' + this.version);
				return false;
			}
		
			var dependencies = this.dependencies;
			for(var name in dependencies) {
				if( name === self.name ) continue;
				ctx.require(name);
			}
		
			this.exports = null;
			var result = this.starter(this.ctx);
			if( result ) this.exports = result;
		
			status = Plugin.STATUS_STARTED;
			this.application.emit('started', this);
			return true;
		}, false);
		
		readonly(this, 'stop', function() {
			if( this.isStarted() ) {
				var activator = this.activator;
				this.stopper(this.ctx);
		
				status = Plugin.STATUS_STOPPED;
				this.application.emit('stopped', this);
				
				return true;
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
		if( !version || typeof(version) !== 'string' ) throw new ApplicationError('illegal:version:' + version);
		
		readonly(this, 'name', name);
		readonly(this, 'version', version);
	};

	PluginIdentifier.prototype = {
		is: function(match) {
			return semver.satisfies(this.version, match);
		},
		toString: function() {
			return this.name + '@' + this.version;
		}
	};
	
	return PluginIdentifier;
})();


// class PluginDescriptor
var PluginDescriptor = (function() {
	"use strict"
	
	function PluginDescriptor(application, dir) {
		if( !application ) throw new ApplicationError('illegal_argument:application', application);
		if( !dir || typeof(dir) !== 'string' ) throw new ApplicationError('illegal_argument:dir', dir);
		
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
		
		readonly(this, 'id', id);
		readonly(this, 'dir', dir);
		readonly(this, 'name', name);
		readonly(this, 'version', version);
		readonly(this, 'manifest', manifest);
		readonly(this, 'activator', plexi && plexi.activator);
		readonly(this, 'dependencies', plexi && plexi.dependencies);
	
		var instance;
		this.instantiate = function() {
			return instance || (instance = new Plugin(this));
		};
	}
	
	return PluginDescriptor;
})();


module.exports = PluginDescriptor;
