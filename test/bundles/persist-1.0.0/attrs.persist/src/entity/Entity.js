var Connections = require('../persist/Connections.js');
var Schema= require('./Schema.js');


var Entity = function Entity(o) {
	if( !o.id ) throw new TypeError('id missing');
	if( typeof(o.id) !== 'string' ) throw new TypeError('id must be a string');
	if( typeof(o.schema) !== 'object' ) throw new TypeError('schema must be an object');
	if( o.preprocessor && typeof(o.preprocessor) !== 'function' ) throw new TypeError('preprocessor must be a function');
	if( o.indexes && !Array.isArray(o.indexes) ) throw new TypeError('indexes must be an array');
	if( o.initial && !Array.isArray(o.initial) ) throw new TypeError('initial must be an array');
	
	var id = o.id;
	var schema = ((o.schema instanceof Schema) ? o.schema : new Schema(o.schema, o.options));
	var preprocessor = o.preprocessor;
	var indexes = o.indexes;
	var initial = o.initial;

	var EntityClass = function(o) {
		if( o && typeof(o) !== 'object' ) throw new TypeError('values must be an object:' + o);
		fill(o, schema, preprocessor, this);
	};

	EntityClass.prototype = {
		check: function() {
			return schema.check(this);
		},
		validate: function() {
			return schema.validate(this);
		},
		toObject: function() {
			return schema.extract(this);
		},
		condition: function() {
			var condition = {};

			for(var i=0; i < schema.primaryKeys.length; i++) {
				var key = schema.primaryKeys[i];
				var value = this[key];

				if( !value ) throw new Error('primary key value cannot be null');

				condition[key] = value;
			}
			
			return condition;
		}
	};

	EntityClass.__defineGetter__('id', function() {
		return id;
	});
	EntityClass.__defineGetter__('schema', function() {
		return schema;
	});
	EntityClass.__defineGetter__('preprocessor', function() {
		return preprocessor;
	});
	EntityClass.__defineGetter__('indexes', function() {
		return indexes;
	});
	EntityClass.__defineGetter__('initial', function() {
		return initial;
	});

	EntityClass.of = function(conn) {
		return new PersistableEntity(id, schema, preprocessor, indexes, initial, conn);		
	};

	return EntityClass;
};

module.exports = Entity;


var fill = function(o, schema, preprocessor, target, check) {
	if( !o ) o = {};
	if( typeof(o) !== 'object' ) throw new TypeError('value object must be an object');

	if( preprocessor ) o = preprocessor(o) || o;

	for(var k in target) {
		if( target.hasOwnProperty(k) ) 
			delete target[k];
	}

	for(var k in o) {
		if( o.hasOwnProperty(k) ) target[k] = o[k];
	}

	schema.validate(target);
};


