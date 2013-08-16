var persist = require('./attrs.persist');

module.exports = {
	start: function(ctx) {
		var databases = this.options.databases;
		if( databases ) {
			for(var i=0; i < databases.length; i++) {
				persist.Connections.define(databases[i]);
			}
		}

		this.exports = {
			Connections: persist.Connections,
			Entity: persist.Entity,
			Types: persist.Types
		};

		console.log('Persist service started with ' + JSON.stringify(this.options, null, '\t'));
	}
};
