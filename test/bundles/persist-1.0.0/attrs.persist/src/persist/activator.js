
var Activator = {
	start: function(application) {
		console.log('[' + this.bundleId + '] starting...');

		var options = this.options;
		var path = application.require('path');
		var http = application.require('http');

		var app = http.context('/');
		app.static('/appbus', path.join(__dirname, 'dist'));
		app.static('/appbus/docs', path.join(__dirname, 'docs'));
		app.static('/appbus/src', path.join(__dirname, 'src'));

		console.log('[' + this.bundleId + '] started!');
	},

	stop: function(application) {
		console.log('[' + this.bundleId + '] stopping...');
		
		var http = application.require('http');
		var app = http.context('/');
		app.remove('/appbus');
		app.remove('/appbus/docs');
		app.remove('/appbus/src');
		
		console.log('[' + this.bundleId + '] stopped...');
	}
};

module.exports = Activator;
