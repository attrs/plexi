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
				table.push(['bundle.home  ', app.BUNDLE_HOME]);
				table.push(['workspace.home  ', app.WORKSPACE_HOME]);
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

				var bundles = app.bundles.all();
				if( bundles && bundles.length > 0 ) {
					for(var i=0; i < bundles.length; i++) {
						var bundle = bundles[i];
						table.push([i + '  ', '' + bundle.status + '  ', bundle.bundleId + '  ', bundle.version, bundle.type + ' ']);
					}
				} else {
					console.log('nothing');
				}

				console.log(table.toString());
			} else if( text === 'start' ) {
				console.error('USAGE: "' + text + ' (index)"');
			} else if( text === 'stop' ) {
				console.error('USAGE: "' + text + ' (index)"');
			} else if( text === 'install' ) {
				console.error('USAGE: "' + text + ' (bundleId) [(version)]"');
			} else if( text === 'uninstall' ) {
				console.error('USAGE: "' + text + ' (bundleId) [(version)]"');
			} else if( text.startsWith('start ') ) {
				if( !app ) return console.log('application not selected');

				console.log('start bundle');
			} else if( text.startsWith('stop ') ) {
				if( !app ) return console.log('application not selected');

				console.log('stop bundle');
			} else if( text.startsWith('install ') ) {
				if( !app ) return console.log('application not selected');

				console.log('install bundle');
			} else if( text.startsWith('uninstall ') ) {
				if( !app ) return console.log('application not selected');

				console.log('uninstall bundle');
			} else if( text === 'help' || text === 'h' || text === '?' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});
				
				table.push(['profile || p', 'show system profile']);
				table.push(['ss || status || list || ls', 'show bundle status list']);
				table.push(['start {index}', 'start bundle']);
				table.push(['stop {index}', 'stop bundle']);
				table.push(['stop all', 'stop all bundles']);
				table.push(['install {bundleId} {version}', 'install new bundle']);
				table.push(['uninstall {bundleId} {version}', 'uninstall selected bundle']);
				table.push(['quit || q || exit || bye', 'quit bundle.system']);
				table.push(['help || h || ?', 'help']);
				console.log(table.toString());
			} else if ( text === 'quit' || text === 'q' || text === 'exit' || text === 'exit' ) {
				process.exit();
			} else if( text ) {
				console.log('"' + text + '" is unknown command.');
			}
			
			if( app ) process.stdout.write('attrs.plugins> ');
			else process.stdout.write('> ');
		});
	}
}

module.exports = new CLInterface;