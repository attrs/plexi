var Connections = require('../persist/Connections.js');
var Schema= require('./Schema.js');

var entities = {};

// class Entity
function Entity(name, schema, config) {
	if( !name ) throw new TypeError('name missing');
	if( typeof(name) !== 'string' ) throw new TypeError('name must be a string');
	if( typeof(schema) !== 'object' ) throw new TypeError('schema must be a object');
	
	this.config = config;	
	this.schema = schema;
	this.entityName = name;

	entities[name] = this;
}

module.exports = Entity;

Entity.get = function get(name) {
	return entities[name];
};

Entity.remove = function get(name) {
	delete entities[name];
};

Entity.prototype = {
	ensure: function() {
		if( this.ensured ) {
			return {
				complete: function(fn) {
					fn(null, true);
				}
			};
		}

		var indexes = this.indexes;
		var initial = this.initialData;
		var self = this;

		if( initial ) {
			for(var i=0; i < initial.length; i++) {
				initial[i] = self.create(initial[i]).toObject();
			}
		}

		var dao = this.dao;
		return {
			complete: function(fn) {
				dao.exists().complete(function(err, exists) {
					if( err ) {						
						if( self.debug ) console.error('entity check error(index):', err);
						return fn(err);
					}

					if( !exists ) {
						if( self.debug ) console.info('schema[' + dao.collection + '] initializing'); //, indexes, initial);
						dao.create(indexes, initial).complete(function(err, result) {
							if( err ) {
								if( self.debug ) console.error('entity creation error:', err);
								dao.drop().complete(function(err2, result) {
									return fn(err);
								});
								return;
							}

							if( self.debug ) console.info('schema[' + dao.collection + '] created.', indexes, initial);
							self.ensured = true;
							fn(null, result);
						});
					} else {
						if( self.debug ) console.info('schema[' + dao.collection + '] index check.'); //, indexes);
						dao.ensureIndexes(indexes).complete(function(err, result) {
							if( err ) {
								if( self.debug ) console.error('entity check error(index):', err);
								return fn(err);
							}

							if( self.debug ) console.info('schema[' + dao.collection + '] index ensured.', indexes);
							self.ensured = true;
							fn(null, result);
						});
					}
				});
			}
		};
	},
	drop: function() {
		return this.dao.drop.call(this.dao);
	},
	exists: function() {
		return this.dao.exists.call(this.dao);
	},
	recreate: function() {
		var self = this;
		return {
			complete: function(fn) {
				self.drop().complete(function(err, result) {
					if( err ) return fn(err);

					self.ensure().complete(function(err, result) {
						if( err ) return fn(err);
						fn(null, result);
					});
				});
			}
		};
	},
	ensureIndexes: function() {
		var indexes = this.indexes;
		return this.dao.ensureIndexes.apply(this.dao, [indexes]);
	},
	create: function(data) {
		if( typeof(data) !== 'object' ) throw new TypeError('data must be a object');

		return new EntityObject(this, data);
	},
	findById: function(id) {
		var condition = {};
		condition[this.primaryKey] = id;
		return this.findOne(condition);
	},
	find: function(condition, start, limit, sort) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);

					dao.find(condition, start, limit, sort).complete(function(err, items) {
						if( err ) return fn(err);

						if( items || items.rows ) {
							var target = items.rows || items;
							for(var i=0; i < items.length; i++) {
								target[i] = self.create(items[i]);
							}
						}
						fn(null, items);
					});
				});
			}
		};
	},
	findOne: function(condition) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);
				
					dao.findOne(condition).complete(function(err, item) {
						if( err ) return fn(err);

						if( item ) item = self.create(item);
						fn(null, item);
					});
				});
			}
		};
	},
	insert: function(data, options) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);
					
					dao.insert(data, options).complete(function(err, result) {
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	},
	update: function(condition, data, options) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);

					dao.update(condition, data, options).complete(function(err, result) {
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	},
	upsert: function(condition, data, options) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);

					dao.upsert(condition, data, options).complete(function(err, result) {
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	},
	remove: function(condition, options) {
		var dao = this.dao;
		var self = this;

		return {
			complete: function(fn) {
				self.ensure().complete(function(err, ensured) {
					if( err ) return fn(err);

					dao.remove(condition, options).complete(function(err, result) {
						if( err ) return fn(err);

						fn(null, result);
					});
				});
			}
		};
	},
	check: function(data, fillDefaults) {		
		// check constraints & fill defaults
		var schema = this.schema;
		if( !schema ) return true;

		var result = {};

		var items = schema.getItems();
		for(var k in items) {
			if( !items.hasOwnProperty(k)) continue;

			var item = items[k];
			try {
				var v = item.validateValue(data[k]);
				if( fillDefaults && v ) data[k] = v;
			} catch(e) {
				if( !result.errors ) result.errors = {};
				result.errors[k] = e;
			}
		}

		return result.errors;
	},
	isValid: function(data) {
		try {
			var b = this.check(data);
			return (b === true);
		} catch(e) {
			console.warn('warn:validation error', e);
			return false;
		}
	}
};

// setup static methods
Entity.prototype.__defineGetter__('dao', function() {
	var db = this.db;
	var collection = this.collection;
	var primaryKey = this.primaryKey;

	if( !db ) throw new Error('not configured to persist:db');
	if( !collection ) throw new Error('not configured to persist:collection');

	var dao = db.collection(collection);
	dao.primaryKey(primaryKey);
	return dao;
});

