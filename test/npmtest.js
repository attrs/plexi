var npm = require("npm");

var config = {};
npm.load(config, function(err) {
	if(err) return console.error(err);
	
	npm.commands.install('./tmp', ['colors', 'attrs.argv'], function (err, data) {
		if(err) return console.error(err);
		
		console.log('installed data', data);
	});
	
	npm.on('log', function(message) {
		console.log('log:' + message);
	});
});