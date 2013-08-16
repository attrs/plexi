var Entity = require('../../').Entity;

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

console.log('\n\n- Entity detail');
console.log(Article);
console.log(Test);


console.log('\n\n- Create Object');
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

console.log('\n\n- Check Schema');
console.log('article instanceof Article', (article instanceof Article));
console.log('article instanceof Test', (article instanceof Test));
console.log('article', JSON.stringify(article, null, '\t'));

console.log('article2 instanceof Article', (article2 instanceof Article));
console.log('article2 instanceof Test', (article2 instanceof Test));
console.log('article2', JSON.stringify(article2, null, '\t'));

console.log('test instanceof Article', (test instanceof Article));
console.log('test instanceof Test', (test instanceof Test));
console.log('test', JSON.stringify(test, null, '\t'));

console.log('\n\n- Pseudo Test');
console.log('article.author', article.author);
console.log('article2.author', article2.author);
article.author = '테스트1';
article2.author = '테스트2';


console.log('\n\n- Check Schema');
console.log('article.check', article.check());
console.log('article2.check', article2.check());
console.log('test.check', test.check());


console.log('\n\n- Status');
console.log('article', JSON.stringify(article, null, '\t'));
console.log('article2', JSON.stringify(article2, null, '\t'));
console.log('test', JSON.stringify(test, null, '\t'));


console.log('\n\n- Result');
console.log('article', JSON.stringify(article.toObject(), null, '\t'));
console.log('article2', JSON.stringify(article2.toObject(), null, '\t'));
console.log('test', JSON.stringify(test.toObject(), null, '\t'));


console.log('\n\n- Primary key condition');
console.log('article.condition', article.condition());
console.log('article2.condition', article2.condition());
console.log('test.condition', test.condition());