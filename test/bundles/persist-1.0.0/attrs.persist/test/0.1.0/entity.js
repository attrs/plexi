var Connections = require('../').Connections;
var Entity = require('../').Entity;

Connections.define({
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

var Article = new Entity('Article', {
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
Article.db = 'db1';
Article.collection = 'article2';

console.log('function', typeof(Article));
console.log('entity', (Article instanceof Entity));
console.log('collection', Article.collection);


if( false ) {
	console.log('indexes', Article.indexes);
	Article.ensure().complete(function(err, data) {
		if( err ) console.error('entity check error', err);
		else console.log('entity check done.');

		Article.db.close();
	});
}


if( true ) {
	var article = Article.create({
		idx: 1,
		title: '제목2',
		contents: '내용2',
		a:'1',b:'2',c:'5'
	});
	console.log('article', article);

	if( true ) {
		article.save().complete(function(err, article) {
			if( err ) return console.log('article.save().error', err);

			console.log('article.save()', article);

			article = Article.create({
				idx: 1,
				classify: 'test-' + new Date().getTime()
			});

			article.save(true).complete(function(err, article) {
				if( err ) return console.log('article.save()(edit).error', err);

				console.log('article.save()(edit)', article.toObject());

				article.reload().complete(function(err, article) {
					if( err ) return console.log('article.reload().error', err);

					console.log('article.reload()', article.stringify());

					Article.find({}).complete(function(err, articles) {
						if( err ) return console.log('error', err);
						
						console.log('Article.find({},0,100)', articles);
						for(var i=0; i < articles.length;i++) {
							console.log('article(' + i + ')', articles[i].stringify());
						}
						
						Article.findOne(article.idx).complete(function(err, articles) {
							if( err ) return console.log('Article.find().error', err);

							console.log('Article.find()', articles);
							
							console.log('article', article);
							Article.findById(article.idx).complete(function(err, article) {
								if( err ) return console.log('Article.findById(article.idx).error', err);

								console.log('Article.findById(article.idx)', article);

								article.remove().complete(function(err, removed) {
									if( err ) return console.log('article.remove().error', err);

									console.log('article.remove()', removed);
								
									Article.db.close();
								});
								//Article.db.close();
							});
						});
					});
				});
			});
		});
	}
}

/*
Article.find({}, 0, 100).complete(function(err, articles) {
});
Article.findById(1).complete(function(err, articles) {
});
Article.update(1, {disabled:false}).complete(function(err, articles) {
});
Article.remove([1,2]).complete(function(err, articles) {
});

var article = new Article({
	title: '제목',
	contents: '내용'
});
console.log('is managed', article.isManaged());
console.log('article', article);
article.save().complete(function(err, article) {
	console.log('saved', article);
});
console.log('is managed', article.isManaged());
article.reload().complete(function(err, article) {
	console.log('reload', article);
});
console.log('article', article.stringify());
*/
