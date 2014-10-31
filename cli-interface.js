var Table = require('cli-table');
var Application = require('./src/Application.js');

var CLInterface = function CLInterface() {};

CLInterface.prototype = {
	application: function(app) {
		this.application = app;
	},
	stop: function() {
		this.stopped = true;
		process.stdin.pause();
	},
	start: function() {
		var self = this;

		process.stdin.resume();
		process.stdin.setEncoding('utf-8');

		process.stdin.on('data', function (text) {
			if( self.stopped ) return;
			if( !text ) text = '';

			text = text.replace(/[\n\r]/g, '').trim();
			
			var app = self.application;
			
			if( text === 'profile' || text === 'p' ) {
				if( !app ) return console.log('application not selected');

				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				table.push(['home  ', app.HOME]);
				table.push(['preference.file  ', app.PREFERENCE_FILE]);
				table.push(['plugins.dir  ', app.PLUGINS_DIR]);
				table.push(['workspace.dir  ', app.WORKSPACE_DIR]);
				table.push(['log.dir  ', app.LOG_DIR]);

				console.log(table.toString());
			} else if( text === 'ss' || text === 'status' || text === 'list' || text === 'ls' ) {
				if( !app ) return console.log('application not selected');

				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				var plugins = app.all();
				if( plugins && plugins.length > 0 ) {
					for(var i=0; i < plugins.length; i++) {
						var plugin = plugins[i];
						
						table.push([i + '  ', '' + plugin.status + '  ', plugin.pluginId + '  ', plugin.version, plugin.type + ' ']);
					}
					console.log(table.toString());
				} else {
					console.log('empty!');
				}
			} else if( text === 'start' ) {
				console.error('USAGE: "' + text + ' (pluginId) [@(version)]"');
			} else if( text === 'stop' ) {
				console.error('USAGE: "' + text + ' (pluginId) [@(version)]"');
			} else if( text === 'install' ) {
				console.error('USAGE: "' + text + ' (pluginId) [@(version)]"');
			} else if( text === 'uninstall' ) {
				console.error('USAGE: "' + text + ' (pluginId) [@(version)]"');
			} else if( text.startsWith('start ') ) {
				if( !app ) return console.log('application not selected');

				console.log('start plugin');
			} else if( text.startsWith('stop ') ) {
				if( !app ) return console.log('application not selected');

				console.log('stop plugin');
			} else if( text.startsWith('install ') ) {
				if( !app ) return console.log('application not selected');

				console.log('install plugin');
			} else if( text.startsWith('uninstall ') ) {
				if( !app ) return console.log('application not selected');

				console.log('uninstall plugin');
			} else if( text === 'help' || text === 'h' || text === '?' ) {
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
				table.push(['install {pluginId} {version}', 'install new plugin']);
				table.push(['uninstall {pluginId} {version}', 'uninstall selected plugin']);
				table.push(['quit || q || exit || bye', 'quit plugin.system']);
				table.push(['help || h || ?', 'help']);
				console.log(table.toString());
			} else if ( text === 'quit' || text === 'q' || text === 'exit' || text === 'exit' ) {
				process.exit();
			} else if( text ) {
				console.log('"' + text + '" is unknown command.');
			}
			
			if( app ) process.stdout.write('plexi> ');
			else process.stdout.write('> ');
		});
	}
}

module.exports = new CLInterface;