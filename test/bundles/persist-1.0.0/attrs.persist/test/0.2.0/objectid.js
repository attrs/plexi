var Db = require('mongodb').Db,
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    BSON = require('mongodb').pure().BSON,
    assert = require('assert');

// Create a new ObjectID
var objectId = new ObjectID();
// Create a new ObjectID Based on the first ObjectID
var objectId2 = new ObjectID(objectId.toString());
// Create another ObjectID
var objectId3 = new ObjectID();
// objectId and objectId2 should be the same
console.log(objectId);
console.log(objectId.toString());
console.log(objectId2);
console.log(objectId3);

console.log((typeof(objectId)));