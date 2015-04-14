var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var ApplicationError = require('./ApplicationError.js');


// Plugin Workspace
var Logger = function Logger(dir) {
	if( !dir || typeof(dir) !== 'string' ) throw new ApplicationError('illegal log directory path:' + dir);
	this._dir = dir;
};

Logger.prototype = {
	dir: function(create) {
		var dir = this._dir;
		if( create === true ) {
			mkdirp.sync(dir, function(err, result) {
				if( err ) console.error('[error] log directory "' + dir + '" creation failure', err);
			});
		}
		return dir;
	},
	path: function(subpath) {
		return path.join(this.dir(true), subpath);
	},
	create: function(name, options) {
	},
	log: function(name, message) {
	}
};

module.exports = Logger;