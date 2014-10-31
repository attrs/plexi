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
	
	Object.defineProperty(this, 'options', {
		enumerable: true,
		configurable: false,
		get: function() {
			return plugin.options;
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
		
		var plugin = caller.imports[pluginId];
		if( plugin ) {
			if( plugin.type == Plugin.TYPE_SERVICE ) {					
				if( plugin.status !== Plugin.STATUS_STARTED ) plugin.start();

				var exports = plugin.exports;

				if( !exports ) return {};
				
				var result = {};
				for(var key in exports) {
					var o = exports[key];
					if( typeof(o) === 'function' ) {
						result[key] = (function(o) {
							return function() {
								return o.apply(caller, arguments);
							}
						})(o);
					} else {
						result[key] = o;
					}
				}

				return result;
			} else {
				return plugin.exports;
			}
		} else {
			throw new ApplicationError('[' + caller.pluginId + '-' + caller.version + ']: imported plugin [' + pluginId + '] is found');
		}

		return null;
	}
};

// Plugin Identity
var PluginIdentity = function PluginIdentity(name) {
	if( !name || typeof(name) !== 'string' ) throw new ApplicationError('invalid plugin identity:' + name);

	var pos = name.lastIndexOf('@');
	var pluginId = name;
	var version;

	if( pos > 0 ) {
		pluginId = name.substring(0, pos);
		version = name.substring(pos + 1);
		//console.log('version', version, semver.valid(version));
	}
	
	if( !pluginId ) throw new ApplicationError('missing:pluginId:' + name);
	if( !version ) throw new ApplicationError('missing:version:' + name);

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
		return this.pluginId + '(' + this.version + ')';
	}
};


var Plugin = function Plugin(application, dir) {
	var identity = new PluginIdentity(path.basename(dir));

	Object.defineProperty(this, 'application', {
		value: application,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'identity', {
		value: identity,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'pluginId', {
		value: identity.pluginId,
		enumerable: true,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'version', {
		value: identity.version,
		enumerable: true,
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

	var ee = new EventEmitter();
	Object.defineProperty(this, 'ee', {
		enumerable: false,
		configurable: false,
		get: function() {
			return ee;
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
Plugin.TYPE_SERVICE = 'service';
Plugin.TYPE_LIBRARY = 'library';
Plugin.TYPE_INVALID = 'invalid';

Plugin.prototype = {
	path: function(f) {
		return path.join(this.home, f);
	},
	detect: function detect() {
		var manifest_file = path.join(this.home, 'package.json');
		
		if( fs.existsSync(manifest_file) ) {
			var manifest = fs.readFileSync(manifest_file, 'utf-8');
			if( !manifest )
				throw new ApplicationError('plugin_manifest_error:package_json_not_found:' + this.identity + ':' + manifest_file);

			try {
				manifest = JSON.parse(manifest);
			} catch(err) {
				throw new ApplicationError('plugin_manifest_error:package_json_parse_error:' + this.identity + ':' + manifest_file + ':' + err.message, err);
			}

			if( typeof(manifest.name) !== 'string' ) throw new ApplicationError('plugin_manifest_error:manifest.name(pluginId):' + this.identity.toString(), manifest);
			if( typeof(manifest.version) !== 'string' ) throw new ApplicationError('plugin_manifest_error:manifest.version:' + this.identity.toString(), manifest);
			if( typeof(manifest.activator) !== 'string' ) throw new ApplicationError('plugin_manifest_error:manifest.activator:' + this.identity.toString(), manifest);

			if( manifest.name != this.pluginId ) throw new ApplicationError('plugin_manifest_error:pluginId(name)_does_not_match:' + this.identity.toString(), manifest);
			if( manifest.version != this.version ) throw new ApplicationError('plugin_manifest_error:version_does_not_match:' + this.identity.toString(), manifest);
			
			var application = this.application;
			var options = this.application.options(this.pluginId, this.version) || {};	
			var activator = null;
			var exports = {};
			var imports = manifest.imports || {};
						
			if( manifest.activator ) {
				activator = require(path.join(this.home, manifest.activator));
				
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
			
			var type = activator ? Plugin.TYPE_SERVICE : Plugin.TYPE_LIBRARY;
			
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

			Object.defineProperty(this, 'options', {
				value: options,
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
					exports = o;
				}
			});
			
			Object.defineProperty(this, 'imports', {
				enumerable: true,
				configurable: true,
				get: function() {
					var result = {};
					for( var k in imports ) {
						if( !imports.hasOwnProperty(k) ) continue;

						var v = imports[k];
						if( typeof(v) === 'string' ) {
							result[k] = application.get(k, v);
						}
					}
					return result;
				}
			});
			
			Object.defineProperty(this, 'type', {
				value: type,
				enumerable: true,
				configurable: true,
				writable: false
			});
		} else {
			Object.defineProperty(this, 'type', {
				value: Plugin.TYPE_INVALID,
				enumerable: true,
				configurable: true,
				writable: false
			});
			
			this.status = Plugin.STATUS_ERROR;
			return;
		}
		
		this.status = Plugin.STATUS_DETECTED;
	},
	start: function start() {
		if( this.status === Plugin.STATUS_STARTED ) {
			console.warn('cannot_start:already_started:' + this.identity + ':' + this.version);
			return;
		}
		
		console.log('* starting ' + this.identity + '...');
		
		var ctx = this.ctx;
		var imports = this.imports;
		for(var pluginId in imports) {
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
