var path = require('path');
var fs = require('fs');
var semver = require('semver');
var EventEmitter = require('events').EventEmitter;
var util = require("util");
var ApplicationError = require('./ApplicationError.js');


// Bundle Context
var BundleContext = function BundleContext(bundle) {
	Object.defineProperty(this, 'bundle', {
		value: bundle,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'applicationId', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.application.applicationId;
		}
	});

	Object.defineProperty(this, 'bundleId', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.bundleId;
		}
	});

	Object.defineProperty(this, 'version', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.version;
		}
	});

	Object.defineProperty(this, 'home', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.home;
		}
	});

	Object.defineProperty(this, 'workspace', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.workspace;
		}
	});

	Object.defineProperty(this, 'bundles', {
		enumerable: true,
		configurable: false,
		get: function() {
			return bundle.application.bundles;
		}
	});
};

BundleContext.prototype = {
	require: function(bundleId) {
		var caller = this.bundle;
		
		var bundle = caller.imports[bundleId];
		if( bundle ) {
			if( bundle.type == Bundle.TYPE_SERVICE ) {					
				if( bundle.status !== Bundle.STATUS_STARTED ) bundle.start();

				var exports = bundle.exports;

				if( !exports ) return {};
				
				var result = {};
				for(var key in exports) {
					var o = exports[key];
					if( typeof(o) === 'function' ) {
						result[key] = (function(o) {
							return function() {
								return o.apply(caller, arguments);
							}
						})(o);
					} else {
						result[key] = o;
					}
				}

				return result;
			} else {
				return bundle.exports;
			}
		} else {
			throw new ApplicationError('import bundle [' + bundleId + '] is not defined in bundle [' + caller.bundleId + '-' + caller.version + '] manifest file');
		}

		return null;
	}
};

