var util = require('attrs.util');
var Commands = require('./Commands.js');

var commands = new Commands();


commands.define('profile', function(options, callback) {
	
}, {
	commands: ['p'],
	comment: 'profile system or plugin'
});

commands.define('list', list, {
	commands: ['ss'],
	comment: 'show plugin list'
});

commands.define('init', init, {
	commands: ['help', 'h', '?'],
	comment: 'init project'
});

commands.define('start', start, {
	comment: 'start plugin'
});

commands.define('stop', start, {
	comment: 'stop plugin'
});

commands.define('install', install, {
	comment: 'install plugin'
});

commands.define('uninstall', uninstall, {
	comment: 'uninstall plugin'
});

commands.define('link', link, {
	comment: 'link plugin from filesystem'
});

commands.define('unlink', unlink, {
	comment: 'unlink the linked plugin'
});

commands.define('update', update, {
	comment: 'update installed plugins'
});

commands.define('lint', lint, {
	comment: 'checks and drop unnecessary plugins'
});

commands.define('find', find, {
	commands: ['f'],
	comment: 'find for a matching plugin'
});

commands.define('finds', finds, {
	commands: ['ff'],
	comment: 'find for all matching plugins'
});

commands.define('registry', registry, {
	commands: ['r'],
	comment: 'unlink the linked plugin'
});

commands.define('help', help, {
	commands: ['h', '?'],
	comment: 'help'
});

module.exports = commands;