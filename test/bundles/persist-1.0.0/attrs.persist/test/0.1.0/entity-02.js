var Entity = require('../').Entity;
var Generator = require('../').Generator;

var Article = new Entity('Article', {
	idx: Generator('uuid.v4'),
	classify: String,
	disabled: Boolean,
	title: String,
	posted: Date,
	hit: Number,
	userId: String,
	userName: String,
	contents: String,
	author: {
		type: 'pseudo',
		get: function() {
			return this.userName + '(' + this.userId + ')';
		}
	}
}, {
	dynamic: true,
	db: {
		type: 'mongo',
		config: {
			host: '127.0.0.1',
			port: 27017,
			userId: 'admin',
			password: '1',
			db: 'test'
		}
	},
	collection: 'articles',
	primaryKey: 'idx',
	indexes: [
		{
			key: {posted: }
		}
	],
	validators: {
		create: function(data) {
			console.log('validator create:', data);
		},
		pullin: function(data) {
			console.log('validator pullin:', data);
		},
		getout: function(data) {
			console.log('validator getout:', data);
		}
	},
	initial: [
		{
			title: '제목1',
			contents: '내용'
		}, {
			title: '제목2',
			contents: '내용'
		}, {
			title: '제목3',
			contents: '내용'
		}
	]
});

var article = new Article({
	title: '제목',
	contents: '내용'
});
article.save().complete(function(err, article) {
	if( err ) {
		console.log('article.save().error', err);
		return;
	}

	console.log('article.save()', article);

	article.category = 'test';

	article.save().complete(function(err, article) {
		if( err ) {
			console.log('article.save().error', err);
			return;
		}

		console.log('article.save()(edit)', article.toObject());

		article.reload().complete(function(err, article) {
			if( err ) {
				console.log('article.reload().error', err);
				return;
			}

			console.log('article.reload()', article.stringify());

			Article.find({}, 0, 100).complete(function(err, articles) {
				if( err ) console.log('error', err);
				else console.log('Article.find({},0,100)', articles);
				
				Article.find().complete(function(err, articles) {
					if( err ) {
						console.log('Article.find().error', err);
						return;
					}
					console.log('Article.find()', articles);

					article.remove().complete(function(err, removed) {
						if( err ) {
							console.log('article.remove().error', err);
							return;
						}
						console.log('article.remove()', removed);
					
						Article.db.close();
					});
				});
			});
		});
	});
});

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