// Bundle Identity
var BundleIdentity = function BundleIdentity(name) {
	if( !name || typeof(name) !== 'string' ) throw new ApplicationError('invalid bundle identity:' + name);

	var pos = name.indexOf('-');
	var bundleId = name;
	var version;

	if( pos > 0 ) {
		bundleId = name.substring(0, pos);
		version = semver.valid(name.substring(pos + 1));
	}
	
	if( !bundleId ) throw new ApplicationError('missing:bundleId:' + name);
	if( !version ) throw new ApplicationError('missing:version:' + name);

	Object.defineProperty(this, 'bundleId', {
		value: bundleId,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'version', {
		value: version,
		enumerable: false,
		configurable: false,
		writable: false
	});
};

BundleIdentity.prototype = {
	is: function(match) {
		return semver.satisfies(this.version, match);
	},
	toString: function() {
		return this.bundleId + '(' + this.version + ')';
	}
};


var Bundle = function Bundle(application, dir) {
	var identity = new BundleIdentity(path.basename(dir));

	Object.defineProperty(this, 'application', {
		value: application,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'identity', {
		value: identity,
		enumerable: false,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'bundleId', {
		value: identity.bundleId,
		enumerable: true,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'version', {
		value: identity.version,
		enumerable: true,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'home', {
		value: dir,
		enumerable: true,
		configurable: false,
		writable: false
	});

	Object.defineProperty(this, 'workspace', {
		enumerable: false,
		configurable: false,
		get: function() {
			return application.getBundleWorkspace(this);
		}
	});

	var ee = new EventEmitter();
	Object.defineProperty(this, 'ee', {
		enumerable: false,
		configurable: false,
		get: function() {
			return ee;
		}
	});

	var ctx = new BundleContext(this);
	Object.defineProperty(this, 'ctx', {
		enumerable: false,
		configurable: false,
		get: function() {
			return ctx;
		}
	});

	this.detect();
};

Bundle.STATUS_DETECTED = 'detected';
Bundle.STATUS_STARTED = 'started';
Bundle.STATUS_STOPPED = 'stopped';
Bundle.STATUS_ERROR = 'error';
Bundle.TYPE_SERVICE = 'service';
Bundle.TYPE_LIBRARY = 'library';
Bundle.TYPE_INVALID = 'invalid';

Bundle.prototype = {
	detect: function detect() {
		var manifest_file = path.join(this.home, 'bundle.json');
		var package_file = path.join(this.home, 'package.json');
		
		if( fs.existsSync(manifest_file) ) {
			var manifest = fs.readFileSync(manifest_file, 'utf-8');
			if( !manifest )
				throw new ApplicationError('bundle_manifest_error:bundle_manifest_not_found:' + this.identity + ':' + manifest_file);

			try {
				manifest = JSON.parse(manifest);
			} catch(err) {
				throw new ApplicationError('bundle_manifest_error:bundle_manifest_file_parse:' + this.identity + ':' + manifest_file + ':' + err.message, err);
			}

			if( typeof(manifest.bundleId) !== 'string' ) throw new ApplicationError('bundle_manifest_error:manifest.bundleId:' + this.identity, manifest);
			if( typeof(manifest.version) !== 'string' ) throw new ApplicationError('bundle_manifest_error:manifest.version:' + this.identity, manifest);
			if( typeof(manifest.activator) !== 'string' ) throw new ApplicationError('bundle_manifest_error:manifest.activator:' + this.identity, manifest);

			if( manifest.bundleId != this.bundleId ) throw new ApplicationError('bundle_manifest_error:bundleId_does_not_match:' + this.identity, manifest);
			if( manifest.version != this.version ) throw new ApplicationError('bundle_manifest_error:version_does_not_match:' + this.identity, manifest);
			
			var activator = require(path.join(this.home, manifest.activator));

			if( typeof(activator) === 'function' ) activator = {start:activator};
			if( !activator ) activator = {};
			if( !activator.start ) activator.start = function empty_start() {};
			if( typeof(activator.start) !== 'function' ) throw new ApplicationError('activator_error:invalid_start_function');

			var options = this.application.getBundleOptions(this.bundleId, this.version) || {};
			
			Object.defineProperty(this, 'activator', {
				value: activator,
				enumerable: true,
				configurable: true,
				writable: false
			});

			Object.defineProperty(this, 'manifest', {
				value: manifest,
				enumerable: true,
				configurable: true,
				writable: false
			});

			Object.defineProperty(this, 'type', {
				value: Bundle.TYPE_SERVICE,
				enumerable: true,
				configurable: true,
				writable: false
			});

			Object.defineProperty(this, 'options', {
				value: options,
				enumerable: true,
				configurable: true,
				writable: false
			});
			
			var exports = {};
			Object.defineProperty(this, 'exports', {
				enumerable: true,
				configurable: true,
				get: function() {
					return exports;
				},
				set: function(o) {
					if( typeof(o) !== 'object' ) throw new ApplicationError('bundle.exports must be an object');
					exports = o;
				}
			});
			
			var application = this.application;
			var imports = manifest.imports || {};
			Object.defineProperty(this, 'imports', {
				enumerable: true,
				configurable: true,
				get: function() {
					var result = {};
					for( var k in imports ) {
						if( !imports.hasOwnProperty(k) ) continue;

						var v = imports[k];
						if( typeof(v) === 'string' ) {
							result[k] = application.bundles.get(k, v);
						}
					}
					return result;
				}
			});
		} else if( fs.existsSync(package_file) ) {
			Object.defineProperty(this, 'type', {
				value: Bundle.TYPE_LIBRARY,
				enumerable: true,
				configurable: true,
				writable: false
			});

			var exports = require(this.home) || {};
			Object.defineProperty(this, 'exports', {
				enumerable: true,
				configurable: true,
				get: function() {
					return exports;
				}
			});
			
			var imports = {};
			Object.defineProperty(this, 'imports', {
				enumerable: true,
				configurable: true,
				get: function() {
					return imports;
				}
			});
		} else {
			Object.defineProperty(this, 'type', {
				value: Bundle.TYPE_INVALID,
				enumerable: true,
				configurable: true,
				writable: false
			});
			
			this.status = Bundle.STATUS_ERROR;
			return;
		}
		
		this.status = Bundle.STATUS_DETECTED;
	},
	start: function start() {
		if( this.status === Bundle.STATUS_STARTED ) {
			console.warn('cannot_start:already_started:' + this.identity + ':' + this.version);
			return;
		}

		var activator = this.activator;
		var result;
		if( activator && typeof(activator.start) === 'function' ) {
			result = activator.start.apply(this, [this.ctx]);

			if( typeof(result) === 'function' ) {
				var self = this;
				result(function(err) {
					if( err ) {
						self.status = Bundle.STATUS_ERROR;
						self.error = err;
						console.error('bundle_start_error:' + this.identity + ':' + err.message, err);
						return;
					}

					self.status = Bundle.STATUS_STARTED;
				});
			} else {
				this.status = Bundle.STATUS_STARTED;
			}
		} else {
			this.status = Bundle.STATUS_STARTED;
		}

		return result;
	},
	stop: function stop() {
		if( this.status !== Bundle.STATUS_STARTED ) {
			console.warn('cannot_stop:not_started_yet:' + this.identity + ':' + this.status);
			return;
		}

		var activator = this.activator;
		var result;
		if( activator && typeof(activator.stop) === 'function' ) {
			result = activator.stop.apply(this, [this.ctx]);

			if( typeof(result) === 'function' ) {
				var self = this;
				result(function(err) {
					if( err ) {
						self.status = Bundle.STATUS_ERROR;
						self.error = err;
						console.error('bundle_stop_error:' + this.identity + ':' + err.message, err);
						return;
					}

					self.status = Bundle.STATUS_STOPPED;
				});
			} else {
				this.status = Bundle.STATUS_STOPPED;
			}
		} else {
			this.status = Bundle.STATUS_STOPPED;
		}

		return result;
	}
};


module.exports = Bundle;
