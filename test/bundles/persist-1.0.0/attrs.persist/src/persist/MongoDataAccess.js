var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var BSON = require('mongodb').pure().BSON;
var Map = require('../Map.js');

//var connections = new Map();

// class MongoDataAccess
function MongoDataAccess(options) {
	if( !options ) throw new Error('missing_parameter:options');
	if( !options.db ) throw new Error('missing_parameter:options.db');

	var o = this.options = options;
	o.port = o.port || 27017;
	o.host = o.host || 'localhost';
	o.db = o.db;

	var url = o.host + ':' + o.port + '/' + o.db;
	if( o.userId ) o.userId + ':' + (o.password || '') + '@' + url;
	this.url = url;

	//var cache = connections.get(url);
	//if( cache ) return cache;
	//else connections.set(url, this);

	this.server = new mongodb.Server(o.host, o.port, {auto_reconnect:((o.auto_reconnect === false) ? false: true), poolSize:(o.poolSize || 5), socketOptions: {encoding: o.encoding||'utf-8'}});
	this.db = o.db;

	this.collections = {};
}

MongoDataAccess.prototype.__defineGetter__('db', function() {
	return this._db;
});
MongoDataAccess.prototype.__defineSetter__('db', function(db) {
	if( db ) {
		if( typeof(db) !== 'string' ) throw new Error('db name must be a string');
		this._db = new mongodb.Db(db, this.server, {safe: true, strict: true});
	} else {
		if( this._db ) this._db.close();
		delete this._db;
	}
});

MongoDataAccess.prototype.close = function close() {
	this.db.close();
};

MongoDataAccess.prototype.collection = function collection(collectionId) {
	if( !collectionId ) throw new Error('missing_parameter:collectionId');
	
	var c = this.collections[collectionId];
	if( !c ) {
		c = new Collection(this.db, collectionId);
		this.collections[collectionId] = c;
	}

	return c;
};

module.exports = MongoDataAccess;

// class Collection
function Collection(db, collectionId) {
	if( !db) throw new Error('missing_parameter:db');
	if( !collectionId) throw new Error('missing_parameter:collectionId');
	
	this.db = db;
	this.collectionId = collectionId;
}

function error_complete(msg) {
	return {
		done: function(fn) {
			if( typeof(msg) === 'string' ) msg = new Error(msg);
			fn(msg);
		}
	};
}

