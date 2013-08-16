var path = require('path');

module.exports = {
	init: function(ctx) {
		var test = ctx.require('test.module');
		console.log('test.module', test);

		var api = ctx.require('http').router('/api/test');
		var doc = ctx.require('http').router('/test');
		
		api.get('/error', function(req, res, next) {
			next(new Error('error test'));
		});

		api.get('/:param', function(req, res, next) {
			res.send('test!' + req.params.param);
		});

		doc.static('/', path.join(__dirname, 'webapps'));
	}
};
