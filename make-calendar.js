var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');
var plus = google.plus('v1');
var MongoClient = require('mongodb').MongoClient;

var dbURL = "mongodb://localhost:27017/schedule-app";

var creds;

// get the semesters from the database
semesters = [];
MongoClient.connect(dbURL, function(err, db) {
	if(err != null) { console.log("Error opening database: " + err); return; }

	var cursor = db.collection("semesters").find();
	cursor.each(function(err, semester) {
		if(err != null) { console.log("Error getting date data from database: " + err); return; }

		if(semester != null) {
			semesters.push(semester);
		} else {
			db.close();
		}
	});
});

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		return;
	}
	creds = JSON.parse(content);
});

function app(auth, data, callback) {
	parseCourseData(data.coursedata, function(res) {
		if(!res.ok) { callback(res); return; }
		courses = res.data;

		for (var i = courses.length - 1; i >= 0; i--) {
			if(courses[i].prof === null || courses[i].classInfo.type === null || courses[i].classInfo.number === null || courses[i].classInfo.id === null ||
				courses[i].classInfo.shortName === null || courses[i].classInfo.name === null || courses[i].meetingInfo.days === null ||
				courses[i].meetingInfo.start === null || courses[i].meetingInfo.end === null || courses[i].meetingInfo.room === null) {
				courses.splice(i, 1);
			}
		}

		if(courses.length === 0) {
			console.log("The parser could not find any valid courses.");
			callback({
				ok: false,
				error: "The parser could not find any valid courses."
			});
			return;
		}

		makeCalendar(auth, data.calendarname, data.coloroption1, function(res) {
			if(!res.ok) { callback(res); return; }
			calendarObject = res.data;

			var error;
			var index = 0;
			function nextEvent(res) {
				if(index > 0 && !res.ok) error = res.error;
				if(index < courses.length) {
					makeEvent(auth, data.selectsemester, data.coloroption2, data.coloroption3, calendarObject.id, courses[index], nextEvent);
					index++;
				}
			}
			nextEvent();

			if(error !== null) {
				callback({
					ok: false,
					error: error
				});
			} else {
				getPersonInformation(auth, function(res) {
					var response = {
						ok: true,
						parsedData: courses
					};

					if(res.ok) {
						response.userInfo = res.data;
					}

					callback(response);
				});
			}
		});
	});
}

function getPersonInformation(auth, callback) {
	plus.people.get({
		auth: auth,
		userId: "me"
	}, function(err, person) {
		if(err) {
			console.log("Error getting person data: " + err);
			callback({
				ok: false,
				error: "Could not get user information."
			});
		}
		
		callback({
			ok: true,
			data: person
		});
	});
}

function makeCalendar(auth, name, color, callback) {
	calendar.calendars.insert({
		auth: auth,
		resource: {
			summary: name
		}
	}, function(err, calendarObject) {
		if(err) {
			console.log('Error when making the calendar: ' + err);
			callback({
				ok: false,
				error: "Could not make the calendar."
			});
			return;
		}
		calendar.calendarList.update({
			auth: auth,
			calendarId: calendarObject.id,
			resource: {
				colorId: color
			}
		}, function(err, response) {
			if(err) {
				console.log('Error when changing the color of the calendar: ' + err);
				callback({
					ok: false,
					error: "Could not make the calendar."
				});
				return;
			}
			callback({
				ok: true,
				data: calendarObject
			});
		});
	});
}

function makeEvent(auth, semester, lectureColor, tutorialColor, calendarId, data, callback) {	//TODO: Use semester
	var dayNums = {
		SU: 0,
		MO: 1,
		TU: 2,
		WE: 3,
		TH: 4,
		FR: 5,
		SA: 6
	};

	semester = semesters[semester];
	var endString = semester.year + semester.end.month + semester.end.day + "T000000Z";

	var year = semester.year;

	function lastSunday(month, day) {
		var d = new Date(year, month - 1, day);
		d.setDate(d.getDate() - d.getDay());
		return d.getDate();
	}

	var startDay = lastSunday(semester.start.month, semester.start.day);

	calendar.events.insert({
		auth: auth,
		calendarId: calendarId,
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
				dateTime: year + "-" + semester.start.month + "-" + (startDay + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.start + ":00.000-06:00",
				timeZone: "America/Edmonton"
			},
			end: {
				dateTime: year + "-" + semester.start.month + "-" + (startDay + dayNums[data.meetingInfo.days[0]]) + "T" + data.meetingInfo.end + ":00.000-06:00",
				timeZone: "America/Edmonton"
			},
			recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=" + endString + ";WKST=SU;BYDAY=" + data.meetingInfo.days]
		}
	}, function(err, eventObject) {
		if(err) {
			console.log('Error when making an event: ' + err);
			callback({
				ok: false,
				error: "Could not make the event " + data.classInfo.shortName + " " + data.classInfo.type + "."
			});
			return;
		}
		callback({
			ok: true,
			data: eventObject
		});
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

	try {
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
					courses[current].classInfo.type = line.substring(line.indexOf("(") + 1, line.indexOf(")"));
					courses[current].classInfo.name = line.substring(0, line.indexOf("(") - 1);
					break;
				case 3:
					if(line != "TBA") {
						res = line.split(" ");
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
	} catch(err) {
		console.log("There was an error parsing the data: " + err);
		callback({
			ok: false,
			error: "Could not parse the data."
		});
		return;
	}

	callback({
		ok: true,
		data: courses
	});
}

module.exports = function(auth, data, callback) {
	app(auth, data, callback);
};