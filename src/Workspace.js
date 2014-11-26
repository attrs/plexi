var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


// Plugin Workspace
var Workspace = function Workspace(base, pluginId) {
	this.base = base;
	this.dir = path.join(base, pluginId);
	
	mkdirp.sync(this.dir, function(err, result) {
		if( err ) console.error('workspace init failure', err);
	});
};

Workspace.prototype = {
	path: function(subpath) {
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