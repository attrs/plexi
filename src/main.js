var Application = require('./Application.js');
var Plugin = require('./Plugin.js');
var Logger = require('./Logger.js');
var PluginManager = require('./PluginManager.js');
var Workspace = require('./Workspace.js');
var ApplicationError = require('./ApplicationError.js');

var app;
module.exports = {
	start: function(home_dir, argv) {
		app = new Application(home_dir || process.cwd(), argv).start();
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
	commands: {
		init: function(filename, options, fn) {
			
		},
		start: function(options, fn) {
			
		},
		install: function(pkgs, options, fn) {
			
		},
		uninstall: function(pkgs, options, fn) {
			
		},
		link: function(files, fn) {
			
		},
		unlink: function(files, fn) {
			
		},
		update: function(fn) {
			
		},
		lint: function(fn) {
			
		}
	}
};