Entity.prototype.__defineGetter__('config', function() {
	return this._config;
});
Entity.prototype.__defineSetter__('config', function(config) {
	if( !config ) {
		delete this._config;
		delete this._db;
		delete this._configpk;
		delete this.dynamic;
		return;
	}
	
	this._config = config;
	this.db = config.db;
	this.collection = config.collection;
	this.initialData = config.initialData || config.initial;		
	this._configpk = config.primaryKey;
	this.dynamic = config.dynamic;
});

Entity.prototype.__defineGetter__('indexes', function() {
	var indexes = [];

	if( this.schema && this.schema.indexes ) indexes = indexes.concat(this.schema.indexes);
	if( this.config && this.config.indexes ) indexes = indexes.concat(this.config.indexes);
	return indexes;
});

Entity.prototype.__defineGetter__('db', function() {
	return this._db;
});
Entity.prototype.__defineSetter__('db', function(db) {
	if( !db ) {
		delete this._db;
		return;
	}

	if( typeof(db) === 'string' ) { 
		var d = Connections.get(db);
		if( !d ) throw new Error('not defined db:' + db);		
		this._db = d;
	} else if( typeof(db) === 'object' ) {
		this._db = Connections.define(db);
	} else {
		throw new TypeError('invalid db type');
	}
});

Entity.prototype.__defineGetter__('schema', function() {
	return this._schema;
});
Entity.prototype.__defineSetter__('schema', function(schema) {
	if( !schema ) {
		delete this._schema;
		delete this._schemapk;
		return;
	}

	this._schema = new Schema(schema);

	// extract schema primary keys
	this._schemapk = this._schema.getPrimaryKey();

	//TODO: extract pseudo attributes
});

Entity.prototype.__defineGetter__('primaryKey', function() {
	return this._schemapk || this._configpk;
});

Entity.prototype.__defineGetter__('collection', function() {
	if( this._collection ) return this._collection;

	return this.entityName.toLowerCase().split('.').join('_');
});

Entity.prototype.__defineSetter__('collection', function(collection) {
	if( !collection ) {
		delete this._collection;
		return;
	}

	this._collection = collection;
});



// class EntityObject
function EntityObject(entity, data) {
	this.constructor.entity = entity;
	this.refill(data, true);
}

EntityObject.prototype = {
	refill: function(data, fillDefaults) {
		if( typeof(data) !== 'object' ) throw new Error('invalid data');
		if( data === this ) throw new Error('illegal state:circular');

		for(var k in this) {
			if( !this.hasOwnProperty(k) ) continue;
			delete this[k];
		}

		for(var k in data) {
			if( !data.hasOwnProperty(k) ) continue;
			this[k] = data[k];
		}
		
		this.constructor.entity.check(this, fillDefaults);
	},
	errors: function() {
		return this.constructor.entity.check(this);
	},
	reload: function() {
		var self = this;
		var cls = this.constructor.entity;

		var pk = this[cls.primaryKey];
		if( !pk ) throw new Error('illegal state: primary key[' + cls.primaryKey + '] is missing');		
		var condition = {};
		condition[cls.primaryKey] = pk;

		return {
			complete: function(fn) {
				cls.findOne(condition).complete(function(err, doc) {
					if( err ) return fn.call(self, err);

					try {
						self.refill(doc);
						fn.call(self, null, self);
					} catch(err) {
						fn.call(self, err);
					}
				});
			}
		};
	},
	save: function(modify) {
		var self = this;
		var cls = this.constructor.entity;
		var errors = this.errors();

		if( modify ) {
			// modify 모드일 경우 수정할 컬럼만 체크한다.
			var schema = cls.schema;
			if( schema ) {
				for(var k in this) {
					if( !this.hasOwnProperty(k) ) continue;
					
					var item = schema.getItem(k);
					if( item ) item.validateValue(this[k]);
				}
			}
		} else if( errors ) {
			console.error(errors);
			throw new Error('data has errors');
		}

		var pk = this[cls.primaryKey];
		if( !pk ) throw new Error('illegal state: primary key[' + cls.primaryKey + '] is missing');
		var condition = {};
		condition[cls.primaryKey] = pk;

		var o = this.toObject();
		if( modify ) o = {$set:o};
		return {
			complete: function(fn) {
				var action;
				
				if( modify ) action = cls.update(condition, o);
				else action = cls.upsert(condition, o);

				action.complete(function(err, saved) {
					if( err ) return fn.call(self, err);

					if( modify ) {
						// modify 모드의 경우 리로드한다.
						self.reload().complete(function(err, updated) {
							if( err ) return fn.call(self, err);
							fn.call(self, null, self);
						});
					} else {
						fn.call(self, null, self);
					}
				});
			}
		};
	},
	remove: function() {
		var self = this;
		var cls = this.constructor.entity;

		var pk = this[cls.primaryKey];
		if( !pk ) throw new Error('illegal state: primary key[' + cls.primaryKey + '] is missing');		
		var condition = {};
		condition[cls.primaryKey] = pk;
		
		return {
			complete: function(fn) {
				cls.remove(condition).complete(function(err, removed) {
					if( err ) return fn.call(self, err);

					try {
						fn.call(self, null, removed);
					} catch(err) {
						fn.call(self, err);
					}
				});
			}
		};
	},
	toObject: function() {
		var entity = this.constructor.entity;
		var dynamic = entity.dynamic;
		var items = entity.schema.getItems();

		var o = {};
		for(var k in this) {
			if( !this.hasOwnProperty(k) ) continue;

			if( dynamic === false ) {
				if( items.hasOwnProperty(k) ) {
					o[k] = this[k];
				}
			} else {
				o[k] = this[k];
			}
		}
		return o;
	},
	stringify: function() {
		return JSON.stringify(this);
	}
};
