var semver = require('semver');


var version = '1.x || >=2.5.0 || 5.0.0 - 7.2.3';
console.log('version', version);
console.log('clean', semver.clean(version));
console.log('valid', semver.valid(version));
