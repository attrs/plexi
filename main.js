var Application = require('./src/Application.js');
var Plugin = require('./src/Plugin.js');
var PluginManager = require('./src/PluginManager.js');
var Workspace = require('./src/Workspace.js');
var ApplicationError = require('./src/ApplicationError.js');

var cli = require('./cli-interface.js');

var app;
module.exports = {
	cli: cli,
	start: function(home_dir, argv) {
		app = new Application(home_dir, argv).start();
		cli.application(app).start();
		return app;
	},
	current: function() {
		return app;
	},
	Application: Application,
	Plugin: Plugin,
	PluginManager: PluginManager,
	Workspace: Workspace,
	ApplicationError: ApplicationError,
};