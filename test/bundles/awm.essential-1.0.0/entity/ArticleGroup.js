var ArticleGroup = {
	id: 'article_group',
	schema: {
		groupId: {type: 'string', primary: true},
		name: {type: 'string', nullable: false},
		description: {type: 'text'},
		categories: {type: 'array'},
		creator: {type: 'uuid'},

		enable: {type: 'boolean', value: true, index: {sort:1}},
		created: {type: 'date', nullable: false, value: 'now', index: {sort:-1}}
	},
	initial: [
		{
			groupId: 'default',
			name: '기본게시판',
			description: '기본게시판',
			categories: ['common'],
			creator: '00000000-0000-0000-0000-000000000000'
		}, {
			groupId: 'faq',
			name: 'FAQ',
			description: 'FAQ',
			categories: ['common'],
			creator: '00000000-0000-0000-0000-000000000000'
		}, {
			groupId: 'qna',
			name: 'Q&A',
			description: 'Q&A 게시판',
			categories: ['common'],
			creator: '00000000-0000-0000-0000-000000000000'
		}
	]
};

module.exports = ArticleGroup;
