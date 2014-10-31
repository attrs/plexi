var semver = require('semver');
var Plugin = require('./Plugin.js');

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
	get: function(match) {
		if( !match || match === '*' ) return this.plugins[0];

		for(var i=0; i < this.plugins.length; i++) {
			var plugin = this.plugins[i];
			var version = plugin.version;

			if( semver.satisfies(version, match) ) {
				return plugin;
			}
		}

		return null;
	},
	master: function() {
		return this.plugins[0];
	},
	all: function() {
		return this.plugins;
	},
	add: function(plugin) {
		if( (plugin instanceof Plugin) && plugin.pluginId === this.pluginId ) {
			this.plugins.push(plugin);

			this.plugins.sort(function compare(a, b) {
				return semver.compare(b.version, a.version);
			});
		} else {
			throw new ApplicationError('incompatible_plugin:' + plugin.pluginId, plugin);
		}
	},
	toString: function() {
		return '[group:' + this.pluginId + ':' + this.plugins.length + ']';
	}
};

module.exports = PluginGroup;