var Table = require('cli-table');
var Application = require('./src/Application.js');

var CLInterface = function CLInterface() {
	this.apps = {};
};

CLInterface.prototype = {
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
			
			var app = self.selected;
			
			if( text === 'switch' || text === 'use' ) {
				console.error('USAGE: "' + text + ' (applicationId)"');
			} else if( text.startsWith('switch ') || text.startsWith('use ') ) {
				var appname = text.substring(text.indexOf(' ') + 1);
				
				try {
					self.select(appname);
					console.log('switched to [' + appname + ']');
				} catch(err) {
					console.error('application [' + appname + '] does not exists', err);
				}
			} else if( text === 'apps' || text === 'applications' ) {
				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				for(var k in self.apps) {
					table.push([k + '  ', app.name + '  ', app.HOME]);
				}

				console.log(table.toString());
			} else if( text === 'profile' || text === 'p' ) {
				if( !app ) return console.log('application not selected');

				var table = new Table({
					chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
						, 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
						, 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
						, 'right': '' , 'right-mid': '' , 'middle': ' ' },
					 style: { compact : true, 'padding-left' : 1 }
				});

				table.push(['applicationId  ', app.applicationId]);
				table.push(['name  ', app.name]);
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
				
				table.push(['apps || applications', 'show application list']);
				table.push(['use {appid} || switch {appid}', 'switching application']);
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
			
			if( app ) process.stdout.write(app.applicationId + '> ');
			else process.stdout.write('> ');
		});
	},
	
	add: function(app) {
		if( !(app instanceof Application) ) throw new Error('invalid application');

		this.apps[app.applicationId] = app;
		if( !this.selected ) this.select(app);
	},
	remove: function(app) {
		if( app instanceof Application ) app = app.applicationId;
		if( typeof(app) !== 'string' ) throw new Error('invalid application id');
		delete this.apps[app];
	},
	select: function(app) {
		if( app instanceof Application ) app = app.applicationId;
		if( typeof(app) !== 'string' ) throw new Error('invalid application id');

		if( !this.apps[app] ) throw new Error('not exists application:' + app);

		this.selected = this.apps[app];
	}
}

module.exports = new CLInterface;