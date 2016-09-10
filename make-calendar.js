var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');
var plus = google.plus('v1');
var scraper = require('uc-date-scraper');

var creds;
var semesters;

function getSemesters(cb) {
	if(semesters === undefined) {
		scraper(null, function(data) {
			semesters = data;
			cb(semesters);
		});
	} else {
		cb(semesters);
	}
}

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
			if(courses[i].prof === undefined || courses[i].classInfo.type === undefined || courses[i].classInfo.number === undefined || courses[i].classInfo.id === undefined ||
					courses[i].classInfo.shortName === undefined || courses[i].classInfo.name === undefined || courses[i].meetingInfo.days === undefined ||
					courses[i].meetingInfo.start === undefined || courses[i].meetingInfo.end === undefined || courses[i].meetingInfo.room === undefined) {
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

			getSemesters(function(semesters) {
				var semester = semesters[data.selectsemester];

				var error = null;
				var index = 0;

				function next() {
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
				}

				function nextDayEvent(res) {
					if(index > 0 && !res.ok) error = res.error;
					if(index < semester.events.length) {
						makeDayEvent(auth, semester, semester.events[index++], calendarObject.id, nextDayEvent);
					} else {
						next();
					}
				}

				function nextEvent(res) {
					if(index > 0 && !res.ok) error = res.error;
					if(index < courses.length) {
						makeEvent(auth, semester, data.coloroption2, data.coloroption3,
							calendarObject.id, courses[index++], nextEvent);
					} else {
						index = 0;
						nextDayEvent();
					}
				}
				nextEvent();
			});
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

function makeDayEvent(auth, semester, event, calendarId, callback) {
	calendar.events.insert({
		auth: auth,
		calendarId: calendarId,
		maxAttendees: 1,
		sendNotifications: false,
		supportsAttachments: false,
		resource: {
			summary: event.name,
			description: event.description,
			start: {
				date: semester.year + "-" + event.month + "-" + event.day
			},
			end: {
				date: semester.year + "-" + event.month + "-" + event.day
			}
		}
	}, function(err, eventObject) {
		if(err) {
			console.log('Error when making an all-day event: ' + err);
			callback({
				ok: false,
				error: "Could not make the all-day event " + event.name + "."
			});
			return;
		}
		callback({
			ok: true,
			data: eventObject
		});
	});
}

function makeEvent(auth, semester, lectureColor, tutorialColor, calendarId, data, callback) {
	var dayNums = {
		SU: 0,
		MO: 1,
		TU: 2,
		WE: 3,
		TH: 4,
		FR: 5,
		SA: 6
	};

	var year = semester.year;

	function lastSunday(month, day) {
		var d = new Date(year, month - 1, day);
		d.setDate(d.getDate() - d.getDay());
		return d.getDate();
	}


	var end = semester.events[semester.end];
	var endString = year + end.month + end.day + "T000000Z";
	var recurrence = [
		"RRULE:FREQ=WEEKLY;UNTIL=" + endString + ";WKST=SU;BYDAY=" + data.meetingInfo.days
	];

	var exception = "EXDATE;VALUE=DATE-TIME:";
	for(var i = 0; i < semester.holidays.length; i++) {
		var holiday = semester.events[semester.holidays[i]];
		var localException = year + holiday.month + holiday.day +
			"T" + data.meetingInfo.start.replace(":", "") + "00";
		exception += localException + (i < semester.holidays.length - 1 ? "," : "");
	}
	recurrence.push(exception);

	var start = semester.events[semester.start];
	var startDay = lastSunday(start.month, start.day);
	var timeEnd = ":00.000-06:00";

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
				dateTime: year + "-" + start.month + "-" + (startDay + dayNums[data.meetingInfo.days[0]]) +
					"T" + data.meetingInfo.start + timeEnd,
				timeZone: "America/Edmonton"
			},
			end: {
				dateTime: year + "-" + start.month + "-" + (startDay + dayNums[data.meetingInfo.days[0]]) +
					"T" + data.meetingInfo.end + timeEnd,
				timeZone: "America/Edmonton"
			},
			recurrence: recurrence
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

module.exports = {
	make: function(auth, data, callback) {
		app(auth, data, callback);
	},
	getSemesters: getSemesters
};