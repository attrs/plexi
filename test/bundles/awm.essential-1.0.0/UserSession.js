// UserSession
function UserSession(user) {
	if( typeof(user) !== 'object' ) throw new Error('user data must be an object');

	for(var k in user) {
		if( !user.hasOwnProperty(k) || k === 'password' || k === 'has' ) continue;

		if( typeof(user[k]) === 'function' ) continue;

		this[k] = user[k];
	}

	this.assert();
}

UserSession.prototype = {
	assert: function() {
		if( !this.userId ) throw new Error('missing:userId');
		if( !this.loginId ) throw new Error('missing:loginId');
		if( !this.name ) throw new Error('missing:name');
	},
	isValid: function() {
		try {
			this.assert();
			return true;
		} catch(e) {
			return false;
		}
	},
	has: function(resourceId, action) {
		var perms = this.permissions;
		if( perms ) {
			var perm = perms['*'] || perms[resourceId];
			if( perm && (perm === '*' || perm === action) ) {
				return true;
			}
		}
		return false;
	}
};

module.exports = UserSession;
