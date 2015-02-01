var semver = require('semver');
var npm = require('npm');
var async = require('async');
var path = require('path');
var fs = require('fs');
var colors = require('colors');

var Plugin = require('./Plugin.js').Plugin;
var PluginDescriptor = require('./Plugin.js').PluginDescriptor;
var PluginIdentifier = require('./Plugin.js').PluginIdentifier;
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
		if( !match ) return this[0];
		
		match = semver.clean(match) || match;

		for(var i=0; i < this.length; i++) {
			var plugin = this[i];		
			if( plugin.version === match ) return plugin;
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
	
	fn.maxSatisfy = function(match) {
		if( !match || ~match.indexOf('/') || match.indexOf('file:') ) match = '*';
		if( match.toLowerCase() === 'latest' || match === '*' ) return this.latest();
		
		if( !semver.valid(match) && !semver.validRange(match) ) throw new ApplicationError('invalid version range(' + this.name + '/package.json/plexi.dependencies):' + match);
				
		for(var i=0; i < this.length; i++) {
			var plugin = this[i];
			var version = plugin.version;
			
			var v = semver.parse(version);
			if( v ) version = [v.major, v.minor, v.patch].join('.');
				
			if( semver.satisfies(version, match) ) {
				return plugin;
			}
		}

		return null;
	};
	
	fn.satisfies = function(match) {
		if( !match || ~match.indexOf('/') || match.indexOf('file:') ) version = '*';
		
		if( match === '*' ) return this.slice();
		if( match === 'latest' ) return [this.latest()];
		if( !match ) return [];
		
		if( !semver.valid(match) && !semver.validRange(match) ) throw new ApplicationError('invalid version range(' + this.name + '/package.json/plexi.dependencies):' + match);
		
		var arg = [];
		for(var i=0; i < this.length; i++) {
			var plugin = this[i];
			var version = plugin.version;
			
			var v = semver.parse(version);
			if( v ) version = [v.major, v.minor, v.patch].join('.');
			
			if( semver.satisfies(version, match) ) {
				arg.push(plugin);
			}
		}

		return arg.length ? arg : null;
	};
	
	fn.latest = function() {
		return this[0];
	};
	
	fn.drop = function(version) {
		var plugins = ( version instanceof Plugin ) ? [version] : this.satisfies(version);
		if( !plugins || !plugins.length ) return false;
		
		var self = this;
		plugins.forEach(function(plugin) {
			for(var index;(index = self.indexOf(plugin)) >= 0;) {
				self.splice(index, 1);
			}
		});
		
		this.sort(function compare(a, b) {
			return semver.compare(b.version, a.version);
		});
		
		return plugins;
	};
	
	fn.push = function(plugin) {
		if( (plugin instanceof Plugin) && plugin.name === this.name ) {
			if( ~this.indexOf(plugin) ) return this;
			Array.prototype.push.call(this, plugin);

			this.sort(function compare(a, b) {
				return semver.compare(b.version, a.version);
			});
		} else {
			throw new ApplicationError('invalid_plugin:' + plugin.name, plugin);
		}
		
		return this;
	};
	
	fn.toString = function() {
		return '[group:' + this.name + ':' + this.length + ']';
	};
	
	return PluginGroup;
})();




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

