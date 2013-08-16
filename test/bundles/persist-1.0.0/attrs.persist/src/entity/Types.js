var ObjectID = require('mongodb').ObjectID;
var uuid = require('node-uuid');
var Entity = require('./Entity.js');
var Schema = require('./Schema.js');

var Types = {
	types: {},
	get: function(id) {
		if( typeof(id) === 'string' ) return Types.types[id];

		if( id instanceof Entity ) {
			return new EntityType(id);
		} 

		if( id === String ) return Types.types['string'];
		if( id === Number ) return Types.types['number'];
		if( id === Date ) return Types.types['date'];
		if( id === Boolean ) return Types.types['boolean'];
		if( id === ObjectID ) return Types.types['objectid'];
		if( id === uuid.v1 ) return Types.types['uuid.v1'];
		if( id === uuid.v4 ) return Types.types['uuid.v4'];
		if( id === Function ) return Types.types['function'];
		if( id === Object ) return Types.types['object'];

		return null;
	},
	add: function(type) {
		if( !type ) throw new Error('null type');
		if( typeof(type.id) !== 'string' ) throw new Error('missing type.id');
		if( typeof(type.validate) !== 'function' ) throw new Error('missing type.validate');

		Types.types[type.id] = type;
	}
};

var EntityType = function(cls) {
	this.id = 'entity.' + cls.id;
	this.cls = cls;	
};

EntityType.prototype = {
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( value instanceof Entity ) return value;

		if( typeof(value) !== 'object' ) throw new Error('incompatible entity value:' + value);
		
		var cls = this.cls;
		value = new cls(value);
		value.check();

		return value;
	}
};

Types.add({
	id: 'string',
	generate: function() {
		return uuid.v4();
	},
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( typeof(value) === 'number' || typeof(value) === 'boolean' ) value = value + '';
		else if( typeof(value) === 'object' ) value = JSON.stringify(value);
		else if( typeof(value) === 'function' ) value = value.toString();
		else if( typeof(value) === 'string' ) value = value;
		else throw new Error('incompatible string value:' + value);

		return value;
	}
});

Types.add({
	id: 'pseudo',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		var origin = value;

		if( typeof(value) === 'string' ) {
			try {
				value = eval(value);
			} catch(e) {
				throw new TypeError('invalid pseudo function:' + origin);
			}
		}
		
		var o = {};
		if( typeof(value) === 'function' ) {
			o.getter = value;
		}
		
		if( typeof(value.getter) === 'function' ) {
			o.getter = value.getter;
		}

		if( typeof(value.setter) === 'function' ) {
			o.setter = value.setter;
		}

		if( typeof(o.getter) !== 'function' ) throw new Error('pseudo getter must be defined:' + origin);

		return o;
	}
});

Types.add({
	id: 'text',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( typeof(value) === 'number' || typeof(value) === 'boolean' ) value = value + '';
		else if( typeof(value) === 'object' ) value = JSON.stringify(value);
		else if( typeof(value) === 'function' ) value = value.toString();
		else if( typeof(value) === 'string' ) value = value;
		else value = null;

		return value;
	}
});

var last = 0;
Types.add({
	id: 'number',
	generate: function() {
		var timestamp = new Date().getTime();
		if( timestamp <= last ) timestamp = last++;

		last = timestamp;

		return last;
	},
	validate: function(value) {		
		if( value == null || value == undefined ) return value;

		var original = value;

		if( typeof(value) === 'number' ) value = value;
		else if( typeof(value) === 'boolean' ) value = (value ? 1 : 0);
		else if( typeof(value) === 'function' || typeof(value) === 'object' ) throw new Error('incompatible number value:' + value);
		else if( typeof(value) === 'string' ) value = (~value.indexOf('.')) ? parseFloat(value) : parseInt(value);		
		
		if( typeof(value) !== 'number' || isNaN(value) ) throw new Error('incompatible number value:' + original);

		return value;
	}
});

