var colors = require('colors');


function profile(options, arg, fn) {
	
};

function list(options, arg, fn) {
	
};

function init(options, arg, fn) {
	
};

function start(options, arg, fn) {
	
};

function install(options, arg, fn) {
	
};

function uninstall(options, arg, fn) {
	
};

function link(options, arg, fn) {
	
};

function unlink(options, arg, fn) {
	
};

function update(options, arg, fn) {
	
};

function lint(options, arg, fn) {
	
};

function find(options, arg, fn) {
	
};

function finds(options, arg, fn) {
	
};

function registry(options, arg, fn) {
	
};

function help(options, arg, fn) {
	
};

function version(options, arg, fn) {
	
};

var commands = function(app) {
	var mappings = {};
	var exec = this.exec = function(command, argv, callback) {
		var fn = mappings[command];
		if( !fn ) return console.error(('unknwon command "' + command + '"').red);
		
		var options = [], arg = [];
		for(var k in argv) {
			if( !argv.hasOwnProperty(k) ) continue;
			if( k.indexOf('-') ) options.push(k);
			else arg.push(k);
		}
		
		fn.apply(app, [options, arg, callback]);
	};
	
	function binding(scope, fn) {
		return function(argv, fn) {
			return exec(argv, fn);
		};
	}
	
	this.define = function(name, fn, options) {
		options = options || {};
		this[name] = binding(app, fn);
		this[name].commands = options.commands;
		this[name].options = options.options;
		this[name].comment = options.comment;
	};
	
	// define bundle commands
	this.define('profile', profile, {
		commands: ['p'],
		comment: 'profile system or plugin'
	});
	
	this.define('list', list, {
		commands: ['ss'],
		comment: 'show plugin list'
	});
	
	this.define('init', init, {
		commands: ['help', 'h', '?'],
		comment: 'init project'
	});
	
	this.define('start', start, {
		comment: 'start plugin'
	});
	
	this.define('stop', start, {
		comment: 'stop plugin'
	});
	
	this.define('install', install, {
		comment: 'install plugin'
	});
	
	this.define('uninstall', uninstall, {
		comment: 'uninstall plugin'
	});
	
	this.define('link', link, {
		comment: 'link plugin from filesystem'
	});
	
	this.define('unlink', unlink, {
		comment: 'unlink the linked plugin'
	});
	
	this.define('update', update, {
		comment: 'update installed plugins'
	});
	
	this.define('lint', lint, {
		comment: 'checks and drop unnecessary plugins'
	});
	
	this.define('find', find, {
		commands: ['f'],
		comment: 'find for a matching plugin'
	});
	
	this.define('finds', finds, {
		commands: ['ff'],
		comment: 'find for all matching plugins'
	});
	
	this.define('registry', registry, {
		commands: ['r'],
		comment: 'unlink the linked plugin'
	});
	
	this.define('help', help, {
		commands: ['h', '?'],
		comment: 'help'
	});
};

module.exports = commands;