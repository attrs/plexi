var Map = function() {
	this.k = [];
	this.v = [];
};

Map.prototype = {
	get: function(k) {
		return this.v[this.k.indexOf(k)];
	},
	set: function(k, v) {
		var i = this.k.indexOf(k);
		if( i >= 0 ) {
			this.k[i] = v;
		} else {
			this.k.push(k);
			this.v.push(v);
		}
	},
	size: function() {
		return this.k.length;
	},
	delete: function(k) {
		var i = this.k.indexOf(k);
		if( i >= 0 ) {
			this.k.remove(i);
			this.v.remove(i);
			this.size = this.k.length;
			return true;
		}
		return false;
	},
	has: function(k) {
		return (this.k.indexOf(k) >= 0);
	},
	indexOf: function(k) {
		return this.k.indexOf(k);
	},
	keys: function() {
		return this.k;
	},
	values: function() {
		return this.v;
	},
	items: function() {
		return null;
	},
	clear: function() {
		this.k = [];
		this.v = [];
		this.size = 0;
	}
};

// custom method
Map.prototype.getKeyByValue = function(v) {	
	var argk = this.keys();
	var argv = this.values();
	return argk[argv.indexOf(v)];
};

module.exports = Map;