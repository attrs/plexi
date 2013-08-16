var uuid = require('node-uuid');
var ObjectID = require('mongodb').ObjectID;

var seq = 0;

function Generator(type) {
	return new Gen(type);
}

module.exports = Generator;

function Gen(type) {
	this.type(type);
}

module.exports.Gen = Gen;

Gen.prototype.generate = function() {
	var type = this.type;
	if( type === 'time' ) {
		var time = new Date().getTime();
		if( time <= seq ) seq++;
		else seq = time;
		return seq;
	} else if( type === 'uuid.v1' ) {
		return uuid.v1();
	} else if( type === 'uuid.v4' ) {
		return uuid.v4();
	} else if( type === 'string' || type === 'objectid' ) {
		var objectId = new ObjectID();
		return (( type === 'string' ) ? objectId.toHexString() : objectId);
	} else {
		throw new Error('unsupported type:' + type);
	}
};

Gen.prototype.type = function(type) {
	if( arguments.length <= 0 ) return this.type;

	if( typeof(type) === 'function' ) {
		if( type === String ) {
			type = 'string';
		} else if( type === Number ) {
			type = 'time';
		} else if( type === ObjectID ) {
			type = 'objectid';
		} else {
			throw new Error('unsupported type:' + type);
		}
	}

	this.type = type.toLowerCase();
	
	if( this.type === 'uuid' ) this.type = 'uuid.v4';
	if( this.type === 'number' ) this.type = 'time';

	if( ['time', 'string', 'objectid', 'uuid.v1', 'uuid.v4'].indexOf(this.type) < 0 ) throw new Error('unsupported type:' + type);

	return this;
};

/*
console.log('time', Generator('time').generate());
console.log('number', Generator('number').generate());
console.log('string', Generator('string').generate());
console.log('uuid.v1', Generator('uuid.v1').generate());
console.log('uuid.v4', Generator('uuid.v4').generate());
console.log('uuid', Generator('uuid').generate());
console.log('objectid', Generator('objectid').generate());
console.log('String', Generator(String).generate());
console.log('Number', Generator(Number).generate());
console.log('ObjectID', Generator(ObjectID).generate());
*/
