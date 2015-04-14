var Application = require('./src/core/Application.js');
var pkg = require('./package.json');

var app = new Application(process.cwd(), process.env);

global.plexi = {
	currentApplication: app
};

module.exports = {
	version: pkg.version,
	start: function(options) {
		app.start(options);
	},
	commands: app.commands
};