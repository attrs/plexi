var Application = require('./Application.js');
var Plugin = require('./Plugin.js');
var Logger = require('./Logger.js');
var PluginManager = require('./PluginManager.js');
var Workspace = require('./Workspace.js');
var ApplicationError = require('./ApplicationError.js');

var cli = require('./cli.js');

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
	PluginDescriptor: Plugin.PluginDescriptor,
	PluginIdentifier: Plugin.PluginIdentifier,
	PluginContext: Plugin.PluginContext,
	PluginManager: PluginManager,
	Logger: Logger,
	Workspace: Workspace,
	ApplicationError: ApplicationError,
};