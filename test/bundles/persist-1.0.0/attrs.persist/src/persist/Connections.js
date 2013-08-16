var databases = {};
var types = {};

// class Connections
function Connections(options) {
	if( typeof(options) !== 'object' ) throw new Error('options must be a object');		
	if( typeof(options.config) !== 'object' ) throw new Error('options.config must be a object or array');
	if( typeof(options.name) !== 'string' ) throw new Error('options.name must be a string');
	if( Connections.get(options.name) ) throw new Error('conflict connection name [' + options.name + '], already defined name.');
	if( !Array.isArray(options.config) ) options.config = [options.config];	// temporary

	var o = this.options = options;
	this.name = o.name;

	this.connections = [];
	for(var i=0; i < o.config.length; i++) {
		this.addConnection(o.config[i]);
	}
}

// static methods
Connections.registType = function registType(typeId, cls) {
	if( !typeId || typeof(typeId) !== 'string' ) throw new Error('type id must be a string');
	if( typeof(cls) !== 'function' ) throw new Error('type class must be a function');

	types[typeId] = cls;
};
Connections.getType = function getType(typeId) {
	return types[typeId];
};
Connections.define = function define(options) {
	if( typeof(options) !== 'object' ) throw new Error('options must be a object');		
	if( typeof(options.config) !== 'object' ) throw new Error('options.config must be a object or array');
	if( typeof(options.name) !== 'string' ) throw new Error('options.name must be a string');

	if( databases[options.name] ) {
		throw new Error('already exists connection name:' + options.name);
	}

	var connections = new Connections(options);
	databases[connections.name] = connections;
	return connections;
};
Connections.get = function get(name) {
	return databases[name];
};
Connections.remove = function remove(name) {
	var db = databases[name];
	if( db ) db.close();

	delete databases[name];
};

// regist bundle db type
Connections.registType('mongo', require('./MongoDataAccess.js'));


// instance methods
Connections.prototype = {
	addConnection: function(config) {
		if( typeof(config) !== 'object' ) throw new TypeError('invalid connection config');

		var cls = types[config.type];	
		if( !cls ) throw new Error('invalid options.type: not exist type[' + config.type + ']');
		this.connections.push(new cls(config));
	},
	close: function() {
		this.connections[0].close();
	},
	collection: function(collectionId) {
		return this.connections[0].collection(collectionId);
	}
};

// class Collections
function Collections(collections) {
	this.collections = collections;
}

// interface
Collections.prototype = {
	index: function(keys, options) {
	},
	primaryKey: function(pk) {
	},
	find: function(condition, start, limit, sort) {
	},
	findOne: function(condition) {
	},
	insert: function(data, options) {
	},
	save: function(data, options) {
	},
	upsert: function(condition, data, options) {
	},
	update: function(condition, data, options) {
	},
	remove: function(condition, options) {
	}
};

module.exports = Connections;
