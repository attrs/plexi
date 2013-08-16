var path = require('path');
var bs = require('./bundle.system');

var home = __dirname;
var bundles = path.join(__dirname, 'bundles');
var workspace = path.join(__dirname, 'workspace');

var app = bs.startup(home, bundles, workspace);

console.log('[' + app.applicationId + '] ' + app.name + ' started!');
