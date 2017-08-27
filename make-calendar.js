var fs = require('fs');
var google = require('googleapis');
var calendar = google.calendar('v3');
var plus = google.plus('v1');
var scraper = require('uc-date-scraper');
var parseCourseData = require('./course-data-parser');

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
		var courses = res.data;

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
		resource: {
			summary: event.name,
			description: event.description,
			start: {
				date: semester.year + "-" + event.monthStart + "-" + event.dayStart
			},
			end: {
				date: (Number(semester.year) + event.yearEndOffset) + "-" + event.monthEnd + "-" + event.dayEnd
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

function pad2(num) {
	var str = ("0" + num);
	return str.substr(str.length - 2, 2);
}

const WEEK_DAY_INDEX = {
	SU: 0,
	MO: 1,
	TU: 2,
	WE: 3,
	TH: 4,
	FR: 5,
	SA: 6
};

function makeEvent(auth, semester, lectureColor, tutorialColor, calendarId, data, callback) {

	var year = semester.year;

	function lastSunday(month, day) {
		var d = new Date(year, month - 1, day);
		d.setDate(d.getDate() - d.getDay());
		return d.getDate();
	}

	var recurrence = [];
	if (!data.isBlockWeek) {
		var end = semester.events[semester.endClasses];
		var endString = year + end.monthEnd + pad2(Number(end.dayEnd) + 1) + "T000000Z";
		recurrence.push("RRULE:FREQ=WEEKLY;UNTIL=" + endString + ";WKST=SU;BYDAY=" + data.meetingInfo.days);

		var exception = "EXDATE;VALUE=DATE-TIME:";
		for (var i = 0; i < semester.holidays.length; i++) {
			var holiday = semester.events[semester.holidays[i]];
			var isNextMonth = false;
			var lastDay = null;
			for (var j = 0; j < holiday.days.length; j++) {
				var thisDay = holiday.days[j];
				isNextMonth = isNextMonth || (lastDay && Number(thisDay) < Number(lastDay));
				var thisYear = isNextMonth ? year + holiday.yearEndOffset : year;
				var thisMonth = isNextMonth ? holiday.monthEnd : holiday.monthStart;
				exception += (j == 0 && i == 0 ? "" : ",") + thisYear + thisMonth + thisDay +
					"T" + data.meetingInfo.start.replace(":", "") + "00Z";
				lastDay = thisDay;
			}
		}
		recurrence.push(exception);
	} else {
		recurrence.push("RRULE:FREQ=WEEKLY;COUNT=" + data.meetingInfo.days.length + ";WKST=SU;BYDAY=" + data.meetingInfo.days);
	}
	console.log(recurrence);

	var start = semester.events[data.isBlockWeek ? semester.startTerm : semester.startClasses];
	var startDay = lastSunday(start.monthStart, start.dayStart);

	calendar.events.insert({
		auth: auth,
		calendarId: calendarId,
		resource: {
			summary: data.classInfo.shortName + " " + data.classInfo.type,
			description: "Course Name: " + data.classInfo.name +
				"\nInstructor: " + data.prof +
				"\n" + data.classInfo.type + " Number: " + data.classInfo.number +
				"\nCourse ID: " + data.classInfo.id,
			colorId: data.classInfo.type == "Lecture" ? lectureColor : tutorialColor,
			location: data.meetingInfo.room,
			start: {
				dateTime: year + "-" + start.monthStart + "-" + pad2(startDay + WEEK_DAY_INDEX[data.meetingInfo.days[0]]) +
					"T" + data.meetingInfo.start + ":00Z",
				timeZone: "America/Edmonton"
			},
			end: {
				dateTime: year + "-" + start.monthEnd + "-" + pad2(startDay + WEEK_DAY_INDEX[data.meetingInfo.days[0]]) +
					"T" + data.meetingInfo.end + ":00Z",
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

module.exports = {
	make: function(auth, data, callback) {
		app(auth, data, callback);
	},
	getSemesters: getSemesters
};