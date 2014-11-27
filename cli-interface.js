var Table = require('cli-table');
var Application = require('./src/Application.js');

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

		process.stdin.resume();
		process.stdin.setEncoding('utf-8');
		process.stdout.write('\nplexi$ ');
		
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

					table.push(['home  ', app.HOME]);
					table.push(['preferences.file  ', app.PREFERENCES_FILE]);
					table.push(['plugins.dir  ', app.PLUGINS_DIR]);
					table.push(['workspace.dir  ', app.WORKSPACE_DIR]);
					table.push(['host plugin  ', host && (host.identity.toString() + ' [' + host.home + ']')]);
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
						
						table.push(['identity  ', (plugin.identity && plugin.identity.toString()) || '(null)']);
						table.push(['home  ', plugin.home || '(null)']);
						table.push(['pluginId  ', plugin.pluginId || '(null)']);
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
			} else if( cmd === 'ss' || cmd === 'status' || cmd === 'list' || cmd === 'ls' ) {
				if( !app ) return console.log('application not selected');

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
						
						table.push([i + '  ', '' + plugin.status + '  ', plugin.pluginId + '  ', plugin.version]);
					}
					console.log(table.toString());
				} else {
					console.log('empty!');
				}
			} else if( cmd === 'start' || cmd === 's' ) {
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (index)"');
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
				console.error('USAGE: "' + cmd + ' (pluginId)[@(version)] || (git or file url)"');
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (index)"');
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
			} else if( cmd === 'uninstall' ) {
				console.error('USAGE: "' + cmd + ' (pluginId)[@(version)]"');
				if( !arg.length ) {
					console.error('USAGE: "' + cmd + ' (index)"');
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
			} else if( cmd === 'help' || cmd === 'h' || cmd === '?' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});
				
				table.push(['profile || p', 'show system profile']);
				table.push(['ss || status || list || ls', 'show plugin status list']);
				table.push(['start {index}', 'start plugin']);
				table.push(['stop {index}', 'stop plugin']);
				table.push(['stop all', 'stop all plugins']);
				table.push(['install (pluginId)[@(version)] || (git or file url)', 'install new plugin']);
				table.push(['uninstall (pluginId)[@(version)]', 'uninstall selected plugin']);
				table.push(['quit || q || exit || bye', 'quit process']);
				table.push(['help || h || ?', 'help']);
				console.log(table.toString());
			} else if ( cmd === 'quit' || cmd === 'q' || cmd === 'exit' || cmd === 'exit' ) {
				process.exit();
			} else if( cmd ) {
				console.log('"' + cmd + '" is unknown command.');
			}
			
			process.stdout.write('plexi$ ');
		});
		return this;
	}
}

module.exports = new CLInterface;