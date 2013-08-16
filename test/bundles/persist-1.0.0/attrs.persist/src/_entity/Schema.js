var Generator = require('./Generator.js');
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

function Schema(o) {
	this.items = {};
	this.indexes = [];
	this.pk = [];
	for(var k in o) {
		if( !o.hasOwnProperty(k) ) continue;
		if( o[k] ) {
			item = new SchemaItem(k, o[k]);
			if( item.isPrimaryKey ) this.pk.push(k);
			this.items[k] = item;
			if( item.indexes ) {
				this.indexes = this.indexes.concat(item.indexes);
			}
		}
	}
}

Schema.prototype.getItems = function getItems() {
	return this.items;
};

Schema.prototype.getItem = function getItem(k) {
	return this.items[k];
};

Schema.prototype.getPrimaryKey = function getPrimaryKey() {
	var pk = this.pk;
	if( pk.length === 1 ) return pk[0];
	else if( pk.length > 1 ) return pk;
	else return null;
};

module.exports = Schema;

// class SchemaItem
function SchemaItem(key, config) {
	this.key = key;
	if( typeof(config) !== 'object' ) {
		this.type(config);
		this.isPrimaryKey = false;
		this.nullable = true;
		this.indexes = [];
	} else {
		this.type(config.type);
		this.isPrimaryKey = (config.primaryKey === true) ? true : false;
		this.unique = (config.unique === true) ? true : false;
		this.nullable = (config.nullable === false) ? false : true;
		if( this.isPrimaryKey ) this.nullable = false;
		this.indexes = [];
		this.defaultValue = config.defaultValue;
		
		if( this.unique || this.primaryKey ) this.indexing = {sort:-1,unique:true};
		else if( config.indexing ) this.indexing = config.indexing;


		if( this.indexing ) {
			if( typeof(this.indexing) === 'number' ) this.indexing = {sort:this.indexing};
			else if( typeof(this.indexing) !== 'object' ) this.indexing = {sort:-1};

			var keys = {};
			keys[key] = this.indexing.sort;

			var options = this.indexing;
			delete options['sort'];

			this.indexes.push({keys:keys, options:options});
		}
	}
}

SchemaItem.prototype = {
	isValidType: function(value) {
		var type = this.type();
		if( typeof(type) === 'function' ) {
			return (value instanceof type);
		} else if( type === 'string' || type === 'text' ) {
			return (typeof(value) === 'string' || value instanceof String);
		} else if( type === 'number' ) {
			return (typeof(value) === 'number' || value instanceof Number);
		} else if( type === 'boolean' ) {
			return (typeof(value) === 'boolean' || value instanceof Boolean);
		} else if( type === 'object' || type === 'mixed' ) {
			return (typeof(value) === 'object');
		} else if( type === 'date' ) {
			return (value instanceof Date);
		}

		return false;
	},
	validateValue: function(value) {
		if( !value ) value = this.getDefaultValue();
		if( !this.isValidType(value) ) {
			//변환 시도
		}

		if( !this.nullable && !value ) throw new Error('[' + this.key + '] cannot be null');

		return value;
	},
	getDefaultValue: function() {
		var type = this.type();
		var d = this.defaultValue;
		if( type === 'generator' || type.startsWith('generator.') ) {
			return new Generator(type.substring(10) || 'uuid').generate();
		} else if( type == 'date' && d && d.toLowerCase() == 'now' ) {
			return new Date();
		}

		return d;
	},
	type: function(type) {
		if( arguments.length <= 0 ) return this._type;

		if( typeof(type) === 'function' ) {
			if( type === String ) {
				type = 'string';
			} else if( type === Number ) {
				type = 'number';
			} else if( type === Boolean ) {
				type = 'boolean';
			} else if( type === ObjectID ) {
				type = 'generator.objectid';
			} else if( type === Object ) {
				type = 'object';
			}
		}

		this._type = type;

		return this;
	}
};