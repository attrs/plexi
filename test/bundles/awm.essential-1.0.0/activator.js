var path = require('path');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;

module.exports = function(ctx) {
	//var events = new ctx.require('attrs.event')();
	var events = new EventEmitter();

	// event provider binding
	this.exports = {
		on: function on(action, fn) {
			events.on(action, fn);
		},
		events: events
	};

	// setup persist
	var db = this.options.database || 'master';
	var Entity = ctx.require('persist').Entity;
	var User = new Entity(require('./entity/User.js')).of(db);
	var ArticleGroup = new Entity(require('./entity/ArticleGroup.js')).of(db);
	var Article = new Entity(require('./entity/Article.js')).of(db);
	
	
	// web
	var api = ctx.require('http').router('/api/essential');
	var client = ctx.require('http').router('/essential');
	
	// setup static resources
	client.static('/', path.join(__dirname, 'client'));


	// setup test api
	api.get('/test', function(req, res, next) {
		var condition = {};
		var query = req.query['q'] || '';
		
		if( query ) {
			condition = {
				'$or': [
					{'name': {'$regex': '.*' + query + '.*'}},
					{'loginId': {'$regex': '.*' + query + '.*'}}
				]
			};
		}

		User.find({
			condition: condition,
			fields: {password:0}
		}).done(function(err, list) {
			if( err ) return next(err);

			res.send(list);
		});
	});


	// setup restful api
	// - login
	//var UserSessions = {};
	//var UserSession = require('./UserSession.js');
	api.get('/auth', function(req, res, next) {
		var loginId = req.query['loginId'];
		var password = req.query['password'];
		
		if( password ) password = crypto.createHash('sha256').update(password).digest("hex");

		// logout first
		if( req.session['user'] ) {
			var user = req.session['user'];
			req.session['user'] = null;
			events.emit('logout', user);
		}
	
		// login
		User.findOne({
			condition: {loginId:loginId},
			fields: {_id:0}
		}).done(function(err, user) {
			if( err ) {
				var message = 'database error(' + loginId + '):' + err.message;

				events.emit('login.error', {
					message: message,
					loginId: loginId,
					error: err
				});
				return next(new Error(message));
			}
			
			if( user ) {
				if( !user.enable ) {
					var message = 'disabled user:' + user.loginId + '(' + user.userId + ')';
					events.emit('login.error', {
						message: message,
						loginId: loginId,
						userId: user.userId
					});
					return next(new Error(message));
				}

				if( user.password === password ) {
					req.session['user'] = user;

					delete user.password;

					events.emit('login', user);

					var now = new Date();

					User.update({
						condition: {userId: user.userId},
						data: {logined: now}
					}).done(function(err, updated) {
						if( err ) return next(err);

						user.logined = now;

						res.send(user);						
					});
				} else {
					var message = 'invalid password:' + user.loginId + '(' + user.userId + ')';
					events.emit('login.error', {
						message: message,
						loginId: loginId,
						userId: user.userId
					});
					return next(new Error(message));
				}
			} else {
				var message = 'cannot found user:' + loginId;
				events.emit('login.error', {
					message: message,
					loginId: loginId,
					userId: user.userId
				});
				return next(message);
			}
		});
	});

	// - logout
	api.del('/auth', function(req, res, next) {
		var flag = false;
		if( req.session['user'] ) {
			var user = req.session['user'];
			req.session['user'] = null;
			events.emit('logout', user);
			flag = true;
		}
		
		res.send(flag);
	});

	// - inquiry session
	api.get('/auth/session', function(req, res, next) {
		var user = req.session['user'];

		events.emit('polling', user);

		res.send(user);
	});



	// - inquiry user list
	api.get('/users', function(req, res, next) {
		// check admin
		var user = req.session['user'];
		if( !user || !user.has('user', '*') ) return next(new Error('no_permission'));

		var condition = req.query['condition'];
		var sort = req.query['sort'];

		if( condition && typeof(condition) === 'string' ) condition = JSON.parse(condition);
		if( sort && typeof(sort) === 'string' ) sort = JSON.parse(sort);
				
		var start = parseInt(req.query['start']);
		var limit = parseInt(req.query['limit']);
		if( isNaN(start) ) start = 0;
		if( isNaN(limit) ) limit = 25;
		
		User.find({
			condition: condition,
			start: start,
			limit: limit,
			sort: sort,
			fields: {password:0, _id:0}
		}).done(function(err, list) {
			if( err ) return next(err);

			if( list.fields ) delete list.fields;
			res.send(list);
		});
	});

	// - inquiry user
	api.get('/users/:userId', function(req, res, next) {
		if( !UserSessions[req.session['user']] ) return next(new Error('no_permission:not_logined'));

		var userId = req.params['userId'];
		if( !userId ) return next(new Error('missing:userId'));
		if( !user.has('user', '*') && user.userId !== userId ) return next(new Error('no_permission:not_your_userid'));
		
		User.findOne({
			condition: {userId: userId},
			fields: {password:0, _id:0}
		}).done(function(err, row) {
			if( err ) return next(err);

			res.send(row);
		});
	});

	// - add user
	api.post('/users', function(req, res, next) {
		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));

		new User(body).save().done(function(err, user) {
			if( err ) return next(err);

			req.send(user);
		});
	});
	
	// - edit user
	api.put('/users/:userId', function(req, res, next) {
		if( !req.session['user'] ) return next(new Error('no_permission:not_logined'));
				
		var userId = req.params['userId'];
		if( !userId ) return next(new Error('missing:userId'));

		var user = req.session['user'];
		if( !user.has('user', '*') && user.userId !== userId ) return next(new Error('no_permission:not_your_userid'));
		
		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));
		
		new User(body).save().done(function(err, user) {
			if( err ) return next(err);

			req.send(user);			
		});
	});

	// - remove user
	api.del('/users/:userId', function(req, res, next) {
		if( !req.session['user'] ) return next(new Error('no_permission:not_logined'));

		var userId = req.params['userId'];
		if( !userId ) return next(new Error('missing:userId'));

		var user = req.session['user'];
		if( !user.has('user', '*') && user.userId !== userId ) return next(new Error('no_permission:not_your_userid'));

		User.update({
			condition: {userId: userId},
			data: {enable: false}
		}).done(function(err, row) {
			if( err ) return next(err);

			res.send(true);
		});
	});



	// - inquiry bbs list
	api.get('/articles', function(req, res, next) {
		// check admin
		var user = req.session['user'];
		if( !user || !user.has('articles', '*') ) return next(new Error('no_permission:articles'));

		var condition = req.query['condition'];
		var sort = req.query['sort'];

		if( condition && typeof(condition) === 'string' ) condition = JSON.parse(condition);
		if( sort && typeof(sort) === 'string' ) sort = JSON.parse(sort);
				
		var start = parseInt(req.query['start']);
		var limit = parseInt(req.query['limit']);
		if( isNaN(start) ) start = 0;
		if( isNaN(limit) ) limit = 25;
		
		ArticleGroup.find({
			condition: condition,
			start: start,
			limit: limit,
			sort: sort,
			fields: {password:0, _id:0}
		}).done(function(err, list) {
			if( err ) return next(err);

			if( list.fields ) delete list.fields;
			res.send(list);
		});
	});

	// - add bbs
	api.post('/articles', function(req, res, next) {
		// check admin
		var user = req.session['user'];
		if( !user || !user.has('articles', '*') ) return next(new Error('no_permission:articles'));

		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));

		new ArticleGroup(body).save().done(function(err, bbs) {
			if( err ) return next(err);

			req.send(bbs);			
		});
	});
	
	// - edit bbs
	api.put('/articles/:groupId', function(req, res, next) {
		// check admin
		var user = req.session['user'];
		if( !user || !user.has('articles', '*') ) return next(new Error('no_permission:articles'));

		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));
		
		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));

		new ArticleGroup(body).save().done(function(err, bbs) {
			if( err ) return next(err);

			req.send(bbs);			
		});
	});

	// - remove bbs
	api.del('/articles/:groupId', function(req, res, next) {
		// check admin
		var user = req.session['user'];
		if( !user || !user.has('articles', '*') ) return next(new Error('no_permission:articles'));

		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));

		ArticleGroup.remove({
			condition: {groupId: groupId}
		}).done(function(err, row) {
			if( err ) return next(err);

			res.send(true);
		});
	});

	// - inquiry bbs article list
	api.get('/articles/:groupId', function(req, res, next) {
		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));

		var condition = req.query['condition'];
		var sort = req.query['sort'];

		if( condition && typeof(condition) === 'string' ) condition = JSON.parse(condition);
		if( sort && typeof(sort) === 'string' ) sort = JSON.parse(sort);
				
		var start = parseInt(req.query['start']);
		var limit = parseInt(req.query['limit']);
		if( isNaN(start) ) start = 0;
		if( isNaN(limit) ) limit = 25;
		
		if( !condition ) condition = {};
		condition.groupId = groupId;

		Article.find({
			condition: condition,
			start: start,
			limit: limit,
			sort: sort,
			fields: {password:0, _id:0}
		}).done(function(err, list) {
			if( err ) return next(err);

			if( list.fields ) delete list.fields;
			res.send(list);
		});
	});
	
	// - get article
	api.get('/articles/:groupId/:articleId', function(req, res, next) {
		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));

		var articleId = req.params['articleId'];
		if( !articleId ) return next(new Error('missing:articleId'));
		
		Article.findOne({
			condition: {groupId: groupId, articleId: articleId},
			fields: {password:0, _id:0}
		}).done(function(err, row) {
			if( err ) return next(err);

			res.send(row);
		});
	});

	// - add article
	api.post('/articles/:groupId', function(req, res, next) {
		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));
		
		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));

		body.groupId = groupId;

		var article = new Article(body);

		article.save().done(function(err, row) {
			if( err ) return next(err);

			req.send(row);			
		});
	});

	// - edit article
	api.put('/articles/:groupId/:articleId', function(req, res, next) {
		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));

		var articleId = req.params['articleId'];
		if( !articleId ) return next(new Error('missing:articleId'));
		
		var body = req.body;
		if( typeof(body) !== 'object' ) return next(new Error('body must be an object'));

		body.groupId = groupId;
		body.articleId = articleId;

		var user = req.session['user'];
		if( !user ) return next(new Error('no_permission:not_logined'));
		
		var condition = {groupId: groupId, articleId: articleId};
		if( !user.has('articles', '*') ) {
			condition.userId = user.userId;
		}

		Article.update({
			condition: condition
		}).done(function(err, result) {
			if( err ) return next(err);

			req.send(result);			
		});
	});
	
	// - remove article
	api.del('/articles/:groupId/:articleId', function(req, res, next) {
		var groupId = req.params['groupId'];
		if( !groupId ) return next(new Error('missing:groupId'));

		var articleId = req.params['articleId'];
		if( !articleId ) return next(new Error('missing:articleId'));

		var user = req.session['user'];
		if( !user ) return next(new Error('no_permission:not_logined'));
		
		var condition = {groupId: groupId, articleId: articleId};
		if( !user.has('articles', '*') ) {
			condition.userId = user.userId;
		}

		Article.remove({
			condition: condition
		}).done(function(err, result) {
			if( err ) return next(err);

			res.send(result);
		});
	});


	//console.log('require.cache', require.cache);
	
	console.log('[' + ctx.bundleId + '] setup successfully!');
};
