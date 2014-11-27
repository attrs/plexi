var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


// Plugin Workspace
var Workspace = function Workspace(base, pluginId) {
	this.base = base;
	this._dir = path.join(base, pluginId);
};

Workspace.prototype = {
	dir: function(create) {
		var dir = this._dir;
		if( create === true ) {
			mkdirp.sync(dir, function(err, result) {
				if( err ) console.error('[error] workspace directory "' + dir + '" creation failure', err);
			});
		}
		return dir;
	},
	path: function(subpath) {
		return path.join(this.dir(true), subpath);
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