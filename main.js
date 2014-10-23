var Application = require('./src/Application.js');
var cli = require('./cli-interface.js');

module.exports = {
	cli: cli,
	startup: function(home_dir, bundle_dir, workspace_dir, log_dir) {
		var app = new Application(home_dir, bundle_dir, workspace_dir, log_dir);
		cli.add(app);
		return app;
	}
};