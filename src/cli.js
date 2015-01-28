var Table = require('cli-table');
var Application = require('./Application.js');

var CLInterface = function CLInterface() {};

function stringify(o, t) {
	if( typeof(o) === 'string' ) return o;
	if( !o ) return '(' + o + ')';
	if( typeof(o) === 'function' ) return '(function)';
	
	if( arguments.length === 1 || !t ) t = '\t';
	return JSON.stringify(o, function(key, value) {
		if (typeof(value) === 'function') return '(function)';
		return value;
	}, t);
}

CLInterface.prototype = {
	application: function(app) {
		this.application = app;
		return this;
	},
	stop: function() {
		this.stopped = true;
		process.stdin.pause();
		return this;
	},
	start: function() {
		var self = this;
		
		//process.stdout.write('\nplexi$ ');
		process.stdin.resume();
		process.stdin.setEncoding('utf-8');
		
		var progressing = false;

		process.stdin.on('data', function (text) {
			if( progressing ) return;
			if( self.stopped ) return;
			if( !text ) text = '';

			text = text.replace(/[\n\r]/g, ' ').trim();
			var cmd = text.split(' ')[0];
			var arg = text.split(' ').splice(1);
			
			var app = self.application;
			
			if( cmd === 'profile' || cmd === 'p' ) {
				if( !app ) return console.log('application not selected');
				
				if( !arg.length ) {
					var table = new Table({
						chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
							, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
							, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
							, 'right': '' , 'right-mid': '' , 'middle': ' ' },
						 style: { compact : true, 'padding-left' : 1 }
					});
					
					var host = app.plugins.host();
					
					var os = require('os');
					
					table.push(['os.type  ', os.type()]);
					table.push(['os.platform  ', os.platform()]);
					table.push(['os.arch  ', os.arch()]);
					table.push(['os.release  ', os.release()]);
					table.push(['free memory  ', Math.floor(os.freemem() / 1024 / 1024) + 'MB / ' + Math.floor(os.totalmem() / 1024 / 1024) + 'MB']);
					table.push(['cpus  ', os.cpus().length]);
					table.push(['hostname  ', os.hostname()]);
					table.push(['nodejs  ', process.version]);
					table.push(['plexi.version  ', app.properties['plexi.version']]);
					table.push(['home  ', app.home]);
					table.push(['plugin.dir  ', app.PLUGIN_DIR]);
					table.push(['workspace.dir  ', app.WORKSPACE_DIR]);
					table.push(['log.dir  ', app.LOG_DIR]);
					table.push(['host plugin  ', host && (host.id.toString() + ' [' + host.dir + ']')]);
					if( app.links ) table.push(['links  ', stringify(app.links,'','\t')]);
					table.push(['properties  ', stringify(app.properties,'','\t')]);

					console.log(table.toString());
				} else {
					var plugins = app.plugins.all();
					var plugin = plugins[parseInt(arg[0])];
					if( plugin ) {
						var table = new Table({
							chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
								, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
								, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
								, 'right': '' , 'right-mid': '' , 'middle': ' ' },
							 style: { compact : true, 'padding-left' : 1 }
						});						
						
						table.push(['id  ', plugin.id.toString() || '(null)']);
						table.push(['dir  ', plugin.dir || '(null)']);
						table.push(['name  ', plugin.name || '(null)']);
						table.push(['version  ', plugin.version || '(null)']);
						table.push(['activator  ', (plugin.activator ? true : false)]);
						table.push(['status  ', plugin.status || '(null)']);
						table.push(['workspace  ', (plugin.workspace && plugin.workspace.dir) || '(null)']);
						table.push(['dependencies  ', stringify(plugin.dependencies, '', '\t')]);
						table.push(['preference  ', stringify(plugin.preference, '', '\t')]);
						table.push(['exports  ', stringify(plugin.exports)]);
						
						console.log('exports', plugin.exports);

						console.log(table.toString());
					} else {
						console.log('input plugin index (Please check with "status" command) [0-' + (plugins.length - 1) + ']');
					}
				}
			} else if( cmd === 'r' || cmd === 'registry' ) {
				console.log(app.registry);
			} else if( cmd === 'ss' || cmd === 'status' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				var plugins = app.plugins.all();
				if( plugins && plugins.length > 0 ) {
					for(var i=0; i < plugins.length; i++) {
						var plugin = plugins[i];
						
						table.push([i + '  ', '' + plugin.status + '  ', plugin.name + '  ', plugin.version]);
					}
					console.log(table.toString());
				} else {
					console.log('empty!');
				}
			} else if( cmd === 'start' || cmd === 's' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (index)"');
				} else if( arg[0] === 'all' ) {
					var plugins = app.plugins.all();
					plugins.forEach(function(plugin) {
						plugin.start();
					});
				} else {
					var plugins = app.plugins.all();
					var plugin = plugins[parseInt(arg[0])];
					if( !plugin ) {
						console.log('input plugin index (Please check with "status" command) [0-' + (plugins.length - 1) + ']');
					} else {
						plugin.start();
					}
				}
			} else if( cmd === 'stop' || cmd === 'x' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (index)"');
				} else if( arg[0] === 'all' ) {
					var plugins = app.plugins.all();
					plugins.forEach(function(plugin) {
						plugin.stop();
					});
				} else {
					var plugins = app.plugins.all();
					var plugin = plugins[parseInt(arg[0])];
					if( !plugin ) {
						console.log('input plugin index (Please check with "status" command) [0-' + (plugins.length - 1) + ']');
					} else {
						plugin.stop();
					}
				}
			} else if( cmd === 'install' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (name)[@(version)] || (git or file url)"');
				} else {
					var url = arg[0];
					progressing = true;
					app.plugins.install(url, function(err, result) {
						progressing = false;
						process.stdout.write('plexi$ ');
						if( err ) return console.error('plugin install failure', err);
						console.log('plugin installed successfully!', result);
					});
					return;
				}
			} else if( cmd === 'links' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				var links = app.links;
				if( links && links.length > 0 ) {
					for(var i=0; i < links.length; i++) {
						var link = links[i];
						
						table.push([link]);
					}
					console.log(table.toString());
				} else {
					console.log('empty!');
				}
			} else if( cmd === 'link' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (path)"');
				} else {
					var file = arg[0];
					var plugin = app.link(file);
					if( plugin ) console.log('' + plugin.id + ' linked');
					else console.log('link fail', file);
				}
			} else if( cmd === 'unlink' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (path)"');
				} else {
					var file = arg[0];
					var plugin = app.unlink(file);
					if( plugin ) console.log('' + plugin.id + ' unlinked');
					else console.log('not found linked plugin', file);
				}
			} else if( cmd === 'uninstall' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (name)[@(version)]"');
				} else {
					var url = arg[0];
					progressing = true;
					app.plugins.uninstall(url, function(err, result) {
						progressing = false;
						process.stdout.write('plexi$ ');
						if( err ) return console.error('plugin uninstall failure', err);
						console.log('plugin uninstalled successfully!', result);
					});
					return;
				}
			} else if( cmd === 'find' || cmd === 'f' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});
				
				var name = arg[0];
				var range = arg.splice(1).join(' ') || '*';
				
				var all = app.plugins.all();
				var plugin = app.plugins.maxSatisfy(name, range);
				if( plugin ) {
					table.push([all.indexOf(plugin) + '  ', '' + plugin.status + '  ', plugin.name + '  ', plugin.version]);
					console.log(table.toString());
				} else {
					console.log('not found');
				}
			} else if( cmd === 'finds' || cmd === 'ff' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});
				
				var name = arg[0];
				var range = arg.splice(1).join(' ') || '*';
				
				var all = app.plugins.all();
				var plugins = app.plugins.satisfies(name, range);
				if( plugins && plugins.length > 0 ) {
					for(var i=0; i < plugins.length; i++) {
						var plugin = plugins[i];
						
						table.push([all.indexOf(plugin) + '  ', '' + plugin.status + '  ', plugin.name + '  ', plugin.version]);
					}
					console.log(table.toString());
				} else {
					console.log('not found');
				}
			} else if( cmd === 'help' || cmd === 'h' || cmd === '?' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});
				
				table.push(['profile, p', 'show system profile']);
				table.push(['status, ss', 'show plugin status list']);
				table.push(['registry, r', 'show registry']);
				table.push(['start {index}', 'start plugin']);
				table.push(['start all', 'start all plugins']);
				table.push(['stop {index}', 'stop plugin']);
				table.push(['stop all', 'stop all plugins']);
				table.push(['links', 'show all links']);
				table.push(['link (path)', 'link from filesystem']);
				table.push(['unlink (path)', 'unlink the linked plugin']);
				table.push(['find, f {name} [{version}]', 'search for a matching plugin']);
				table.push(['finds, ff {name} [{version}]', 'search for all matching plugin']);
				table.push(['install (name)[@(version)] || (git or file url)', 'install new plugin']);
				table.push(['uninstall (name)[@(version)]', 'uninstall selected plugin']);
				table.push(['quit, q', 'quit process']);
				table.push(['help, h, ?', 'help']);
				console.log(table.toString());
			} else if ( cmd === 'quit' || cmd === 'q' ) {
				app.stop();				
				process.exit(0);
			} else if( cmd ) {
				console.log('"' + cmd + '" is unknown command.');
			}
			
			process.stdout.write('plexi$ ');
		});
		return this;
	}
}

module.exports = new CLInterface;