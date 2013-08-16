var Article = {
	id: 'article',
	schema: {
		uuid: {type: 'uuid', generate: true, primary: true},
		groupId: {type: 'string', nullable: false},
		categories: {type: 'array'},
		flags: {type: 'array'},
		title: {type: 'string', nullable: false, index: {sort:1}},
		contents: {type: 'text'},
		userId: {type: 'uuid', nullable: false, index: {sort:1}},
		name: {type: 'string', nullable: false, index: {sort:1}},

		enable: {type: 'boolean', value: true, index: {sort:1}},
		posted: {type: 'date', nullable: false, value: 'now', index: {sort:-1}},
		hit: {type: 'number', value: 0}
	},
	initial: [
		{
			groupId: 'default',
			flags: ['notice'],
			title: '환영합니다',
			contents: '환영합니다.',
			userId: '00000000-0000-0000-0000-000000000000',
			name: 'System'
		}
	]
};

module.exports = Article;
