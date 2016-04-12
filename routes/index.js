var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var router = express.Router();

var dbURL = "mongodb://localhost:27017/schedule-app";

var makecalendar = require('./../make-calendar');

var gauth;
require('./../google-auth')(function(res) {
	gauth = res;
});

// get the semester options from the database
semesterOptions = [];
MongoClient.connect(dbURL, function(err, db) {
	if(err != null) { console.log("Error opening database: " + err); return; }

	var cursor = db.collection("semesters").find();
	cursor.each(function(err, semester) {
		if(err != null) { console.log("Error getting date data from database: " + err); return; }

		if(semester != null) {
			semesterOptions.push(semester.name + " " + semester.year);
		} else {
			db.close();
		}
	});
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var locals = {
		title: 'UofC Schedule to Google Calendar',
		display: req.session.result ? (req.session.result.ok != null).toString() : null,
		ok: req.session.result ? req.session.result.ok.toString() : null,
		error: req.session.result ? req.session.result.error : null,
		options: semesterOptions
		//options: ["Spring 2016", "Summer 2016", "Fall 2016", "Winter 2017", "Spring 2017", "Summer 2017"]
	}
	req.session = null;
	res.render('index', locals);
});

/* POST to the makecalendar page. */
router.post('/makecalendar', function(req, res, next) {
	req.session.courseData = req.body;
	res.redirect(gauth.getUrl());
});

/* GET to Google's OAuth callback page */
router.get('/auth/google/callback', function(req, res) {
	var code = req.query.code;
	gauth.client.getToken(code, function(err, token) {
		if(err) {
			console.log('Error while trying to retrieve access token', err);
			return;
		}
		gauth.client.credentials = token;

		var courseData = req.session.courseData;
		makecalendar(gauth.client, courseData, function(result) {
			req.session.courseData = null;
			req.session.result = result;
			res.redirect('/#submission');
		});
	});
});

module.exports = router;
