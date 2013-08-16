var https = require('https');
var http = require('http');
var express = require('express');
var fs = require('fs');
var path = require('path');
var attrs = require('./attrs.express.js');

var routers = {};
var app = express();
var root = express();
var logdir;

var Router = function Router(namespace, bundle) {
	this.namespace = namespace;

	var logfilename = namespace.substring(1);
	logfilename = logfilename.split('/').join('_');
	logfilename = logfilename.split('\\').join('_');

	this.router = express();
	root.use(namespace, this.router);

	this.body = express();
	routers[this.namespace] = this;
	if( logdir ) this.router.use(express.logger({stream: fs.createWriteStream(path.join(logdir, logfilename + '-access.log'), {flags: 'a'}), format: ':date - :method :status :url :remote-addr [HTTP/:http-version :res[content-length] :referrer :user-agent :response-time ms]' }));
	this.router.use(this.body);
	if( logdir ) this.router.use(attrs.errorlog({ showMessage: false, dump: true, showStack: true, logErrors: path.join(logdir, logfilename + '-error.log') }));	
};

Router.prototype = {
	filter: function(uri, fn) {
		return this.body.use(fn);
	},
	get: function(uri, fn) {
		return this.body.get(uri, fn);
	},
	post: function(uri, fn) {
		return this.body.post(uri, fn);
	},
	put: function(uri, fn) {
		return this.body.put(uri, fn);
	},
	del: function(uri, fn) {
		return this.body.del(uri, fn);
	},
	options: function(uri, fn) {
		return this.body.options(uri, fn);
	},
	static: function(uri, path) {
		console.log('static:' + uri, path);
		return this.body.use(uri, express.static(path));
	},
	remove: function(method, uri) {
		var arg = this.body.routes[method];
		if( arg ) {
			for(var i=0; i < arg.length; i++) {
				var o = arg[i];
				if( o.path === uri ) delete arg[i];				
			}
		}
	},
	drop: function() {
		this.body.routes = {};
	}
};

module.exports = {
	start: function(ctx) {
		console.log('http init. options:', this.options);

		this.exports = {
			router: function(namespace) {
				if( !namespace ) throw new Error('invalid_namespace:' + namespace);
				if( namespace.substring(0,1) === ' ' ) throw new Error('invalid_namespace:' + namespace);
				if( namespace.substring(0,1) === '.' ) throw new Error('invalid_namespace:' + namespace);
				
				var bundle = this;
				console.log('request router namespace [' + namespace + '] from [' + bundle.bundleId + ']');

				namespace = namespace.trim();
				if( namespace.substring(0,1) !== '/' ) namespace = '/' + namespace;

				if( routers[namespace] ) 
					return routers[namespace];
				else 
					return new Router(namespace);
			},
			engine: app,
			provider: 'express'
		};

		var port = this.options.port;
		var ssl = this.options.ssl;
		var docbase = this.options.docbase;
		var debug = this.options.debug;
		
		logdir = this.workspace.path('logs');
		if( !fs.existsSync(logdir) ) fs.mkdirSync(logdir);

		if( typeof(port) !== 'number' && port <= 0 ) throw new Error('invalid port option:' + this.options);

		if( debug ) app.use(express.logger({format: ':date - \x1b[1m:method\x1b[0m \x1b[36m:status \x1b[33m:url\x1b[0m, :response-time ms'}));			
		app.use(express.logger({stream: fs.createWriteStream(path.join(logdir, 'access.log'), {flags: 'a'}), format: ':date - :method :status :url :remote-addr [HTTP/:http-version :res[content-length] :referrer :user-agent :response-time ms]' }));
		app.use(express.compress());
		app.use(express.favicon());
		app.use(attrs.charset('utf-8'));
		app.use(attrs.poweredBy('Attributes, Express'));

		if( docbase ) app.use(express.static(docbase));

		var SESSION = {};

		app.use(express.bodyParser());
		app.use(express.methodOverride());
		app.use(attrs.cors());
		app.use(express.cookieParser('bf29b53c-0e77-4916-876e-19ed288e79ec'));
		app.use(function(req, res, next) {
			req.session = SESSION;
			var send = res.send;
			res.send = function(obj, status, msg) {				
				this.app.set('json spaces', '\t');
				if( obj === null || obj === undefined ) {
					return send.apply(res, [204]);
				}

				send.apply(res, arguments);
			}

			next();
		});
		app.use(root);
		app.use(attrs.errorlog({ showMessage: false, showStack: true, logErrors: path.join(logdir, 'error.log') }));
		app.use(attrs.errorsend({ showStack: true }));

		var httpd = http.createServer(app);
		httpd.on('error', function (e) {
			if (e.code == 'EADDRINUSE') {
				console.log('Address in use, retrying...');
				setTimeout(function () {
					httpd.close();
					httpd.listen(port);
				}, 1000);
			}
		});
		
		httpd.listen(port, function() {
			console.log('HTTP Server listening on port ' + port + ', with [' + (docbase || 'none') + ']');			
		});

		if( typeof(ssl) === 'object' ) {
			var httpsd = https.createServer(ssl, app);

			httpsd.on('error', function (e) {
				console.error('https server error', e.message, e.code);
			});
			
			httpsd.listen((ssl.port || 443), function() {
				console.log('HTTP Server listening on port ' + (ssl.port || 443) + ', with [' + JSON.stringify(ssl) + ']');			
			});
		}
	},
	stop: function(ctx) {
	}
};
