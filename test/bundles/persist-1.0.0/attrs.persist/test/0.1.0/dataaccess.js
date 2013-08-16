var Connections = require('../').Connections;

Connections.define({
	name: 'db1',
	config: {
		type: 'mongo',
		host: '127.0.0.1',
		port: 27017,
		userId: 'admin',
		password: '1',
		db: 'test'
	}
});

var data = [
	{ idx: 1, "cities" : [ { "name" : "New York" }, { "name" : null } ] },
	{ idx: 2, "cities" : [ { "name" : "Austin" }, { "color" : "blue" } ] },
	{ idx: 3, "name" : "test", "arg" : [ "facebook", "twitter", "daum", "naver" ] }
];

var db = Connections.get('db1');

if( true ) {
	var test = db.collection('test');
	var test2 = db.collection('test2');

	var start = new Date().getTime();
	test.insert(data).complete(function(err, data) {
		console.log('insert(1)', err, data, -(start - (start = new Date().getTime())) + 'ms');

		var inserted = data;	

		test.find().complete(function(err, data) {
			console.log('find(1)', err, data, -(start - (start = new Date().getTime())) + 'ms');		

			test.findOne({}).complete(function(err, data) {
				console.log('findOne(1)', err, data, -(start - (start = new Date().getTime())) + 'ms');

				for(var i=0;i < inserted.length; i++) {
					(function(item, isLast) {
						test.remove(item._id).complete(function(err, data) {
							console.log('removed(1)', err, data, -(start - (start = new Date().getTime())) + 'ms');

							if(isLast) db.close();
						});
					})( inserted[i], (i == (inserted.length - 1)) );
				}
			});
		});
	});

	// test2 --
	test2.insert(data).complete(function(err, data) {
		console.log('insert(2)', err, data, -(start - (start = new Date().getTime())) + 'ms');

		var inserted = data;

		test2.find().complete(function(err, data) {
			console.log('find(2)', err, data, -(start - (start = new Date().getTime())) + 'ms');

			test2.findOne({}).complete(function(err, data) {
				console.log('findOne(2)', err, data, -(start - (start = new Date().getTime())) + 'ms');
				
				for(var i=0;i < inserted.length; i++) {
					(function(item, isLast) {
						test2.remove(item._id).complete(function(err, data) {
							console.log('removed(2)', err, data, -(start - (start = new Date().getTime())) + 'ms');

							if(isLast) db.close();
						});
					})( inserted[i], (i == (inserted.length - 1)) );
				}
			});
		});
	});
	// -- test2
}