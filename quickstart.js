var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');

var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
		process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		return;
	}
	// Authorize a client with the loaded credentials, then call the
	// Google Calendar API.
	authorize(JSON.parse(content), app);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	var clientSecret = credentials.installed.client_secret;
	var clientId = credentials.installed.client_id;
	var redirectUrl = credentials.installed.redirect_uris[0];
	var auth = new googleAuth();
	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.credentials = JSON.parse(token);
			callback(oauth2Client);
		}
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
	console.log('Authorize this app by visiting this url: ', authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Enter the code from that page here: ', function(code) {
		rl.close();
		oauth2Client.getToken(code, function(err, token) {
			if (err) {
				console.log('Error while trying to retrieve access token', err);
				return;
			}
			oauth2Client.credentials = token;
			storeToken(token);
			callback(oauth2Client);
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch (err) {
		if (err.code != 'EEXIST') {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
	var calendar = google.calendar('v3');
	calendar.events.list({
		auth: auth,
		calendarId: 'primary',
		timeMin: (new Date()).toISOString(),
		maxResults: 10,
		singleEvents: true,
		orderBy: 'startTime'
	}, function(err, response) {
		if (err) {
			console.log('The API returned an error: ' + err);
			return;
		}
		var events = response.items;
		if (events.length == 0) {
			console.log('No upcoming events found.');
		} else {
			console.log('Upcoming 10 events:');
			for (var i = 0; i < events.length; i++) {
				var event = events[i];
				var start = event.start.dateTime || event.start.date;
				console.log('%s - %s', start, event.summary);
			}
		}
	});
}

function app(auth) {
	makeCalendar(auth, function(calendarObject) {
		parseClasses(auth, calendarObject);
	});
}

function makeCalendar(auth, callback) {
	calendar.calendars.insert({
		auth: auth,
		resource: {
			kind: "calendar#calendar",
			summary: "Winter 2016"
		}
	}, function(err, response) {
		if(err) {
			console.log('Error when making the calendar: ' + err);
			return;
		}
		callback(response);
	});
}

function makeEvent(auth, calendarObject, data, callback) {
	var dayNums = {
		SU: 0,
		MO: 1,
		TU: 2,
		WE: 3,
		TH: 4,
		FR: 5,
		SA: 6
	}

	calendar.events.insert({
		auth: auth,
		calendarId: calendarObject.id,
		maxAttendees: 1,
		sendNotifications: false,
		supportsAttachments: false,
		resource: {
			summary: data.classInfo.shortName,
			location: data.meetingInfo.room,
			start: {
				dateTime: "2016-01-" + (10 + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.start + ":00.000-07:00",
				timeZone: "America/Los_Angeles"
			},
			end: {
				dateTime: "2016-01-" + (10 + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.end + ":00.000-07:00",
				timeZone: "America/Los_Angeles"
			},
			recurrence: ["RRULE:FREQ=WEEKLY;COUNT=50;WKST=SU;BYDAY=" + data.meetingInfo.days]
		}
	}, function(err, response) {
		if(err) {
			console.log('Error when making an event: ' + err);
			return;
		}
		callback(response);
	});
}

function parseClasses(auth, calendarObject) {
	var classes = [];

	var lineReader = readline.createInterface({
		input: fs.createReadStream('data.in')
	});

	var current;
	var counter = 0;

	lineReader.on('line', function(line) {
		switch(counter % 8) {
			case 0:
				current = classes.length;
				var res = line.split("-");
				var first;
				if(res[1].length == 3) {
					first = res[1].substring(0, 1);
					res[1] = res[1].substring(1);
				}
				classes[current] = {
					classInfo: {
						type: first == null ? "Lecture" : first == "T" ? "Tutorial" : "Lab",
						number: res[1],
						shortName: res[0]
					},
					meetingInfo: {}
				};
				break;
			case 1:
				classes[current].classInfo.id = line.substring(1, line.length - 1);
				break;
			case 2:
				classes[current].classInfo.name = line.substring(0, line.indexOf("(") - 1);
				break;
			case 3:
				var res = line.split(" ");
				var days = res[0].match(/[A-Z][a-z]/g);
				if(days != null) {
					for(var i = 0; i < days.length; i++) {
						days[i] = days[i].toUpperCase();
					}
					classes[current].meetingInfo.days = days;
				}
				classes[current].meetingInfo.start = res[1];
				classes[current].meetingInfo.end = res[3];
				break;
			case 4:
				classes[current].meetingInfo.room = line;
				break;
			case 5:
				classes[current].prof = line;
				break;
		}
		counter++;
	}).on('pause', function() {
		lineReader.close();

		console.log(classes);

		index = 0;
		function nextEvent() {
			if(index < classes.length) {
				if(classes[index].meetingInfo.start) {
					makeEvent(auth, calendarObject, classes[index], nextEvent);
				}
				index++;	
			}
		}
		nextEvent();
	});
}