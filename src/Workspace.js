var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


// Plugin Workspace
var Workspace = function Workspace(plugin) {
	var base = plugin.application.WORKSPACE_DIR;
	var dir = path.resolve(base, plugin.name);
	
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
	path: function(subpath) {
		return path.resolve(this.dir, subpath);
	},
	mkdir: function() {
		var dir = this.dir;
		mkdirp.sync(dir, function(err, result) {
			if( err ) console.error('[error] workspace directory "' + dir + '" creation failure', err);
		});
		return this;
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