Types.add({
	id: 'int',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		var original = value;

		if( typeof(value) === 'number' ) value = value;
		else if( typeof(value) === 'boolean' ) value = (value ? 1 : 0);
		else if( typeof(value) === 'function' || typeof(value) === 'object' ) throw new Error('incompatible int value:' + value);
		else if( typeof(value) === 'string' ) value = parseInt(value);		
		
		if( typeof(value) !== 'number' || isNaN(value) ) throw new Error('incompatible int value:' + original);

		return value;
	}
});

Types.add({
	id: 'float',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		var original = value;

		if( typeof(value) === 'number' && n % 1 == 0 ) value = value.toFixed(2);
		else if( typeof(value) === 'number' ) value = value;
		else if( typeof(value) === 'boolean' ) value = (value ? 1.00 : 0.00);
		else if( typeof(value) === 'function' || typeof(value) === 'object' ) throw new Error('incompatible float value:' + value);
		else if( typeof(value) === 'string' ) value = parseFloat(value);		
		
		if( typeof(value) !== 'number' || isNaN(value) ) throw new Error('incompatible float value:' + original);

		return value;
	}
});

Types.add({
	id: 'boolean',
	validate: function(value) {
		if( value == null || value == undefined ) return value;
		
		if( typeof(value) === 'string' ) value = value.toLowerCase();

		if( value === true || parseInt(value) === 1 || value === 'true' || value === 'yes' ) value = true;
		else if( value === false || parseInt(value) === 0 || value === 'false' || value === 'no' ) value = false;
		else throw new Error('incompatible boolean value:' + value);

		return value;
	}
});

Types.add({
	id: 'date',
	generate: function() {
		return new Date();
	},
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( value instanceof Date ) return value;

		if( value === 'now' ) value = new Date();
		if( typeof(value) === 'string' ) value = Date.parse(value);
		if( typeof(value) === 'number' ) value = new Date(value);

		if( !(value instanceof Date) ) throw new Error('incompatible date value:' + value);

		return value;
	}
});

Types.add({
	id: 'object',
	validate: function(value) {
		if( value == null || value == undefined ) return value;
		
		var origin = value;
		if( typeof(value) === 'string' ) {
			try {
				value = eval(value);
			} catch(e) {
				throw new TypeError('invalid object value:parse error:' + origin + ':' + e.message);
			}
		}
		
		if( typeof(value) !== 'object' ) throw new Error('incompatible object value:' + origin);

		return value;
	}
});

Types.add({
	id: 'array',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		var origin = value;
		if( typeof(value) === 'string' ) {
			try {
				value = eval(value);
			} catch(e) {
				throw new TypeError('invalid array value:parse error:' + origin + ':' + e.message);
			}
		}
		
		if( !Array.isArray(value) ) throw new Error('incompatible array value:' + origin);

		return value;
	}
});

Types.add({
	id: 'function',
	id: 'function',
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( typeof(value) === 'string' ) {
			value = eval(value);
		}
		
		if( typeof(value) !== 'function' ) throw new Error('incompatible function value:' + value);

		return value;
	},
	extract: function(value) {
		if( typeof(value) === 'function' ) return value.toString();
		else return value;
	}
});

Types.add({
	id: 'uuid.v1',
	generate: function() {
		return uuid.v1();
	},
	validate: function(value) {		
		if( value == null || value == undefined ) return value;

		if( typeof(value) !== 'string' ) throw new Error('incompatible uuid value:' + value);

		var result = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
		if( !result ) throw new Error('invalid uuid format:' + value);

		return value;
	}
});

Types.add({
	id: 'uuid',
	generate: function() {
		return uuid.v4();
	},
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( typeof(value) !== 'string' ) throw new Error('incompatible uuid value:' + value);

		var result = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
		if( !result ) throw new Error('invalid uuid format:' + value);

		return value;
	}
});

Types.add({
	id: 'objectid',
	generate: function() {
		return new ObjectID();
	},
	validate: function(value) {
		if( value == null || value == undefined ) return value;

		if( value instanceof ObjectID ) return value;

		try {
			return new ObjectID(value);
		} catch(e) {
			throw new Error('incompatible objectid value:' + value);
		}

		return objectId;
	},
	extract: function(value) {
		if( value instanceof ObjectID ) return value.toString();
		else return value;
	}
});


module.exports = Types;

