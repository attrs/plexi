var crypto = require('crypto');

var User = {
	id: 'users',
	schema: {
		userId: {type: 'uuid', generate: true, primary: true, unique: true},
		loginId: {type: 'string', nullable: false, unique: true, index: {sort:1}},
		email: {type: 'string', nullable: false, unique: true, index: {sort:1}},
		mobile: {type: 'string', index: {sort:1}},
		password: {type: 'string', nullable: false},
		name: {type: 'string', nullable: false, index: {sort:1}},
		enable: {type: 'boolean', value: true, index: {sort:1}},
		data: {type: 'object', value: {}},
		permissions: {type: 'object', value: {}},
		registred: {type: 'date', nullable: false, value: 'now', index: {sort:-1, sparse:true}},
		logined: {type: 'date', index: {sort:-1, sparse:true}},
		has: {
			type: 'pseudo',
			value: function(resourceId, action) {
				var perms = this.permissions;
				if( perms ) {
					var perm = perms['*'] || perms[resourceId];
					if( perm && (perm === '*' || perm === action) ) {
						return true;
					}
				}
				return false;
			}
		}
	},
	initial: [
		{
			userId: '00000000-0000-0000-0000-000000000000',
			loginId: 'system',
			email: 'system@printingengine.com',
			mobile: '000-000-0000',
			password: crypto.createHash('sha256').update('dpswls!@').digest("hex"),
			name: 'System',
			data: {
				address: '',
				mall: {
				}
			},
			permissions: {
				'*': '*'
			}
		}, {
			loginId: 'grifix',
			password: crypto.createHash('sha256').update('1').digest("hex"),
			name: 'SMLee',
			email: 'grifix@printingengine.com',
			mobile: '000-000-0000',
			data: {
				address: '',
				mall: {
					grade: 'G',
					point : 34323,
					cart: 5,
					paymentConfirm: 3,
					draftConfirm: 4,
					production: 3
				}
			},
			permissions: {
				'*': '*'
			}
		}, {
			loginId: 'joje',
			password: crypto.createHash('sha256').update('1').digest("hex"),
			name: 'Joje',
			email: 'warik@hanmail.net',
			mobile: '011-796-0383',
			data: {
				address: '서울시 마포구 동교동 170-16 201호',
				mall: {
					grade: 'G',
					point : 34323,
					cart: 5,
					paymentConfirm: 3,
					draftConfirm: 4,
					production: 3
				}
			}
		}
	]
};

module.exports = User;
