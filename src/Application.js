var path = require('path');
var fs = require('fs');
var semver = require('semver');

var Plugin = require('./Plugin.js');
var ApplicationError = require('./ApplicationError.js');

if( !String.prototype.startsWith ) {
	String.prototype.startsWith = function(s) {
		if( !s ) return false;
		return (this.indexOf(s)==0);
	};
}

if( !String.prototype.endsWith ) {
	String.prototype.endsWith = function(s) {
		if( !s ) return false;

		return this.indexOf(s, this.length - s.length) !== -1;
	};
}

if( !String.prototype.trim ) {
	String.prototype.trim = function() {
		return this.replace(/(^ *)|( *$)/g, "");
	};
}

var Application = function Application(homedir, properties) {
	if( !homedir ) throw new Error('missing home directory', homedir);
	
	if( typeof(properties) !== 'object' ) properties = {};
	this.properties = properties || {};
	this.load(homedir);
	this.detect();
	this.start();
};

Application.prototype = {
	load: function load(homedir) {		
		var pref_file = path.join(homedir, 'plexi.json');
		
		this.HOME = homedir;
		this.PREFERENCE_FILE = pref_file;
		
		if( fs.existsSync(pref_file) && fs.statSync(pref_file).isFile() ) {
			var preference = fs.readFileSync(pref_file, 'utf-8');
			var env = preference.env || {};
			
			this.PLUGINS_DIR = path.join(this.HOME, env.plugins || 'plugins');
			this.WORKSPACE_DIR = path.join(this.HOME, env.workspace || 'workspace');
			this.LOG_DIR = path.join(this.HOME, env.logs || 'logs');
			
			if( !fs.existsSync(this.PLUGINS_DIR) ) fs.mkdirSync(this.PLUGINS_DIR);
			if( !fs.existsSync(this.WORKSPACE_DIR) ) fs.mkdirSync(this.WORKSPACE_DIR);
			if( !fs.existsSync(this.LOG_DIR) ) fs.mkdirSync(this.LOG_DIR);

			try {				
				var props = this.properties;				
				props['home'] = this.HOME;
				props['preference.file'] = this.PREFERENCE_FILE;
				props['workspace.dir'] = this.WORKSPACE_DIR;
				props['plugins.dir'] = this.PLUGINS_DIR;
				props['log.dir'] = this.LOG_DIR;

				for(var k in props) {
					var value = props[k] || '';
					preference = preference.split('{' + k + '}').join(value);
				}
				
				preference = preference.split('\\').join('/');
				preference = JSON.parse(preference);
			} catch(err) {
				throw new ApplicationError('application_load_error:config_file_parse:' + pref_file + ':' + err.message, err);
			}
		
			// setup instance attributes
			this.preference = preference;
		} else {
			this.preference = {};
		}
		
		this.plugins = new PluginGroups();
		this.workspaces = {};
	},
	detect: function detect() {
		var files = fs.readdirSync(this.PLUGINS_DIR);

		for(var i=0; i < files.length; i++) {
			var dirname = files[i];			
			if( dirname.startsWith('-') || !~dirname.indexOf('@') ) continue;
			
			var dir = path.join(this.PLUGINS_DIR, dirname);

			var stat = fs.statSync(dir);
			if( stat.isDirectory() ) {
				var plugin = new Plugin(this, dir);
				this.plugins.add(plugin);				
				console.log('* detected', plugin.pluginId, plugin.version);
				this.fire('detected', {plugin:plugin});
			}
		}
	},
	install: function install(pluginId, version, fn) {
		console.log('* plugin install', pluginId, version);
	},
	uninstall: function uninstall(pluginId, version, fn) {
		console.log('* plugin install', pluginId, version);
	},
	exists: function exists(pluginId, version) {
		return (this.plugins.get(pluginId, version) ) ? true : false;
	},
	start: function start() {
		var preference = this.preference;
		var plugins = this.plugins;
		
		// install & update
		for(var name in preference) {
			if( !preference.hasOwnProperty(name) ) continue;
			
			var pos = name.lastIndexOf('@');
			var pluginId = name;
			var version;

			if( pos > 0 ) {
				pluginId = name.substring(0, pos);
				version = name.substring(pos + 1);
			}
			
			var plugin = exists(pluginId, version);
			if( !plugin ) console.log('* plugin exists', pluginId, version);
			else 
		}
		
		for(var id in plugins.groups) {
			var plugin = plugins.get(id);
			if( plugin.status === Plugin.STATUS_DETECTED ) plugin.start();
		}
	},
	workspace: function(pluginId) {
		if( !pluginId ) throw new ApplicationError('missing:pluginId');

		if( typeof(pluginId) === 'object' && pluginId.pluginId ) {
			pluginId = pluginId.pluginId;
		}

		if( typeof(pluginId) !== 'string' ) throw new ApplicationError('invalid:pluginId:' + pluginId);

		var ws = this.workspaces[pluginId];
		if( !ws ) {
			ws = new Workspace(path.join(this.WORKSPACE_DIR, pluginId));
			this.workspaces[pluginId] = ws;
		}

		return ws;
	},
	options: function(pluginId, version) {
		if( this.preference ) {			
			var plugin_pref = this.preference[pluginId];
			
			if( version ) {
				plugin_pref = this.preference[pluginId + '@' + version] || plugin_pref;
			}
			
			if( plugin_pref ) {
				return JSON.parse(JSON.stringify(plugin_pref));
			}
		}

		return null;
	},
	on: function(type, fn) {
	},
	un: function(type, fn) {
	},
	fire: function(type, values) {		
	}
};



// Plugin Workspace
var Workspace = function Workspace(dir) {
	this.dir = dir;
};

Workspace.prototype = {
	path: function(subpath) {
		if( !fs.existsSync(this.dir) ) {
			fs.mkdirSync(this.dir);
		}

		var file = path.join(this.dir, subpath)

		return file;
	},
	save: function(name, data, charset, options) {
		return {
			done: function(fn) {
			}
		};
	},
	load: function(name, charset, options) {
		return {
			done: function(fn) {
			}
		};
	}
};



// Plugin Groups
var PluginGroups = function PluginGroups() {
	this.groups = {};
};

PluginGroups.prototype = {
	add: function(plugin) {
		if( plugin instanceof Plugin ) {
			var id = plugin.pluginId;
			var group = this.groups[id];
			if( !group ) {
				group = new PluginGroup(id);
				this.groups[id] = group;
			}
			
			group.add(plugin);
		} else {
			throw new ApplicationError('invalid_plugin', plugin);
		}
	},
	all: function(pluginId) {
		var arg = [];
		
		if( arguments.length <= 0 ) {
			for(var pluginId in this.groups) {
				var group = this.groups[pluginId];
				if( group ) {
					var plugins = group.all();
					if( plugins && plugins.length > 0 ) arg = arg.concat(plugins);
				}
			}
		} else {
			var group = this.groups[pluginId];
			if( group ) {
				var plugins = group.all();
				if( plugins && plugins.length > 0 ) arg = arg.concat(plugins);
			}
		}

		return arg;
	},
	get: function(pluginId, version) {
		var group = this.groups[pluginId];
		if( group ) {
			return group.get(version);
		}

		return null;
	}
};

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

module.exports = Application;
