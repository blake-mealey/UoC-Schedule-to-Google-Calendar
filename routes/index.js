var express = require('express');
var router = express.Router();

var makecalendar = require('./../make-calendar');	// I thought I wouldn't need the ./../ but it doesn't work without it.

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'UofC Schedule to Google Calendar' });
});

/* POST to the makecalendar page. */
router.post('/makecalendar', function(req, res, next) {		// TODO: Put "working..." animation on /makecalendar
	//res.render('makecalendar', { title: 'Making Calendar' });
	makecalendar(req.body, function() {
		//res.redirect(http://calendar.google.com); // new tab?
		res.redirect('/scheduleapp');	// as well as the above? maybe make the POST to / to start with?
	});
});

module.exports = router;
