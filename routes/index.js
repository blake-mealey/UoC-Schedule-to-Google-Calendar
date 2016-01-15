var express = require('express');
var router = express.Router();

var makecalendar = require('./../make-calendar');

var gauth;
require('./../google-auth')(function(res) {
	gauth = res;
});

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'UofC Schedule to Google Calendar' });
});

var lastBody;

/* POST to the makecalendar page. */
router.post('/makecalendar', function(req, res, next) {
	lastBody = req.body;
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

		var thisBody = lastBody;
		lastBody = null;
		makecalendar(gauth.client, thisBody, function(result) {
			if(result.ok) {
				console.log("Created calendar with no errors.")
			} else {
				console.log("Failed to created calendar: " + result.error);
			}
			res.redirect('/');
		});
	});
});

module.exports = router;