Collection.prototype = {
	exists: function() {
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collectionsInfo(collectionId).toArray(function(err, info) {
					if( err ) return fn(err);

					if( info[0] ) fn(null, true);
					else fn(null, false);
				});
			}
		};
	},
	create: function(o) {
		if( !o ) return error_complete('missing options');

		var indexes = o.indexes;
		var initial = o.initial;
		var options = o.options;

		if( indexes && !Array.isArray(indexes) ) return error_complete('indexes must be array');
		if( initial && !Array.isArray(initial) ) return error_complete('initial data must be array');
		
		if( !indexes ) indexes = [];
		if( !initial ) initial = [];

		if( typeof(options) !== 'object' ) options = {};
		if( options.strict !== false ) options.strict = true;
		if( options.autoIndexId !== true ) options.autoIndexId = false;
		if( typeof(options.w) !== 'number' ) options.w = 1;

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collectionsInfo(collectionId).toArray(function(err, info) {
					if( err ) return fn(err);
					if( info[0] ) return fn('already_exists');

					db.createCollection(collectionId, options, function(err, collection) {
						if( err ) return fn(err);

						var tasks = [];
						var i=0;
						for(; i < indexes.length; i++) {
							(function(i, index) {
								tasks.push(function() {
									var o = index.options;
									if( o.dropDups !== false ) o.dropDups = true;
									if( o.background !== false ) o.background = true;
									if( typeof(o.w) !== 'number' ) o.w = 1;

									collection.ensureIndex(index.keys, o, function(err, data) {
										if( err ) return fn(err, data);

										var next = tasks[i+1];
										if( next ) next();
										else fn(null, collection);
									});
								});
							})(i, indexes[i]);
						}
						
						if( initial && initial.length > 0 ) {
							(function(i, initial) {
								tasks.push(function() {
									collection.insert(initial, {w:1}, function(err, data) {
										if( err ) return fn(err, data);

										var next = tasks[i+1];
										if( next ) next();
										else fn(null, collection);
									});
								})
							})(i++, initial);
						}

						if( tasks[0] ) tasks[0]();
					});
				});
			}
		};
	},
	drop: function() {
		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.dropCollection(collectionId, function(err, result) {
					fn(err, result);							
				});
			}
		};
	},
	ensureIndexes: function(o) {
		if( !o ) return error_complete('missing options');

		var indexes = o.indexes;

		if( !indexes ) return error_complete('missing indexes');
		if( !Array.isArray(indexes) ) indexes = [indexes];
		
		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					var tasks = [];
					var indexNames = [];
					for(var i=0; i < indexes.length; i++) {
						(function(i, index) {
							tasks.push(function() {
								var o = index.options;
								if( o.dropDups !== false ) o.dropDups = true;
								if( o.background !== false ) o.background = true;
								if( typeof(o.w) !== 'number' ) o.w = 1;
								
								collection.ensureIndex(index.keys, o, function(err, data) {
									if( err ) return fn(err, data);

									indexNames.push(data);

									var next = tasks[i+1];
									if( next ) next();
									else fn(null, indexNames);
								});
							});
						})(i, indexes[i]);
					}
					if( tasks[0] ) tasks[0]();
				});
			}
		};
	},
	index: function(o) {
		if( !o ) return error_complete('missing options');

		var keys = o.keys;
		var options = o.options;

		if( !keys ) return error_complete('missing options.keys');
		if( !options ) return error_complete('missing options.options');

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.ensureIndex(keys, options, function(err, indexName) {
						fn(err, indexName);
					});
				});				
			}
		};
	},
	find: function(o) {
		if( !o ) o = {};
		
		var condition = o.condition || {};
		var start = o.start;
		var limit = o.limit;
		var fields = o.fields;
		var	sort = o.sort;
		var options = o.options;
				
		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.count(condition, function(err, count) {
						if( err ) return fn(err);

						if( count <= 0 ) {
							if( start || limit ) {
								fn(err, {
									condition: condition,
									sort: sort,
									start: start,
									limit: limit,
									total: count,
									rows: []
								});
							} else {
								fn(err, []);
							}
							return;
						}

						if( start || limit ) {
							start = parseInt(start);
							limit = parseInt(limit);

							if( !isNaN(start) ) start = start;
							if( !isNaN(limit) ) limit = limit;
						}

						var cursor = null;
						
						if( fields ) cursor = collection.find(condition, fields, options);
						else if( options ) cursor = collection.find(condition, options);
						else cursor = collection.find(condition);

						if( sort ) cursor = cursor.sort(sort);
						if( limit ) cursor = cursor.limit(limit);
						if( start ) cursor = cursor.skip(start);

						//cursor.nextObject(function(err, doc) {});
						//cursor.each(function(err, doc) {});
						//cursor.rewind();

						cursor.toArray(function(err, items) {
							if( err ) return fn(err, items);						

							if( start || limit ) {
								fn(err, {
									condition: condition,
									sort: sort,
									fields: fields,
									options: options,
									start: start,
									limit: limit,
									total: count,
									rows: items
								});									
							} else {
								fn(err, items);
							}
						});
					});
				});
			}
		};
	},
	findOne: function(o) {
		if( !o ) o = {};
				
		var condition = o.condition || {};
		var fields = o.fields;

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					var callback = function(err, item) {
						if( err ) return fn(err, item);

						fn(err, item);
					};

					if( fields ) collection.findOne(condition, fields, callback);
					else collection.findOne(condition, callback);
				});
			}
		};
	},
	insert: function(o) {
		if( !o ) return error_complete('missing options');
				
		var data = o.data;
		var options = o.options;

		if( !data ) return error_complete('missing_paramter:data');

		//if( !options ) options = {w:1,safe:true};	//,serializeFunctions:true
		if( !options ) options = {};
		if( options.w === undefined ) options.w = 1;
		if( options.safe === undefined ) options.safe = true;
		
		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.insert(data, options, function(err, item) {
						if( err ) return fn(err, item);

						fn(err, item);
					});
				});
			}
		};
	},	
	save: function(o) {
		if( !o ) return error_complete('missing options');
				
		var data = o.data;
		var options = o.options;

		if( !data ) return error_complete('missing_paramter:data');
		
		if( !options ) options = {};
		if( options.w === undefined ) options.w = 1;
		if( options.safe === undefined ) options.safe = true;

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.save(data, options, function(err, item) {
						if( err ) return fn(err, item);

						fn(err, {
							updated: item
						});
					});
				});
			}
		};
	},
	upsert: function(o) {
		if( !o ) return error_complete('missing options');
				
		var data = o.data;
		var condition = o.condition;
		var options = o.options;

		if( !options ) options = {};
		if( options.multi !== true ) options.multi = false;
		options.upsert = true;

		//if( !data._id ) data._id = new ObjectID();

		return this.update({
			condition: condition,
			data: data,
			options: options
		});
	},
	update: function(o) {
		if( !o ) return error_complete('missing options');
				
		var data = o.data;
		var condition = o.condition;
		var options = o.options;

		if( !data ) return error_complete('missing_paramter:data');
		
		if( !options ) options = {};
		if( options.w === undefined ) options.w = 1;
		if( options.safe === undefined ) options.safe = true;
		if( options.multi !== false ) options.multi = true;

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.update(condition, data, options, function(err, item) {
						if( err ) return fn(err, item);

						fn(err, {
							updated: item
						});
					});
				});
			}
		};
	},
	remove: function(o) {
		if( !o ) return error_complete('missing options');

		var condition = o.condition;
		var options = o.options;
	
		if( !options ) options = {};
		if( options.w === undefined ) options.w = 1;
		if( options.safe === undefined ) options.safe = true;

		var self = this;
		var db = this.db;
		var collectionId = this.collectionId;
		return {
			done: function(fn) {
				db.collection(collectionId, function(err, collection) {
					if( err ) return fn(err);

					collection.remove(condition, options, function(err, item) {
						if( err ) return fn(err, item);

						fn(err, item);
					});
				});
			}
		};
	}
};