// persist session
var PersistableEntity = function PersistableEntity(id, schema, preprocessor, indexes, initial, conn) {
	var debug = true;
	var ensured = false;

	if( typeof(conn) === 'string' ) conn = Connections.get(conn) || conn;
	if( !(conn instanceof Connections) ) throw new TypeError('invalid connection:' + conn);

	var dao = conn.collection(id);

	var PersistableEntityClass = function(o) {
		if( o && typeof(o) !== 'object' ) throw new TypeError('values must be an object:' + o);
		fill(o, schema, preprocessor, this);
	};

	PersistableEntityClass.prototype = {
		check: function() {
			return schema.check(this);
		},
		validate: function() {
			return schema.validate(this);
		},
		toObject: function() {
			return schema.extract(this);
		},
		condition: function() {
			var condition = {};

			for(var i=0; i < schema.primaryKeys.length; i++) {
				var key = schema.primaryKeys[i];
				var value = this[key];

				if( !value ) throw new Error('primary key value cannot be null');

				condition[key] = value;
			}
			
			return condition;
		},
		save: function() {
			var self = this;
			return {
				done: function(fn) {
					try {
						// check entity
						var condition = self.condition();
						var data = self.toObject();

						// upsert
						PersistableEntityClass.upsert({
							condition: condition,
							data: data
						}).done(function(err, result) {
							if( err ) return fn(err);
							fn(null, self);
						});
					} catch(e) {
						fn(e);
					}
				}
			};
		},
		reload: function() {
			var self = this;
			return {
				done: function(fn) {
					var condition = self.condition();

					PersistableEntityClass.findOne({
						condition: condition,
						wrap: false
					}).done(function(err, o) {
						if( err ) return fn(err);
						fill(o, schema, preprocessor, self);
						fn(null, self);
					});
				}
			};		
		},
		remove: function() {
			var self = this;
			
			return {
				done: function(fn) {
					var condition = self.condition();

					PersistableEntityClass.remove({
						condition: condition
					}).done(function(err, removed) {
						if( err ) return fn(err);

						fn(null, removed);
					});
				}
			};
		}
	};

	PersistableEntityClass.__defineGetter__('id', function() {
		return id;
	});
	PersistableEntityClass.__defineGetter__('schema', function() {
		return schema;
	});
	PersistableEntityClass.__defineGetter__('preprocessor', function() {
		return preprocessor;
	});
	PersistableEntityClass.__defineGetter__('indexes', function() {
		return indexes;
	});
	PersistableEntityClass.__defineGetter__('initial', function() {
		return initial;
	});
	PersistableEntityClass.__defineGetter__('dao', function() {
		return dao;
	});

	PersistableEntityClass.ensure = function() {
		if( ensured ) {
			return {
				done: function(fn) {
					fn(null, true);
				}
			};
		}

		var indexes = schema.indexes;
		var self = this;

		//console.log('ensure', JSON.stringify(indexes, null, '\t'));

		if( initial ) {
			for(var i=0; i < initial.length; i++) {
				initial[i] = new PersistableEntityClass(initial[i]).toObject();
			}
		}

		//console.log('initial', JSON.stringify(initial, null, '\t'));

		return {
			done: function(fn) {
				dao.exists().done(function(err, exists) {
					if( err ) {						
						if( debug ) console.error('entity check error(index):', err);
						return fn(err);
					}

					if( !exists ) {
						if( debug ) console.info('schema[' + id + '] will create'); //, indexes, initial);
						dao.create({
							indexes: indexes,
							initial: initial
						}).done(function(err, result) {
							dao.db.close();
							if( err ) {
								if( debug ) console.error('entity creation error:', err);
								dao.drop().done(function(err2, result) {
									return fn(err);
								});
								return;
							}

							if( debug ) console.info('schema[' + id + '] created.', indexes, initial);
							ensured = true;
							fn(null, result);
						});
					} else {
						if( debug ) console.info('schema[' + id + '] index check.'); //, indexes);
						dao.ensureIndexes({
							indexes: indexes
						}).done(function(err, result) {
							dao.db.close();
							if( err ) {
								if( debug ) console.error('entity check error(index):', err);
								return fn(err);
							}

							if( debug ) console.info('schema[' + id + '] index ensured.', indexes);
							ensured = true;
							fn(null, result);
						});
					}
				});
			}
		};
	};
	PersistableEntityClass.drop = function() {
		var self = this;
		return {
			done: function(fn) {
				self.drop().done(function(err, result) {
					dao.db.close();
					if( err ) return fn(err);

					fn(err, result);
				});
			}
		};
	};
	PersistableEntityClass.exists = function() {
		var self = this;
		return {
			done: function(fn) {
				self.exists().done(function(err, result) {
					dao.db.close();
					if( err ) return fn(err);

					fn(err, result);
				});
			}
		};
	};
	PersistableEntityClass.recreate = function() {
		var self = this;
		return {
			done: function(fn) {
				self.drop().done(function(err, result) {
					if( err ) return fn(err);

					self.ensure().done(function(err, result) {
						dao.db.close();
						if( err ) return fn(err);
						fn(null, result);
					});
				});
			}
		};
	};
	PersistableEntityClass.ensureIndexes = function() {
		return dao.ensureIndexes.apply(dao, [{indexes:indexes}]);
	};
	PersistableEntityClass.find = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) o = {};

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);

					dao.find({
						condition: o.condition || {},
						start: o.start,
						limit: o.limit,
						sort: o.sort,
						fields: o.fields,
						options: o.options
					}).done(function(err, items) {
						dao.db.close();
						if( err ) return fn(err);

						fn(null, items);
					});
				});
			}
		};
	};
	PersistableEntityClass.findOne = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) o = {};

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);
				
					dao.findOne({
						condition: o.condition || {},
						fields: o.fields
					}).done(function(err, item) {
						dao.db.close();
						if( err ) return fn(err);

						if( o.wrap !== false && item ) item = new PersistableEntityClass(item);

						fn(null, item);
					});
				});
			}
		};
	};
	PersistableEntityClass.insert = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) return fn(new Error('missing options'));
				if( !o.data ) return fn(new Error('missing options.data'));

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);
					
					dao.insert({
						data: o.data,
						options: o.options
					}).done(function(err, result) {
						dao.db.close();
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	};
	PersistableEntityClass.update = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) return fn(new Error('missing options'));
				if( !o.condition ) return fn(new Error('missing options.condition'));
				if( !o.data ) return fn(new Error('missing options.data'));

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);

					dao.update({
						condition: o.condition,
						data: {'$set': o.data},
						options: o.options
					}).done(function(err, result) {
						dao.db.close();
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	};
	PersistableEntityClass.upsert = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) return fn(new Error('missing options'));
				if( !o.condition ) return fn(new Error('missing options.condition'));
				if( !o.data ) return fn(new Error('missing options.data'));

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);					

					dao.upsert({
						condition: o.condition,
						data: o.data,
						options: o.options
					}).done(function(err, result) {
						dao.db.close();
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	};
	PersistableEntityClass.remove = function(o) {
		var self = this;

		return {
			done: function(fn) {
				if( !o ) return fn(new Error('missing options'));
				if( !o.condition ) return fn(new Error('missing options.condition'));

				self.ensure().done(function(err, ensured) {
					if( err ) return fn(err);

					dao.remove({
						condition: o.condition,
						options: o.options
					}).done(function(err, result) {
						dao.db.close();
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	};

	return PersistableEntityClass;
};
