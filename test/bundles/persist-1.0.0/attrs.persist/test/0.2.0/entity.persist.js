var Entity = require('../../').Entity;

var start = new Date().getTime();

console.log('- Create Entity');
var Article = new Entity({
	id: 'article',
	schema: {
		idx: {type: 'uuid', generate: true, primary: true},
		classify: {type: 'string', value: 'common'},
		disabled: {type: 'string', value: false},
		title: {type: 'string', nullable: false},
		posted: {type: 'date', nullable: false, value: 'now', index: {sort:1, sparse:false}},
		hit: {type: 'number'},
		userId: {type: 'string'},
		userName: {type: 'string'},
		contents: {type: 'text'},
		a: {type: 'string', nullable: false},
		b: {type: 'number', nullable: false, generate:true},
		c: {type: 'string', nullable: false},
		author: {
			type: 'pseudo',
			value: {
				getter: function() {
					return this.userName + '(' + this.userId + ')';
				},
				setter: function(value) {
					this.pseudotest = value;
				}
			}
		}
	},
	options: {		
		dynamic: true,
		indexes: [
			{
				keys: {a:1,b:1,c:1},
				options: {unique:true}
			}
		]
	},
	preprocessor: function(data) {
		data.test = '테스트';
		return data;
	}
});

var Test = new Entity({
	id: 'test',
	schema: {
		firstId: {type: 'number', primary: true},
		secondId: {type: 'number', primary: true},
		title: {type: 'string', nullable: false},
		posted: {type: 'date', nullable: false, value: 'now', index: {sort:1, sparse:false}},
		name: {type: 'string', value:'기본값'},
	}
});

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');

console.log('- Entity detail');
console.log(Article);
console.log(Test);

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


console.log('- Create Object');
var article = new Article({
	idx: 'bf29b53c-0e77-4916-876e-19ed288e79ec',
	title: '제목',
	userId: 'test',
	userName: '테스터',
	a:'1',b:'2',c:'5'
});

var article2 = new Article();
console.log('article2.initial', JSON.stringify(article2, null, '\t'));
//article2.idx = 'bf29b53c-0e77-4916-876e-19ed288e79ed';
article2.title = '제목2';
article2.userId = 'user';
article2.userName = '사용자';
article2.posted = 1066316420202,
article2.a = 'a'
article2.b = '10'
article2.c = 'c'
article2.validate();
console.log('article2.validate', JSON.stringify(article2, null, '\t'));

var test = new Test({
	firstId: '1',
	secondId: 2,
	title: '제목2'
});

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');

console.log('- Check Schema');
console.log('article instanceof Article', (article instanceof Article));
console.log('article instanceof Test', (article instanceof Test));
console.log('article', JSON.stringify(article, null, '\t'));

console.log('article2 instanceof Article', (article2 instanceof Article));
console.log('article2 instanceof Test', (article2 instanceof Test));
console.log('article2', JSON.stringify(article2, null, '\t'));

console.log('test instanceof Article', (test instanceof Article));
console.log('test instanceof Test', (test instanceof Test));
console.log('test', JSON.stringify(test, null, '\t'));

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');

console.log('- Pseudo Test');
console.log('article.author', article.author);
console.log('article2.author', article2.author);
article.author = '테스트1';
article2.author = '테스트2';

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


console.log('- Check Schema');
console.log('article.check', article.check());
console.log('article2.check', article2.check());
console.log('test.check', test.check());

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


console.log('- Result');
console.log('article', JSON.stringify(article, null, '\t'));
console.log('article2', JSON.stringify(article2, null, '\t'));
console.log('test', JSON.stringify(test, null, '\t'));

console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


console.log('- Primary key condition');
console.log('article.condition', article.condition());
console.log('article2.condition', article2.condition());
console.log('test.condition', test.condition());
console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


console.log('- Data Access');
var Connections = require('../../').Connections;
var conn = Connections.define({
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
});

Article = Article.of('db1');
article = new Article({
	idx: 'bf29b53c-0e77-4916-876e-19ed288e79ec',
	title: '제목',
	userId: 'test',
	userName: '테스터',
	a:'1',b:'2',c:'5'
});

console.log('prepare', -(start - (start = new Date().getTime())) + 'ms');
article.save().done(function(err, article) {
	if( err ) return console.log('article.save().error:' + err.message, err.stack);

	console.log('article.save()', article);

	article.reload().done(function(err, article) {
		if( err ) return console.log('article.reload().error', err);

		console.log('article.reload()', JSON.stringify(article, null, '\t'), (typeof(article.posted)));

		article.additional = '수정';

		article.save().done(function(err, article) {
			if( err ) return console.log('article.save().error:' + err.message, err.stack);

			console.log('article.save()', article);

			Article.find().done(function(err, articles) {
				if( err ) return console.log('error', err);
				
				console.log('Article.find({},0,100)', articles);
				for(var i=0; i < articles.length;i++) {
					console.log('article(' + i + ')', JSON.stringify(article[i], null, '\t'));
				}
				
				Article.findOne(article.condition()).done(function(err, articles) {
					if( err ) return console.log('Article.findOne().error', err);

					console.log('Article.findOne()', article, article.condition());
					console.log('finish', -(start - (start = new Date().getTime())) + 'ms');


					article.remove().done(function(err, removed) {
						if( err ) return console.log('article.remove().error', err);

						console.log('article.remove()', removed);

						console.log('finish', -(start - (start = new Date().getTime())) + 'ms');
					});
				});
			});
		});		
	});
});
