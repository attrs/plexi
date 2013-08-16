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
var collection = db.collection('creation');

collection.exists().complete(function(err, exists) {
	if( err ) console.log('error', err);

	if( !exists ) {
		collection.create([{
			keys: {idx:1},
			options: {unique:true}
		}], data).complete(function(err, collection) {
			if( err ) console.log('error', err);
			else console.log('collection created:', collection.collectionName);

			db.close();
		});
	} else {
		console.log('collection [' + collection.collectionId + '] already exist');
		db.close();
	}	
});