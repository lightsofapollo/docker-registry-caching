var express = require('express');
var aws = require('aws-sdk-promise');
var request = require('superagent-promise');
var app = express();
var Promise = require('promise');
var debug = require('debug')('docker-registry');

console.log(process.env);
var bucket = process.env.S3_BUCKET;
var s3Path = 'images/';

var s3 = new aws.S3({
  region: 'us-west-2'
});

// s3 paths
[
  '/v1/images/:image_id/json',
].forEach(function(path) {
  app.all(path, function(req, res, next) {
    var parts = req.path.split('/').slice(2);
    var jsonKey = parts.join('/');
    var layerKey = parts.slice(0, -1).join('/') + '/layer';
    console.log(s3Path + layerKey);

    var objectPromise = getObject(jsonKey);
    var objectSize = s3.headObject({
      Bucket: bucket,
      Key: s3Path + layerKey
    }).
    promise();

    Promise.all([objectPromise, objectSize]).then(function(args) {
      var json = args.shift();
      var sizeReq = args.shift();

      res.set('X-Docker-Size', sizeReq.data.ContentLength);
      res.send(200, json);

    }).catch(function(err) {
      console.error(err.stack);
    });
  });
});

[
  '/v1/images/:image_id/ancestry',
  '/v1/images/:image_id/layer',
].forEach(function(path) {
  app.all(path, function(req, res, next) {
    var parts = req.path.split('/');
    var s3RelativePath = parts.slice(2).join('/');
    signedPath = getObjectUrl(s3RelativePath);
    res.set('Location', signedPath);
    res.send(301);
  });
});


function getObject(key) {
  console.log('get object', key);
  return s3.getObject({
    Bucket: bucket,
    Key: s3Path + key
  }).
  promise().
  then(function(object) {
    return JSON.parse(object.data.Body.toString());
  });
}

function getObjectUrl(key) {
  return s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: s3Path + key
  });
}

function fetchTags(repository) {
  return getObject('repositories/' + repository + '/_index_images').
    then(function(body) {
      var result = body.reduce(function(tagged, image) {
        if (image.Tag) {
          tagged[image.Tag] = image.id;
        }
        return tagged;
      }, {});
      return result;
    });
}

function repositoryName(repository) {
  return 'library/' + repository;
}

function tagHandler(req, res) {
  var tagName = req.params.tag;
  console.log(req.params);
  fetchTags(req.params.repository).then(function(tags) {
    // handle specific tags
    if (tagName) {
      if (tags[tagName]) {
        return res.send(200, JSON.stringify(tags[tagName]));
      } else {
        return res.send(400);
      }
    }
    // all the tags
    res.send(200, tags);
  }).catch(function(err) {
    console.error(err.stack);
    res.send(500, 'Failed to fetch tag index information');
  });
}

function imageHandler(req, res) {
  return getObject(
    'repositories/' + req.params.repository + '/_index_images'
  ).
  then(res.send.bind(res, 200)).
  catch(function(err) {
    console.error(err.stack);
  });
}

var ACTIONS = ['tags', 'images'];

app.get('/v1/repositories/*', function(req, res) {
  var parts = req.url.split('/');
  /*
  [
    '',
    'v1',
    'repositories',
    'reponame',
    'projectname',
    'tags',
    'tagValue'
  ]
  */

  var pathParts = parts.slice(3);
  console.log(pathParts);
  var repositoryParts = [];

  var pathPart;
  while (
    // has a part
    (pathPart = pathParts.shift()) &&
    // but the part is not an action
    ACTIONS.indexOf(pathPart) === -1
  ) {
    repositoryParts.push(pathPart);
  }

  var action = pathPart;
  var repoPath = repositoryParts.join('/');
  var host = process.env.HOST || req.headers.host;

  res.set('Content-Type', 'application/json');
  res.set('X-Docker-Endpoints', host);
  debug('using endpoint:', host);
  req.params.repository = repoPath;

  switch (action) {
    case 'tags':
      // do not prefix repository here it should include library in the path
      req.params.repository = repoPath;
      req.params.tag = pathParts.shift();
      return tagHandler(req, res);
    case 'images':
      // prefix with library because images does not do auto corrections
      req.params.repository = repositoryName(repoPath);
      return imageHandler(req, res);
    default:
      return res.send(404);
  }
});

app.get('/v1/_ping', function(req, res) {
  res.set('X-Docker-Registry-Version', 1);
  res.set('X-Docker-Registry-Standalone', "true");
  res.send(200, '');
});

function defineS3Redirect(path) {
  app.get(path, function(req, res, next) {
    // sign url
    console.log(req.path);
  });
}

app.listen(8080, function (server) {
  console.log('listening');
});
