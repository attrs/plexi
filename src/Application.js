var path = require('path');
var fs = require('fs');
var npm = require("npm");

npm.on('log', function(message) {
	console.log('log:' + message);
});

var Plugin = require('./Plugin.js');
var PluginGroup = require('./PluginGroup.js');
var Workspace = require('./Workspace.js');
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

var Application = function Application(homedir, properties) {
	if( !homedir ) throw new Error('missing home directory', homedir);
	
	if( typeof(properties) !== 'object' ) properties = {};
	this.properties = properties || {};
	this.load(homedir);
	
	var self = this;
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
			this.preference = {env:{},plugins:{}};
		}
		
		this.plugins = {};
		this.workspaces = {};
	},
	detect: function detect(fn) {
		var files = fs.readdirSync(this.PLUGINS_DIR);
		
		for(var i=0; i < files.length; i++) {
			var dirname = files[i];			
			if( dirname.startsWith('-') || !~dirname.indexOf('@') ) continue;
		
			var dir = path.join(this.PLUGINS_DIR, dirname);

			var stat = fs.statSync(dir);
			if( stat.isDirectory() ) {
				var plugin = new Plugin(this, dir);
			
				if( plugin instanceof Plugin ) {
					var id = plugin.pluginId;
					var plugingroup = this.plugins[id];
					if( !plugingroup ) {
						plugingroup = new PluginGroup(id);
						this.plugins[id] = plugingroup;
					}
		
					plugingroup.add(plugin);
			
					console.log('* detected', plugin.pluginId, plugin.version);
					this.fire('detected', {plugin:plugin});
				} else {
					throw new ApplicationError('invalid_plugin:' + dir);
				}
			}
		}
	},
	start: function start() {		
		for(var id in this.plugins) {
			var plugin = this.get(id);
			if( plugin.status === Plugin.STATUS_DETECTED ) plugin.start();
		}
	},
	exists: function exists(pluginId, version) {
		return (this.plugins.get(pluginId, version) ) ? true : false;
	},
	all: function() {
		var result = [];
		for(var k in this.plugins) {
			var plugingroup = this.plugins[k];
			if( plugingroup instanceof PluginGroup ) {
				var plugins = plugingroup.all();
				
				for(var j=0; j < plugins.length; j++) {
					var plugin = plugins[j];
					result.push(plugin);
				}				
			}
		}
		return result;
	},
	group: function(pluginId) {
		return this.plugins[pluginId];
	},
	groups: function(pluginId) {
		var result = [];
		for(var k in this.plugins) {
			var plugingroup = this.plugins[k];
			if( plugingroup instanceof PluginGroup ) {
				result.push(plugingroup);
			}
		}
		return result;	
	},
	get: function(pluginId, version) {
		var plugingroup = this.plugins[pluginId];
		if( plugingroup ) {
			return plugingroup.get(version);
		}
		return null;
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
		var pref = this.preference.plugins;
		if( pref ) {			
			var options = pref[pluginId];
			
			if( version ) {
				options = pref[pluginId + '@' + version] || options;
			}
			
			if( options ) {
				return JSON.parse(JSON.stringify(options));
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

module.exports = Application;
