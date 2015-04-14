var path = require('path');
var fs = require('fs');
var semver = require('semver');
var chalk = require('chalk');
var EventEmitter = require('events').EventEmitter;
var util = require("util");
var ApplicationError = require('./ApplicationError.js');
var Logger = require('./Logger.js');
var Workspace = require('./Workspace.js');
var util = require('attrs.util');

var readonly = util.readonly;
var getset = util.getset;


// Plugin Context
var PluginContext = function PluginContext(plugin) {
	if( !(plugin instanceof Plugin) ) throw new ApplicationError('illegal_arguments:plugin', plugin);
	
	readonly(this, 'plugin', plugin);
	readonly(this, 'registry', plugin.application.registry);
	readonly(this, 'application', plugin.application);
	readonly(this, 'id', plugin.id);
	readonly(this, 'name', plugin.name);
	readonly(this, 'version', plugin.version);
	readonly(this, 'dependencies', plugin.dependencies);
	readonly(this, 'workspace', plugin.workspace);
	readonly(this, 'logger', plugin.logger);
	readonly(this, 'preference', plugin.preference);
	readonly(this, 'status', plugin.status);
	readonly(this, 'exports', plugin.exports);
};

PluginContext.prototype = {
	on: function(event, fn) {
		this.application.on(event, fn);
	},
	off: function(event, fn) {
		this.application.off(event, fn);
	},
	plugin: function(name) {
		var id = PluginIdentifier.parse(name);		
		var version = id.version || current.dependencies[id.name] || 'latest';
		return this.application.plugins.maxSatisfy(id.name, version);
	},
	require: function(name) {
		if( name === 'plexi' ) return require('./main.js');
		
		var id = PluginIdentifier.parse(name);
		
		if( !this.dependencies === 'dynamic' && !this.dependencies[id.name] )
			throw new ApplicationError('[' + this.id + '] cannot access non-dependency plugin [' + id + ']');
		
		var current = this.plugin;
		var version = id.version || this.dependencies[id.name] || 'latest';
		var plugin = this.application.plugins.maxSatisfy(id.name, version);
			
		if( plugin ) {
			if( plugin.status === Plugin.STATUS_ERROR ) throw new ApplicationError('dependency plugin is error state [' + plugin.id + ']');
			if( !plugin.isStarted() ) plugin.start();

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
			return result;
		} else {
			throw new ApplicationError('not found dependency plugin [' + name + '@' + version + ']');
		}
		
		return null;
	},
	toString: function() {
		return 'ctx:' + this.id;
	}
};

// class Plugin
var Plugin = (function() {
	"use strict"
	
	function Plugin(descriptor) {
		if( !(descriptor instanceof PluginDescriptor) ) throw new ApplicationError('illegal_argument:PluginDescriptor', descriptor);
		
		var app = descriptor.application;
		var id  = descriptor.id;
		var dir = descriptor.dir;
		var manifest = descriptor.manifest;
		var activator = descriptor.activator;

		readonly(this, 'descriptor', descriptor);
		readonly(this, 'application', app);
		readonly(this, 'id', id);
		readonly(this, 'name', id.name);
		readonly(this, 'version', id.version);
		readonly(this, 'dir', dir);
		readonly(this, 'manifest', manifest);
		readonly(this, 'dependencies', descriptor.dependencies || {});
		readonly(this, 'logger', new Logger(path.join(app.LOG_DIR, id.toString())));
		readonly(this, 'workspace', new Workspace(this));
		
		getset(this, 'preference', {
			get: function() {
				return app.preference(id);
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
		
		var starter = function EmptyStarter() { if( app.debug ) util.warn(this, 'empty starter executed'); },
			stopper = function EmptyStopper() { if( app.debug ) util.warn(this, 'empty stopper executed'); };
		
		if( activator ) {
			var activatorjs = require(path.resolve(dir, activator));

			if( typeof(activatorjs) === 'function' ) {
				starter = activatorjs;
			} else if( typeof(activatorjs) === 'object' ) {
				starter = typeof activatorjs.start === 'function' ? activatorjs.start : starter;
				stopper = typeof activatorjs.stop === 'function' ? activatorjs.stop : stopper;
			}
		} else if( manifest.main ) {
			var mainjs = require(dir);
			starter = function() {
				if( app.debug ) util.warn('* [' + id + '] has no activator, executed main instead');
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
			
				app.emit('started', this);
				return true;
			} catch(err) {
				status = Plugin.STATUS_ERROR;
				app.emit('starterror', this, err);
				throw new ApplicationError('start error: ' + err.message, err);
			}
		}, false);
		
		readonly(this, 'stop', function() {
			if( this.isStarted() ) {
				try {
					var activator = this.activator;
					this.stopper(this.ctx);
		
					status = Plugin.STATUS_STOPPED;
					app.emit('stopped', this);
				
					return true;
				} catch(err) {
					app.emit('stoperror', this, err);
					throw new ApplicationError('stop error: ' + err.message, err);
				}
			}
		}, false);
		
		readonly(this, 'ctx', new PluginContext(this));
			
		app.emit('detected', this);
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
		},
		toString: function() {
			return 'plugin:' + this.id;
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
		readonly(this, 'version', version);
		readonly(this, 'manifest', manifest);
		readonly(this, 'activator', plexi && plexi.activator);
		readonly(this, 'dependencies', plexi && plexi.dependencies);
		readonly(this, 'singleton', plexi && plexi.singleton ? true : false);
	
		var instance;
		this.instantiate = function() {
			return instance || (instance = new Plugin(this));
		};
	}
	
	PluginDescriptor.prototype = {
		toString: function() {
			return 'desc:' + this.id;
		}
	};
	
	return PluginDescriptor;
})();


module.exports = {
	PluginDescriptor: PluginDescriptor,
	Plugin: Plugin,
	PluginIdentifier: PluginIdentifier,
	PluginContext: PluginContext
};
