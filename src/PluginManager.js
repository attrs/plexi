var semver = require('semver');
var Plugin = require('./Plugin.js');
var ApplicationError = require('./ApplicationError.js');

var PluginGroup = (function() {
	"use strict"
	
	var PluginGroup = function PluginGroup(name) {
		Object.defineProperty(this, 'name', {
			value: name,
			enumerable: false,
			configurable: false,
			writable: false
		});
	};

	var fn = PluginGroup.prototype = [];

	fn.get = function(match) {
		if( match === '*' || match === 'latest' ) return this.latest();
		if( !match ) return null;

		for(var i=0; i < this.length; i++) {
			var plugin = this[i];
			var version = semver.clean(plugin.version) || plugin.version;
		
			if( version === match || version === semver.clean(match) ) return plugin;
		}

		return null;
	};
	
	fn.versions = function() {
		var argv = [];
		for(var i=0; i < this.length; i++) {
			var plugin = this[i];
			var version = semver.clean(plugin.version) || plugin.version;
			argv.push(version);
		}
		return argv;
	};
	
	fn.satisfy = function(match) {
		if( match === '*' ) return this.latest();
		if( !match ) return null;

		for(var i=0; i < this.length; i++) {
			var plugin = this[i];
			var version = plugin.version;

			if( semver.satisfies(version, match) ) {
				return plugin;
			}
		}

		return null;
	};
	
	fn.latest = function() {
		return this[0];
	};
	
	fn.push = function(plugin) {
		if( (plugin instanceof Plugin) && plugin.name === this.name ) {
			Array.prototype.push.call(this, plugin);

			this.sort(function compare(a, b) {
				return semver.compare(b.version, a.version);
			});
		} else {
			throw new ApplicationError('invalid_plugin:' + plugin.name, plugin);
		}
	};
	
	fn.toString = function() {
		return '[group:' + this.name + ':' + this.length + ']';
	};
	
	return PluginGroup;
})();

var PluginManager = (function() {
	"use strict"
	
	function PluginManager(app) {
		this.app = app;
		this.groups = {};
	}
	
	function parseIdentifier(identifier) {
		var name
	}

	PluginManager.prototype = {
		host: function(plugin) {
			if( !arguments.length ) return this._host;
			this.add(plugin);
			this._host = plugin;
			return this;
		},
		isHost: function(plugin) {
			return (this._host === plugin) ? true : false;	
		},
		add: function(plugin) {
			if( !(plugin instanceof Plugin) ) throw new ApplicationError('illegal_arguments:plugin', plugin);
			var group = this.groups[plugin.name];
			if( !group ) group = this.groups[plugin.name] = new PluginGroup(plugin.name);
			group.push(plugin);
			this.app.emit('bound', plugin);
			return this;
		},
		get: function(identifier) {
			var parsed = parseIdentifier(identifier);
			if( !parsed ) return console.error('invalid identifier', identifier);
						
			var group = this.groups[parsed.name];
			if( !group ) return console.error('plugin not found', identifier);
			
			return group.satisfy(parsed.version);
		},
		exists: function(identifier) {
			return this.get(identifier) ? true : false;
		},
		group: function(name) {
			return this.groups[name];
		},
		ids: function() {
			var result = [];
			for(var k in this.groups) {
				result.push(k);
			}
			return result;	
		},
		all: function() {
			var result = [];
			for(var k in this.groups) {
				var group = this.groups[k];
				if( group && (group instanceof PluginGroup) ) {
					var plugins = group.versions();
				
					for(var j=0; j < plugins.length; j++) {
						var plugin = plugins[j];
						result.push(plugin);
					}
				}
			}
			return result;
		},	
		// control
		start: function(identifier) {
			var plugins = this.get(identifier);
		
			var group = this.groups[pluginId];
			var plugin = group.get(version);
			if( !plugin ) throw new ApplicationError('not_found:' + pluginId + '@' + version);
			plugin.start();
			return this;
		},
		stop: function(identifier) {
			if( !arguments.length || !pluginId ) return console.error('illegal_arguments:pluginId');
			if( !version ) version = '*';
		
			var group = this.groups[pluginId];
			var plugin = group.get(version);
			if( !plugin ) throw new ApplicationError('not_found:' + pluginId + '@' + version);
			plugin.stop();
			return this;
		},
		install: function(identifier, fn) {
			if( !identifier ) throw new ApplicationError('invalid_plugin_identifier:' + identifier);
			if( fn && typeof(fn) !== 'function' ) throw new ApplicationError('illegal_arguments(fn)', fn);
			if( !fn ) fn = function() {}
				
			var npm = require('npm');
			var async = require('async');
			var path = require('path');
			var fs = require('fs');
		
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
		
			var pluginsdir = this.app.PLUGINS_DIR;
			var tmpdir = path.resolve(this.app.PLUGINS_DIR, '-temp');
		
			rmdirRecursive(tmpdir);
		
			var err, results = [], self = this;
			var q = async.queue(function (task, callback) {
				var identifier = task.identifier;
			
				if( self.exists(identifier) ) {
					console.log('* [' + identifier + '] is already exists.');
					callback();
					return;
				}
		    
				console.log('* installing ' + identifier);
				npm.load(function(err) {
					if(err) return callback('[' + identifier + '] npm load error:' + err);
				
					npm.commands.install(tmpdir, identifier, function (err, data) {
						if(err) return callback('[' + identifier + '] npm install error:' + err);
					
						try {
							console.log('data', data[data.length - 1][1]);
							var downloaded = path.resolve(process.cwd(), data[data.length - 1][1]);
							console.log('* [' + identifier + '] downloaded "' + downloaded + '"');
						
							var pkg = require(path.resolve(downloaded, 'package.json'));
						
							var npmname = pkg.name;
							var npmversion = pkg.version;
							var npmplexi = pkg.plexi;
						
							console.log('* name', npmname);
							console.log('* version', npmversion);
							console.log('* plexi', npmplexi);
						
							if( !npmname || !npmversion ) {
								console.error('[' + identifier + '] package.json error', pkg);
								callback('[' + identifier + '] package.json error(illegal name or version)');
								return;
							}
													
							if( npmplexi && npmplexi.dependencies ) {
								for(var name in npmplexi.dependencies) {
									var v = npmplexi.dependencies[name];
									if( ~v.indexOf('://') ) q.push({identifier:v});
									else q.push({identifier: (( v && v !== '*' ) ? (name + '@\'' + v + '\'') : name)});							
								}
							}
						
							var targetdir = path.resolve(pluginsdir, (npmname + '@' + npmversion));
							if( fs.existsSync(downloaded) && !fs.existsSync(targetdir) ) fs.renameSync(downloaded, targetdir);
					
							results.push(identifier);
							callback();
						} catch(error) {
							console.error(error.message, error.stack);
							callback(error.message);
						}
					});
				});
			}, 1);
		
			q.drain = function() {
			    console.log('* queue finished!', err, results);
				fn(err, results);
				rmdirRecursive(tmpdir);
			};
		
			q.push({identifier: identifier}, function (err) {
				if( err ) console.log('* error occured', err);
			});
		},
		unintall: function(identifier, fn) {
		
		}
	};
	
	return PluginManager;	
})();

module.exports = PluginManager;