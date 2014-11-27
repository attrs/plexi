var Application = require('./src/Application.js');
var Plugin = require('./src/Plugin.js');
var PluginManager = require('./src/PluginManager.js');
var Workspace = require('./src/Workspace.js');
var ApplicationError = require('./src/ApplicationError.js');

var cli = require('./cli-interface.js');

module.exports = {
	cli: cli,
	startup: function(home_dir, argv) {
		var app = new Application(home_dir, argv);
		cli.application(app);
		return app;
	},
	current: function() {
		return Application.instance;
	},
	Application: Application,
	Plugin: Plugin,
	PluginManager: PluginManager,
	Workspace: Workspace,
	ApplicationError: ApplicationError,
};