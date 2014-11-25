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
		var caller = this.plugin;
		
		var plugin = caller.dependencies[pluginId];
		if( plugin ) {
			if( plugin.status !== Plugin.STATUS_STARTED ) plugin.start();

			var exports = plugin.exports || {};			
			var result = {};
			
			for(var key in exports) {
				var o = exports[key];
				if( typeof(o) === 'function' ) {
					exports[key] = (function(o) {
						return function() {
							return o.apply(caller, arguments);
						}
					})(o);
				}
			}

			return result;
		} else {
			throw new ApplicationError('[' + caller.pluginId + '-' + caller.version + ']: imported plugin [' + pluginId + '] is found');
		}

		return null;
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
Plugin.STATUS_STARTING = 'starting';
Plugin.STATUS_STOPPED = 'stopped';
Plugin.STATUS_STOPPING = 'stopping';
Plugin.STATUS_ERROR = 'error';

Plugin.prototype = {
	path: function(f) {
		return path.join(this.home, f);
	},
	detect: function detect() {
		var manifest = require(path.join(this.home, 'package.json'));
		var pluginId = manifest.name;
		var version = manifest.version;
		var plexi = manifest.plexi || {};
		
		if( !pluginId || typeof(pluginId) !== 'string' )
			throw new ApplicationError('package_error:package.json/name', manifest);
		if( !version || typeof(version) !== 'string' )
			throw new ApplicationError('package_error:package.json/version', manifest);
		
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
				//if( typeof(o) !== 'object' ) throw new ApplicationError('plugin.exports must be an object');
				if( !o ) return console.warn('exports was null', o); 
				exports = o;
			}
		});
		
		Object.defineProperty(this, 'dependencies', {
			enumerable: true,
			configurable: true,
			value: plexi.dependencies || {}
		});
		
		this.status = Plugin.STATUS_DETECTED;
	},
	start: function start() {
		if( this.status === Plugin.STATUS_STARTED ) {
			console.warn('cannot_start:already_started:' + this.identity + ':' + this.version);
			return;
		}
		
		console.log('* starting ' + this.identity + '...');
		
		var ctx = this.ctx;
		var dependencies = this.dependencies;
		for(var pluginId in dependencies) {
			if( pluginId === this.pluginId ) continue;
			ctx.require(pluginId);
		}
		
		var activator = this.activator;
		var result;
		if( activator && typeof(activator.start) === 'function' ) {
			result = activator.start.apply(this, [this.ctx]);

			if( typeof(result) === 'function' ) {
				this.status = Plugin.STATUS_STARTING;
				var self = this;
				result(function(err) {
					if( err ) {
						self.status = Plugin.STATUS_ERROR;
						self.error = err;
						console.error('plugin_start_error:' + this.identity + ':' + err.message, err);
						return;
					}

					self.status = Plugin.STATUS_STARTED;
				});
			} else {
				this.status = Plugin.STATUS_STARTED;
			}
		} else {
			this.status = Plugin.STATUS_STARTED;
		}
		
		console.log('* started ' + this.identity);

		return result;
	},
	stop: function stop() {
		if( this.status !== Plugin.STATUS_STARTED ) {
			console.warn('cannot_stop:not_started_yet:' + this.identity + ':' + this.status);
			return;
		}

		var activator = this.activator;
		var result;
		if( activator && typeof(activator.stop) === 'function' ) {
			result = activator.stop.apply(this, [this.ctx]);

			if( typeof(result) === 'function' ) {
				var self = this;
				result(function(err) {
					if( err ) {
						self.status = Plugin.STATUS_ERROR;
						self.error = err;
						console.error('plugin_stop_error:' + this.identity + ':' + err.message, err);
						return;
					}

					self.status = Plugin.STATUS_STOPPED;
				});
			} else {
				this.status = Plugin.STATUS_STOPPED;
			}
		} else {
			this.status = Plugin.STATUS_STOPPED;
		}

		return result;
	}
};


module.exports = Plugin;
