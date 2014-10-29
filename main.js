var Application = require('./src/Application.js');
var cli = require('./cli-interface.js');

module.exports = {
	cli: cli,
	startup: function(home_dir) {
		var app = new Application(home_dir);
		cli.application(app);
		return app;
	}
};