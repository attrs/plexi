var plexi = require('../../');
var app = plexi.instance(__dirname);

if( app ) {
	console.log('this is main.js. plexi is running on', app.home);
} else {
	console.log('not found plexi instance');
}


module.exports = app;