// class PluginManager
var PluginManager = (function() {
	"use strict"
	
	function PluginManager(app) {
		this.app = app;
		this.groups = {};
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
		drop: function(name, version) {
			if( name instanceof Plugin ) {
				version = name.version;
				name = name.name;
			}
			
			var group = this.groups[name];
			if( !group ) return null;
			return group.drop(version || '*');
		},
		get: function(name, version) {						
			var group = this.groups[name];
			if( !group ) return null;
			return group.get(version);
		},
		maxSatisfy: function(name, version) {
			var group = this.groups[name];
			if( !group ) return null;
			
			return group.maxSatisfy(version || '*');
		},
		satisfies: function(name, version) {						
			var group = this.groups[name];
			if( !group ) return null;
			
			return group.satisfies(version || '*');
		},
		exists: function(name, version) {
			var group = this.groups[name];
			if( !group ) return false;			
			return group.get(version);
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
				for(var j=0; j < group.length; j++) {
					var plugin = group[j];
					result.push(plugin);
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
		
			var plugindir = this.app.PLUGIN_DIR;
			var tmpbase = path.resolve(this.app.PLUGIN_DIR, '.temp');
		
			rmdirRecursive(tmpbase);
		
			var err, results, self = this;
			
			var error = function(err) {
				q.kill();
				rmdirRecursive(tmpbase);
				fn(err);
			};
			
			var plexiversion = semver.parse(this.app.version);
			plexiversion = [plexiversion.major, plexiversion.minor, plexiversion.patch].join('.');
			
			//console.log(plexiversion, semver.satisfies('0.1.2', '~0.1.0'));
			
			var q = async.queue(function (task, callback) {
				var identifier = task.identifier;
				var tmpdir = path.resolve(tmpbase, '' + Math.random());
		    
				//console.log('* installing ' + identifier);
				npm.load(function(err) {
					if(err) return error('[' + identifier + '] npm load error: ' + err);
					
					npm.commands.install(tmpdir, identifier, function (err, data) {
						if(err) return error('[' + identifier + '] npm install error: ' + err);
				
						try {
							//console.log('data', data[data.length - 1][1]);
							var downloaded = path.resolve(process.cwd(), data[data.length - 1][1]);
							//console.log('* [' + identifier + '] downloaded "' + downloaded + '"');
					
							var pkg = require(path.resolve(downloaded, 'package.json'));
					
							var npmname = pkg.name;
							var npmversion = pkg.version;
							var npmplexi = pkg.plexi;
							var pv = (pkg.dependencies && pkg.dependencies.plexi) || '*';
							
							if( pv.toLowerCase() === 'latest' || ~pv.indexOf('/') || !pv.indexOf('file:') ) pv = '*';
							
							//console.log('* name', npmname);
							//console.log('* version', npmversion);
					
							// check npm name & version
							if( !npmname || !npmversion ) {
								return error('[' + npmname + '@' + npmversion + '] package.json error(missing name or version)');
							}
							
							// check is matches current plexi runtime version
							if( !semver.satisfies(plexiversion, pv) ) {
								console.warn(('[' + npmname + '@' + npmversion + '] may not be compatible with current plexi runtime "' + plexiversion + '"), but this package prefer "' + pv + '"').red);
							}
							
							if( npmplexi && npmplexi.dependencies ) {
								for(var name in npmplexi.dependencies) {
									var v = npmplexi.dependencies[name];
									var match = self.maxSatisfy(name, v);
									if( !match ) {
										if( ~v.indexOf('://') ) q.push({identifier:v});
										else q.push({identifier: (( v && v !== '*' ) ? (name + '@\'' + v + '\'') : name)});
									} else {
										console.log('[' + npmname.yellow + '@' + npmversion.yellow + ']' + (' dependency ' + name + '@' + v + ' already exists.').cyan);
									}
								}
							}
					
							var dir = path.resolve(plugindir, (npmname + '@' + npmversion));
							
							if( fs.existsSync(dir) ) rmdirRecursive(dir);
							fs.renameSync(downloaded, dir);
													
							var info = {
								name: npmname,
								version: npmversion,
								from: identifier,
								dir: dir
							};
							
							if( !results ) {
								results = {
									name: npmname,
									version: npmversion,
									from: identifier,
									installed: [info]
								};
							} else {
								results.installed.push(info);
							}
							
							// detect
							var descriptor = new PluginDescriptor(self.app, dir);
							if( !self.exists(descriptor.name, descriptor.version) ) {
								self.add(descriptor.instantiate());
							}
							
							callback();
						} catch(err) {
							return error('[' + identifier + '] npm install error: ' + err.message);
						}
					});
				});
			}, 1);
		
			q.drain = function() {
				rmdirRecursive(tmpbase);
				
				fn(err, results);
			};
		
			q.push({identifier: identifier}, function (err) {
				if( err ) return error('error occured:' + err);
			});
			
			return this;
		},
		uninstall: function(identifier, fn) {
			if( !identifier ) throw new ApplicationError('invalid_plugin_identifier:' + identifier);
			
			identifier = PluginIdentifier.parse(identifier);
			
			var plugindir = this.app.PLUGIN_DIR;
			var plugins = this.drop(identifier.name, identifier.version);
			
			var results = {
				name: identifier.name,
				range: identifier.version,
				matches: plugins.length,
				uninstalled: []
			};
			if( plugins ) {
				for(var i=0; i < plugins.length; i++) {
					var plugin = plugins[i];
					
					// remove physically					
					var dir = path.resolve(plugindir, plugin.id.toString());
					rmdirRecursive(dir);
					
					results.uninstalled.push({
						name: plugin.name,
						version: plugin.version,
						dir: dir
					});
				}
			}
			
			if( fn ) fn(null, results);
			
			return this;
		}
	};
	
	return PluginManager;	
})();

module.exports = PluginManager;