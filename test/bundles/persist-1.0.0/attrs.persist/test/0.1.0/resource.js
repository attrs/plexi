var restful = require('../');

var Article = new restful.Entity('Article', {
	idx: {type: 'generator.number', primaryKey: true, unique: true},
	classify: {type: 'string', defaultValue: 'common'},
	disabled: {type: 'string', defaultValue: false},
	title: {type: 'string', nullable: false},
	posted: {type: 'date', nullable: false, defaultValue: 'now', indexing: {sort:1, sparse:false}},
	hit: {type: 'number'},
	userId: {type: 'string'},
	userName: {type: 'string'},
	contents: {type: 'text'},
	a: {type: 'string', nullable: false},
	b: {type: 'string', nullable: false},
	c: {type: 'string', nullable: false},
	author: {
		type: 'pseudo',
		get: function() {
			return this.userName + '(' + this.userId + ')';
		}
	}
}, {
	db: {
		name: 'db1',
		config: [
			{
				master: true,
				type: 'mongo',
				host: '127.0.0.1',
				port: 27017,
				db: 'test',
				userId: 'admin',
				password: '1'
			}, {
				safe: false,
				type: 'oracle',
				host: '127.0.0.1',
				port: 1521,
				db: 'test',
				userId: 'admin',
				password: '1'
			}
		]
	},
	indexes: [
		{
			keys: {a:1,b:1,c:1},
			options: {unique:true}
		}
	],
	validators: {
		create: function(data) {
			console.log('validator create:', data);
		},
		pullin: function(data) {
			console.log('validator pullin:', data);
		},
		outgoing: function(data) {
			console.log('validator outgoing:', data);
		}
	},
	initial: [
		{
			title: '제목1',
			contents: '내용',
			a:'1',b:'2',c:'3'
		}, {
			title: '제목22',
			contents: '내용',
			a:'1',b:'2',c:'4'
		}, {
			title: '제목33',
			contents: '내용',
			a:'1',b:'2',c:'6'
		}
	]
});

restful.Resource.define('/articles', {
	debug: true,
	allows: ['list', 'get', 'post', 'put', 'delete'],
	entity: Article
});
