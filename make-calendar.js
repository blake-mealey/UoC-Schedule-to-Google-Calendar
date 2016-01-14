var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');
var readline = require('readline');


var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
		process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

var ready = false;
var auth;

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		return;
	}
	// Authorize a client with the loaded credentials, then call the
	// Google Calendar API.
	authorize(JSON.parse(content), function(newauth) {
		ready = true;
		auth = newauth;
	});
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

function app(data, callback) {
	parseCourseData(data.coursedata, function(courses) {
		for (var i = courses.length - 1; i >= 0; i--) {
			if(courses[i].prof == null || courses[i].classInfo.type == null || courses[i].classInfo.number == null || courses[i].classInfo.id == null ||
				courses[i].classInfo.shortName == null || courses[i].classInfo.name == null || courses[i].meetingInfo.days == null ||
				courses[i].meetingInfo.start == null || courses[i].meetingInfo.end == null || courses[i].meetingInfo.room == null) {
				courses.splice(i);
			}
		};
		if(courses.length == 0) {
			console.log("Error: The parser could not find any valid courses.");
			callback({
				ok: false,
				error: "The parser could not find any valid courses."
			});
		}
		makeCalendar(data.calendarname, data.coloroption1, function(calendarObject) {
			index = 0;
			function nextEvent() {
				if(index < courses.length) {
					makeEvent(data.selectsemester, data.coloroption2, data.coloroption3, calendarObject, courses[index], nextEvent);
					index++;
				}
			}
			nextEvent();
			callback({
				ok: true
			});
		});
	});
}

function makeCalendar(name, color, callback) {		//TODO: Use color
	calendar.calendars.insert({
		auth: auth,
		resource: {
			kind: "calendar#calendar",
			summary: name
		}
	}, function(err, response) {
		if(err) {
			console.log('Error when making the calendar: ' + err);
			return;
		}
		callback(response);
	});
}

function makeEvent(semester, lectureColor, tutorialColor, calendarObject, data, callback) {	//TODO: Use semester
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
			summary: data.classInfo.shortName + " " + data.classInfo.type,
			description: "Course Name: " + data.classInfo.name +
				"\nInstructor: " + data.prof +
				"\n" + data.classInfo.type + " Number: " + data.classInfo.number +
				"\nCourse ID: " + data.classInfo.id,
			colorId: data.classInfo.type == "Lecture" ? lectureColor : tutorialColor,
			location: data.meetingInfo.room,
			start: {
				dateTime: "2016-01-" + (10 + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.start + ":00.000-07:00",
				timeZone: "America/Los_Angeles"
			},
			end: {
				dateTime: "2016-01-" + (10 + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.end + ":00.000-07:00",
				timeZone: "America/Los_Angeles"
			},
			recurrence: ["RRULE:FREQ=WEEKLY;COUNT=20;WKST=SU;BYDAY=" + data.meetingInfo.days]
		}
	}, function(err, response) {
		if(err) {
			console.log('Error when making an event: ' + err);
			return;
		}
		callback(response);
	});
}

function parseCourseData(courseData, callback) {
	var courses = [];

	var current;
	var counter = 0;

	var i = 0;

	function parseTime(time) {
		var amIndex = time.indexOf("AM");
		var pmIndex = time.indexOf("PM");
		var colonIndex = time.indexOf(":");
		var hour = Number(time.substring(0, colonIndex));
		if(amIndex != -1) {
			time = time.substring(0, amIndex);
			if(hour == 12) hour = 0;
			time = hour + ":" + time.substring(colonIndex + 1);
		} else if(pmIndex != -1) {
			time = time.substring(0, pmIndex);
			if(hour != 12) hour = hour + 12;
			time = hour + ":" + time.substring(colonIndex + 1);
		}
		return time;
	}

	while(i < courseData.length) {
		var j = courseData.indexOf("\r\n", i);
		if(j == -1) j = courseData.length;
		var line = courseData.substring(i, j);

		var currentStep = counter % 7;
		i = j + 2;
		if(/^\s*$/.test(line) && currentStep < 6) {	// contains only whitespace
			continue;
		} else if(currentStep == 6 && line.indexOf("-") == -1) {
			continue;
		} else if(currentStep == 6) {
			counter++;
			currentStep = 0;
		}

		switch(currentStep) {
			case 0:
				current = courses.length;
				var res = line.split("-");
				if(res[1].length == 3) {
					res[1] = res[1].substring(1);
				}
				courses[current] = {
					classInfo: {
						number: res[1],
						shortName: res[0]
					},
					meetingInfo: {}
				};
				break;
			case 1:
				courses[current].classInfo.id = line.substring(1, line.length - 1);
				break;
			case 2:
				courses[current].classInfo.type = line.substring(line.indexOf("(") + 1, line.indexOf(")"))
				courses[current].classInfo.name = line.substring(0, line.indexOf("(") - 1);
				break;
			case 3:
				if(line != "TBA") {
					var res = line.split(" ");
					var days = res[0].match(/[A-Z][a-z]/g);
					for(var k = 0; k < days.length; k++) {
						days[k] = days[k].toUpperCase();
					}
					courses[current].meetingInfo.days = days;
					courses[current].meetingInfo.start = parseTime(res[1]);
					courses[current].meetingInfo.end = parseTime(res[3]);
				}
				break;
			case 4:
				courses[current].meetingInfo.room = line;
				break;
			case 5:
				courses[current].prof = line;
				break;
		}

		counter++;
	}

	console.dir(courses);

	callback(courses);
}

module.exports = function(data, callback) {
	if(ready) {
		app(data, callback);
	}
}