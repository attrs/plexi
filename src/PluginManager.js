var semver = require('semver');
var Plugin = require('./Plugin.js');
var ApplicationError = require('./ApplicationError.js');

var PluginGroup = function PluginGroup(pluginId) {
	this.pluginId = pluginId;
	this.plugins = [];
};

PluginGroup.prototype = {
	/*
	*
	>1.0
	<1.0
	1.0.0
	1.0
	1.0.*
	1.*
	*/
	version: function(match) {
		if( match === '*' ) return this.latest();
		if( !match ) return null;

		for(var i=0; i < this.plugins.length; i++) {
			var plugin = this.plugins[i];
			var version = plugin.version;

			if( semver.satisfies(version, match) ) {
				return plugin;
			}
		}

		return null;
	},
	latest: function() {
		return this.plugins[0];
	},
	versions: function() {
		return this.plugins;
	},
	add: function(plugin) {
		if( (plugin instanceof Plugin) && plugin.pluginId === this.pluginId ) {
			this.plugins.push(plugin);

			this.plugins.sort(function compare(a, b) {
				return semver.compare(b.version, a.version);
			});
		} else {
			throw new ApplicationError('invalid_plugin:' + plugin.pluginId, plugin);
		}
	},
	toString: function() {
		return '[group:' + this.pluginId + ':' + this.plugins.length + ']';
	}
};


function PluginManager() {
	this.groups = {};
}

PluginManager.prototype = {
	host: function(plugin) {
		if( !arguments.length ) return this._host;
		this.add(plugin);
		this._host = plugin;
	},
	add: function(plugin) {
		if( !(plugin instanceof Plugin) ) throw new ApplicationError('illegal_arguments:plugin', plugin);
		var group = this.groups[plugin.pluginId];
		if( !group ) group = this.groups[plugin.pluginId] = new PluginGroup(plugin.pluginId);
		group.add(plugin);
		return this;
	},
	get: function(pluginId, version) {
		var group = this.groups[pluginId];
		if( group ) {
			return group.version(version);
		}
		return null;
	},
	group: function(pluginId) {
		return this.groups[pluginId];
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
	exists: function(pluginId, version) {
		if( !arguments.length ) return false;
		if( !version ) version = '*';
		var group = this.groups[pluginId];
		if( arguments.length === 1 ) return group ? true : false;
		return group.version(version) ? true : false;
	},
	
	// control
	start: function(pluginId, version) {
		if( !arguments.length || !pluginId ) return console.error('illegal_arguments:pluginId');
		if( !version ) version = '*';
		
		var group = this.groups[pluginId];
		var plugin = group.version(version);
		if( !plugin ) throw new ApplicationError('not_found:' + pluginId + '@' + version);
		plugin.start();
		return this;
	},
	stop: function(pluginId, version) {
		if( !arguments.length || !pluginId ) return console.error('illegal_arguments:pluginId');
		if( !version ) version = '*';
		
		var group = this.groups[pluginId];
		var plugin = group.version(version);
		if( !plugin ) throw new ApplicationError('not_found:' + pluginId + '@' + version);
		plugin.stop();
		return this;
	},
	install: function(url) {
		
	},
	unintall: function(id) {
		
	}
};

module.exports = PluginManager;