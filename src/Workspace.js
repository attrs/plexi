var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


// Plugin Workspace
var Workspace = function Workspace(plugin) {
	var base = plugin.application.WORKSPACE_DIR;
	var dir = path.resolve(base, plugin.id.name);
		
	Object.defineProperty(this, 'base', {
		value: base,
		enumerable: true,
		configurable: false,
		writable: false
	});
	
	Object.defineProperty(this, 'dir', {
		value: dir,
		enumerable: true,
		configurable: false,
		writable: false
	});
};

Workspace.prototype = {
	path: function(subpath, creation) {
		var p = path.resolve(this.dir, subpath);
		return p;
	},
	mkdir: function(subpath) {
		var p = path.resolve(this.dir, subpath);
		mkdirp.sync(p, function(err, result) {
			if( err ) console.error('[error] workspace directory "' + dir + '" creation failure', err);
		});
		return p;
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

module.exports = Workspace;