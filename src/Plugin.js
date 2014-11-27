var path = require('path');
var fs = require('fs');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;
var util = require("util");
var ApplicationError = require('./ApplicationError.js');

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
	
	Object.defineProperty(this, 'identity', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.identity;
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
				//console.log('\t- plugin', plugin.identity.toString());
				//console.log('\t- caller', current.identity.toString());
				
				plugin.start();
			} else if( plugin.status === Plugin.STATUS_ERROR ) {
				throw new ApplicationError('plugin status is error', plugin.identity.toString());
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
			//console.log('\t- [' + plugin.identity.toString() + '] exports', plugin.exports, result);

			return result;
		} else {
			throw new ApplicationError('[' + current.identity + ']: dependency plugin [' + pluginId + '] not found');
		}
	}
};

// Plugin Identity
var PluginIdentity = function PluginIdentity(pluginId, version) {	
	if( !pluginId || typeof(pluginId) !== 'string' ) throw new ApplicationError('missing:pluginId:' + name);
	if( !version || typeof(version) !== 'string' ) throw new ApplicationError('missing:version:' + name);

	Object.defineProperty(this, 'pluginId', {
		value: pluginId,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'version', {
		value: version,
		enumerable: false,
		configurable: false,
		writable: false
	});
};

PluginIdentity.prototype = {
	is: function(match) {
		return semver.satisfies(this.version, match);
	},
	toString: function() {
		return this.pluginId + '@' + this.version;
	}
};


var Plugin = function Plugin(application, dir) {
	if( !application ) throw new ApplicationError('illegal_argument(application):' + application);
	if( typeof(dir) !== 'string' ) throw new ApplicationError('illegal_argument(dir):' + dir);

	Object.defineProperty(this, 'application', {
		value: application,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'home', {
		value: dir,
		enumerable: true,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'workspace', {
		enumerable: false,
		configurable: false,
		get: function() {
			return application.workspace(this);
		}
	});

	var ctx = new PluginContext(this);
	Object.defineProperty(this, 'ctx', {
		enumerable: false,
		configurable: false,
		get: function() {
			return ctx;
		}
	});

	this.detect();
};

Plugin.STATUS_DETECTED = 'detected';
Plugin.STATUS_STARTED = 'started';
Plugin.STATUS_STOPPED = 'stopped';
Plugin.STATUS_ERROR = 'error';

Plugin.prototype = {
	path: function(f) {
		return path.join(this.home, f);
	},
	detect: function detect() {
		var manifest = require(path.join(this.home, 'package.json'));
		var pluginId = manifest.name;
		var version = semver.clean(manifest.version);
		var plexi = manifest.plexi || {};
		
		if( !pluginId || typeof(pluginId) !== 'string' )
			throw new ApplicationError('missing_pluginId:package.json/name', manifest);
		if( !version || !semver.valid(version) )
			throw new ApplicationError('invalid_version:package.json/version', manifest);
		
		Object.defineProperty(this, 'identity', {
			value: new PluginIdentity(pluginId, version),
			enumerable: false,
			configurable: false,
			writable: false
		});

		Object.defineProperty(this, 'pluginId', {
			value: pluginId,
			enumerable: true,
			configurable: false,
			writable: false
		});

		Object.defineProperty(this, 'version', {
			value: version,
			enumerable: true,
			configurable: false,
			writable: false
		});
		
		var application = this.application;
		var preference = this.application.preference(this.pluginId, this.version) || {};	
		var activator = null;
		var exports = {};
					
		if( plexi.activator ) {
			activator = require(path.join(this.home, plexi.activator));
			
			if( typeof(activator) === 'function' ) {
				activator = {start:activator};
			} else if( typeof(activator) === 'object' ) {
				if( typeof(activator.start) !== 'function' ) {
					activator = null;
					console.error('activator.start must be a function', this.identity.toString());
				}
				
				if( activator.stop && typeof(activator.stop) !== 'function' ) {
					activator.stop = null;
					console.error('activator.stop must be a function', this.identity.toString());
				}
			} else {
				activator = null;
				console.error('activator not found. ignored', this.identity.toString());
			}
		}
				
		Object.defineProperty(this, 'activator', {
			value: activator,
			enumerable: true,
			configurable: false,
			writable: false
		});

		Object.defineProperty(this, 'manifest', {
			value: manifest,
			enumerable: true,
			configurable: false,
			writable: false
		});

		Object.defineProperty(this, 'preference', {
			value: preference,
			enumerable: true,
			configurable: false,
			writable: false
		});
		
		Object.defineProperty(this, 'exports', {
			enumerable: true,
			configurable: false,
			get: function() {
				return exports;
			},
			set: function(o) {
				exports = o || {};
			}
		});
		
		Object.defineProperty(this, 'dependencies', {
			enumerable: true,
			configurable: true,
			value: plexi.dependencies || {}
		});
		
		this.status = Plugin.STATUS_DETECTED;
		
		this.application.emit('detected', this);
	},
	start: function start() {
		if( this.status === Plugin.STATUS_STARTED ) {
			console.warn('cannot_start:already_started:' + this.identity.toString() + ':' + this.version);
			return;
		}
		
		var ctx = this.ctx;
		var dependencies = this.dependencies;
		for(var pluginId in dependencies) {
			if( pluginId === this.pluginId ) continue;
			ctx.require(pluginId);
		}
		
		var activator = this.activator;
		var result;
		if( activator && typeof(activator.start) === 'function' ) {
			this.exports = null;
			var result = activator.start.apply(this, [this.ctx]);
			if( result ) this.exports = result;

			this.status = Plugin.STATUS_STARTED;
		}
		
		this.status = Plugin.STATUS_STARTED;
		this.application.emit('started', this);

		return result;
	},
	stop: function stop() {
		if( this.status !== Plugin.STATUS_STARTED ) {
			console.warn('cannot_stop:not_started_yet:' + this.identity.toString() + ':' + this.status);
			return;
		}

		var activator = this.activator;
		var result;
		if( activator && typeof(activator.stop) === 'function' ) {
			result = activator.stop.apply(this, [this.ctx]);
		}
		
		this.status = Plugin.STATUS_STOPPED;		
		this.application.emit('stopped', this);

		return result;
	}
};


module.exports = Plugin;
