var express = require('express');
var router = express.Router();

var makecalendar = require('./../make-calendar');

var gauth;
require('./../google-auth')(function(res) {
	gauth = res;
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var locals = {
		title: 'UofC Schedule to Google Calendar',
		display: req.session.result ? (req.session.result.ok != null).toString() : null,
		ok: req.session.result ? req.session.result.ok.toString() : null,
		error: req.session.result ? req.session.result.error : null
	}
	req.session = null;
	res.render('index', locals);
});

/* POST to the makecalendar page. */
router.post('/makecalendar', function(req, res, next) {
	req.session.courseData = req.body;
	res.redirect(gauth.url);
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
			res.redirect('/');
		});
	});
});

module.exports = router;
