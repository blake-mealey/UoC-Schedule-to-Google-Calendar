var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;
var makeCalendar = require('./../make-calendar');

var dbURL = "mongodb://localhost:27017/schedule-app";


var gauth;
require('./../google-auth')(function(res) {
	gauth = res;
});

// get the semester options from the database
semesterOptions = [];
makeCalendar.getSemesters(function(semesters) {
	for(var i = 0; i < semesters.length; i++) {
		var semester = semesters[i];
		semesterOptions.push(semester.name + " " + semester.year);
	}
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var locals = {
		title: 'UofC Schedule to Google Calendar',
		display: req.session.result ? (req.session.result.ok !== undefined).toString() : null,
		ok: req.session.result ? req.session.result.ok.toString() : null,
		error: req.session.result ? req.session.result.error : null,
		options: semesterOptions
	};
	req.session = null;
	res.render('index', locals);
});

/* POST to the makeCalendar page. */
router.post('/makeCalendar', function(req, res, next) {
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
		makeCalendar.make(gauth.client, courseData, function(result) {
			if(result.ok) {
				var date = new Date();

				var usageInfo = courseData;
				usageInfo.coursedata = null;
				usageInfo.courseData = result.parsedData;
				usageInfo.date = {
					"day": date.getDate(),
					"month": date.getMonth() + 1,
					"year": date.getFullYear(),
					"hour": date.getHours(),
					"minute": date.getMinutes()
				};
				usageInfo.userInfo = result.userInfo;

				MongoClient.connect(dbURL, function(err, db) {
					if(err !== null) { console.log("Error opening database: " + err); return; }

					db.collection("usage").insertOne(usageInfo, function(err, results) {
						if(err !== null) { console.log("Error saving usage info to database: " + err); return; }

						db.close();
					});
				});
			}

			req.session.courseData = null;
			req.session.result = result;
			res.redirect('/#submission');
		});
	});
});

module.exports = router;
