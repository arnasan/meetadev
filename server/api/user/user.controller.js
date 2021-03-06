'use strict';

var User = require('./user.model');
var passport = require('passport');
var config = require('../../config/environment');
var jwt = require('jsonwebtoken');
var _ = require('lodash');
var freelancersEngine = require('components/mad-engine').freelancersEngine;
var Project = require('api/project/project.model');
var Match = require('api/match/match.model');

var validationError = function (res, err) {
  return res.status(422).json(err);
};

/**
 * Get list of users
 * restriction: 'admin'
 */
exports.index = function (req, res) {
  User.find({}, '-salt -hashedPassword', function (err, users) {
    if (err) return res.status(500).send(err);
    res.status(200).json(users);
  });
};

/**
 * Creates a new user
 */
exports.create = function (req, res, next) {
  var newUser = new User(req.body);
  newUser.provider = 'local';
  if (newUser.role !== 'client' && newUser.role !== 'freelancer') return res.status(500).send('Invalid User Role');
  newUser.save(function (err, user) {
    if (err) return validationError(res, err);
    var token = jwt.sign({_id: user._id}, config.secrets.session, {expiresInMinutes: 60 * 5});
    res.json({token: token});
  });
};

/**
 * Get a single user
 */
exports.show = function (req, res, next) {
  var userId = req.params.id;

  User.findById(userId, function (err, user) {
    if (err) return next(err);
    if (!user) return res.status(401).send('Unauthorized');
    res.json(user.profile);
  });
};

/**
 * Deletes a user
 * restriction: 'admin'
 */
exports.destroy = function (req, res) {
  User.findByIdAndRemove(req.params.id, function (err, user) {
    if (err) return res.status(500).send(err);
    return res.status(204).send('No Content');
  });
};

/**
 * Change a users password
 */
exports.changePassword = function (req, res, next) {
  var userId = req.user._id;
  var oldPass = String(req.body.oldPassword);
  var newPass = String(req.body.newPassword);

  User.findById(userId, function (err, user) {
    if (user.authenticate(oldPass)) {
      user.password = newPass;
      user.save(function (err) {
        if (err) return validationError(res, err);
        res.status(200).send('OK');
      });
    } else {
      res.status(403).send('Forbidden');
    }
  });
};

/**
 * Get my info
 */
exports.me = function (req, res, next) {
  var userId = req.user._id;
  User.findOne({
      _id: userId
    }, '-salt -hashedPassword -projects',
    function (err, user) { // don't ever give out the password or salt
      if (err) return next(err);
      if (!user) return res.status(401).send('Unauthorized');
      res.json(user);
    });
};

/**
 * Update my profile
 */
exports.updateProfile = function (req, res, next) {
  var userId = req.user._id;

  User.findById(userId, function (err, user) {
    var attrs = _.pick(req.body, ['title', 'website', 'aboutMe', 'skills', 'hourlyRate', 'company']);

    var updatedUser = _.merge(user, attrs);
    user.markModified('skills');
    updatedUser.save(function (err) {
      if (err) return validationError(res, err);
      res.status(200).send('OK');
    });
  });
};

// Get matching freelancers for a project
exports.matchFreelancers = function(req, res) {
  Project.findOne({_id: req.query.projectId}, function (err, project) {
    if (err) {return handleError(res, err); }
    if (!project) {return handleError(res, "No Project Selected"); }

    freelancersEngine.search(project, function(err, matchedUsers){
      if (err) { return handleError(res, err); }
      return res.status(200).json(matchedUsers);
    });
  });
};

// Like a freelancer.
exports.ok = function(req, res) {
  var freelancerId = req.params.id;
  var projectId = req.query.projectId;

  Project.update({_id: projectId},{$addToSet: {okFreelancers: freelancerId}},function(err){
    if (err) { return handleError(res, err); }

    User.findOne({_id: freelancerId, okProjects: projectId }, function (err,freelancer) {
      if (err) { return handleError(res, err); }

      if(freelancer) {
        Match.create({freelancer: freelancerId, project: projectId, client: req.user._id},function(err,match){
          if (err) { return handleError(res, err); }
        })
      }
    });

    res.status(200).send('OK');
  });
};

// DisLike a freelancer.
exports.nok = function(req, res) {
  Project.update({_id: req.query.projectId},{$addToSet: {nokFreelancers: req.params.id}},function(err){
    if (err) { return handleError(res, err); }

    res.status(200).send('OK');
  });
};


/**
 * Authentication callback
 */
exports.authCallback = function (req, res, next) {
  res.redirect('/');
};

function handleError(res, err) {
  return res.status(500).json(err);
}