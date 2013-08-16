var Types = require('./Types.js');
var ObjectID = require('mongodb').ObjectID;

if( !String.prototype.startsWith ) {
	String.prototype.startsWith = function(s) {
		if( !s ) return false;
		return (this.indexOf(s)==0);
	};
}

if( !String.prototype.endsWith ) {
	String.prototype.endsWith = function(s) {
		if( !s ) return false;

		return this.indexOf(s, this.length - s.length) !== -1;
	};
}

if( !String.prototype.trim ) {
	String.prototype.trim = function() {
		return this.replace(/(^ *)|( *$)/g, "");
	};
}

var Schema = function Schema(attributes, options) {
	if( typeof(attributes) !== 'object' ) throw new Error('attributes must be an object');

	options = options || {};

	if( options.indexes && !Array.isArray(options.indexes) ) throw new Error('options.indexes must be an array');

	this.attributes = {};
	this.dynamic = (options.dynamic === false) ? false : true;
	this.indexes = options.indexes || [];
	this.primaryKeys = [];
	for(var k in attributes) {
		if( !attributes.hasOwnProperty(k) ) continue;
		if( attributes[k] ) {
			var attribute = new Attribute(k, attributes[k]);

			if( attribute.primary ) this.primaryKeys.push(k);
			this.attributes[k] = attribute;
			if( attribute.index ) {
				this.indexes.push(attribute.index);
				//this.indexes = this.indexes.concat(attribute.index);
			}
		}
	}

	if( !this.primaryKeys || this.primaryKeys.length <= 0 ) throw new Error('missing primary key');

	// create primary key unique index
	var index = {keys:{}, options:{unique:true}};
	for(var i=0; i < this.primaryKeys.length; i++) {
		index.keys[this.primaryKeys[i]] = 1;
	}

	this.indexes.push(index);
}

Schema.prototype.validate = function(o) {
	//console.log('validate', o);
	if( typeof(o) !== 'object' ) return false;

	for(var key in this.attributes) {
		if( !this.attributes.hasOwnProperty(key) ) continue;
		var attribute = this.attributes[key];
		
		var validvalue = attribute.validate(o[key]);

		if( validvalue !== undefined && validvalue !== null ) o[key] = validvalue;
		
		if( attribute.type === 'pseudo' ) {
			if( typeof(attribute.value) === 'object' ) {
				if( attribute.value.getter ) o.__defineGetter__(attribute.name, attribute.value.getter);
				if( attribute.value.setter ) o.__defineSetter__(attribute.name, attribute.value.setter);
			} else {
				o[key] = attribute.value;
			}
		}
	}

	for(var key in o) {
		if( !o.hasOwnProperty(key) ) continue;
		var value = o[key];

		var attribute = this.attributes[key];
		if( attribute && attribute.type !== 'pseudo' ) o[key] = attribute.validate(value);
	}

	return true;
};

Schema.prototype.check = function(o) {
	if( typeof(o) !== 'object' ) throw new TypeError('invalid values:' + o);

	this.validate(o);

	for(var key in this.attributes) {
		var attribute = this.attributes[key];
		try {
			if( attribute.type !== 'pseudo' ) attribute.check(o[key]);
		} catch(e) {
			throw new TypeError('attribute [' + key + '] has invalid value(' + o[key] + '):' + e.message);
		}
	}

	return true;
};

Schema.prototype.extract = function(o) {
	//console.log('before', o);

	var result = {};
	for(var key in o) {
		if( !o.hasOwnProperty(key) ) continue;		
		var attribute = this.attributes[key];
		if( attribute ) {
			var value = o[key];
			var type = attribute.type;
			if( type !== 'pseudo' ) {
				result[key] = attribute.extract(value);
			}
		} else if( this.dynamic ) {
			result[key] = o[key];
		}
	}
	//console.log('after', result);

	return result;
};

module.exports = Schema;



// class SchemaItem
function Attribute(name, config) {
	if( typeof(name) !== 'string' ) throw new Error('invalid attribute name:' + name);
	if( typeof(config) === 'string' ) config = {type: config};
	if( typeof(config) !== 'object' ) throw new Error('invalid attribute config:' + config);

	this.name = name;
	this.handler = Types.get(config.type);
	if( !this.handler ) throw new Error('invalid type:' + config.type);

	this.type = this.handler.id;
	this.primary = config.primary ? true : false;
	this.nullable = (( this.primary ) ? false : ((config.nullable === false) ? false : true));
	this.unique = config.unique ? true : false;
	this.value = config.value;
	this.generate = config.generate ? true : false;
	
	if( this.generate && typeof(this.handler.generate) !== 'function' ) throw new Error('type[' + this.type + '] cannot generate value');
	
	if( config.index ) {
		if( typeof(config.index) === 'number' ) config.index = {sort:config.index};
		else if( typeof(config.index) !== 'object' ) throw new Error('invalid index options:' + config.index);

		var index = {keys:{}, options:config.index};
		index.keys[this.name] = index.options.sort || 1;
		delete index.options['sort'];

		if( this.unique ) index.options.unique = true;
		
		this.index = index;
	}
}

Attribute.prototype = {
	validate: function(value) {
		if( this.type === 'pseudo' ) return value;

		try {
			var v = this.handler.validate(value || this.value);
			//console.log('validated', this.name, v, this.value);
			if( this.generate && (v === null || v === undefined) ) v = this.handler.generate();

			return v;
		} catch(e) {
			console.warn('validate warn:' + this.name + ':' + this.type + ':' + (value || this.value) + ':' + e.message);
		}

		return value;
	},
	extract: function(value) {
		if( this.type === 'pseudo' ) return null;

		this.check(value);
		
		if( !this.handler.extract ) return value;
		else return this.handler.extract(value);
	},
	check: function(value) {
		if( this.type === 'pseudo' ) return true;

		var type = Types.get(this.type);
		var value = type.validate(value || this.value);
		if( value === null && this.generate ) value = type.generate();
		if( !this.nullable && !value ) throw new Error('attribute [' + this.name + '] cannot be null(nullable is false)');
		return true;
	},
	getType: function() {
		return Types.get(this.type);
	}
};