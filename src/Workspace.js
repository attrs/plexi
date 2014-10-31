var path = require('path');
var fs = require('fs');

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

module.exports = Workspace;