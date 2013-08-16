var path = require('path');
var bs = require('../');

bs.cli.start();
var app = bs.startup(__dirname);

console.log('[' + app.applicationId + '] ' + app.name + ' started!');
