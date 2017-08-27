const fs = require("fs");

const LINE_TYPES = {
	class: "class",
	id: "id",
	description: "description",
	times: "times",
	room: "room",
	instructor: "instructor",
	units: "units",
	status: "status",
	unknown: "unknown"
};

const REQUIRED_TYPES = [LINE_TYPES.class, LINE_TYPES.id, LINE_TYPES.description, LINE_TYPES.times,
	LINE_TYPES.room, LINE_TYPES.instructor];

const CLASS_MATCHER = /(([A-Z]{4}) ([0-9]{3}))-[TB]?([0-9]{2})/;
const CLASS_GROUPS = {
	name: 1,
	faculty: 2,
	number: 3,
	section: 4
};

const ID_MATCHER = /\(([0-9]+)\)/;
const ID_GROUPS = {
	id: 1
};

const DESCRIPTION_MATCHER = /(.+) \((Lecture|Tutorial|Lab)\)/;
const DESCRIPTION_GROUPS = {
	name: 1,
	type: 2
};

const TIMES_MATCHER = /((Mo|Tu|We|Th|Fr|Sa|Su)+) ((([0-9]{1,2}):([0-9]{2}))(AM|PM)) - ((([0-9]{1,2}):([0-9]{2}))(AM|PM))/;
const TIMES_GROUPS = {
	days: 1,
	timeStartFull: 3,
	timeStart: 4,
	timeStartHour: 5,
	timeStartMinute: 6,
	timeStartPeriod: 7,
	timeEndFull: 8,
	timeEnd: 9,
	timeEndHour: 10,
	timeEndMinute: 11,
	timeEndPeriod: 12
};

const ROOM_MATCHER = /(TBA|([A-Z]+) ([0-9]+[A-Z]?))/;
const ROOM_GROUPS = {
	full: 0,
	building: 2,
	room: 3
};

const INSTRUCTOR_MATCHER = /((([A-Z])\. ([A-Z][a-z]+)),?|Staff)/;
const INSTRUCTOR_GROUPS = {
	full: 2,
	firstInitial: 3,
	last: 4
};

const UNITS_MATCHER = /[0-9]+\.[0-9]+/;
const STATUS_MATCHER = /(Enrolled|Dropped|Wait Listed)/;

function classifyLine(line) {
	var match = line.match(CLASS_MATCHER);
	if (match) {
		return { type: LINE_TYPES.class, match: match };
	}

	match = line.match(ID_MATCHER);
	if (match) {
		return { type: LINE_TYPES.id, match: match };
	}

	match = line.match(DESCRIPTION_MATCHER);
	if (match) {
		return { type: LINE_TYPES.description, match: match };
	}

	match = line.match(TIMES_MATCHER);
	if (match) {
		return { type: LINE_TYPES.times, match: match };
	}

	match = line.match(ROOM_MATCHER);
	if (match) {
		return { type: LINE_TYPES.room, match: match };
	}

	match = line.match(INSTRUCTOR_MATCHER);
	if (match) {
		return { type: LINE_TYPES.instructor, match: match };
	}

	if (line.match(UNITS_MATCHER)) {
		return {type: LINE_TYPES.units};
	} else if (line.match(STATUS_MATCHER)) {
		return { type: LINE_TYPES.status };
	}

	return { type: LINE_TYPES.unknown };
}

function hasRequiredFields(found) {
	for (var i = 0; i < REQUIRED_TYPES.length; i++) {
		if (!found[REQUIRED_TYPES[i]]) {
			return false;
		}
	}
	return true;
}

function getTime(match, type) {
	var period = match[TIMES_GROUPS["time" + type + "Period"]];
	var hour = Number(match[TIMES_GROUPS["time" + type + "Hour"]]);
	if (period == "AM" && hour == 12) hour = 0;
	if (period == "PM" && hour != 12) hour += 12;
	hour = (hour + 6) % 24;		// Convert to UTC time
	return hour + ":" + match[TIMES_GROUPS["time" + type + "Minute"]];
}

function pushCourse(courses, currentCourse, extraTimes, foundForCurrent) {
	if (currentCourse && hasRequiredFields(foundForCurrent)) {
		currentCourse.isBlockWeek = extraTimes.length > 0;
		courses.push(currentCourse);		// This means we silently delete any courses with unknown fields
		for (var i = 0; i < extraTimes.length; i++) {
			var copiedCourse = JSON.parse(JSON.stringify(currentCourse));
			copiedCourse.isBlockWeek = i != extraTimes.length - 1;
			copiedCourse.meetingInfo = extraTimes[i];
			courses.push(copiedCourse);
		}
	}
}

function getEmptyMeetingInfo(currentCourse, extraTimes, property) {
	var meetingInfo = currentCourse.meetingInfo;
	if (meetingInfo[property]) {
		var index = 0;
		while (meetingInfo && meetingInfo[property]) {
			meetingInfo = extraTimes[index++];
		}
		if (!meetingInfo) {
			meetingInfo = {};
			extraTimes.push(meetingInfo);
		}
	}
	return meetingInfo;
}

function parseCourseData(courseData, callback) {
	var courses = [];
	var currentCourse = null;
	var foundForCurrent = {};
	var extraTimes = [];

	try {
		var lines = courseData.split(/\r?\n/);
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var classification = classifyLine(line);

			if (classification.type === LINE_TYPES.class) {
				pushCourse(courses, currentCourse, extraTimes, foundForCurrent);
				currentCourse = {
					classInfo: {
						shortName: classification.match[CLASS_GROUPS.name],
						number: classification.match[CLASS_GROUPS.section]
					},
					meetingInfo: {}
				};
				foundForCurrent = {};
				extraTimes = [];
			} else if (classification.type === LINE_TYPES.id && currentCourse) {
				currentCourse.classInfo.id = classification.match[ID_GROUPS.id];
			} else if (classification.type === LINE_TYPES.description && currentCourse) {
				currentCourse.classInfo.name = classification.match[DESCRIPTION_GROUPS.name];
				currentCourse.classInfo.type = classification.match[DESCRIPTION_GROUPS.type];
			} else if (classification.type === LINE_TYPES.times && currentCourse) {
				var meetingInfo = getEmptyMeetingInfo(currentCourse, extraTimes, "days");
				var days = classification.match[TIMES_GROUPS.days].match(/[A-Z][a-z]/g);
				meetingInfo.days = days.map(function(day) { return day.toUpperCase() });
				meetingInfo.start = getTime(classification.match, "Start");
				meetingInfo.end = getTime(classification.match, "End");
			} else if (classification.type === LINE_TYPES.room && currentCourse) {
				getEmptyMeetingInfo(currentCourse, extraTimes, "room").room = classification.match[ROOM_GROUPS.full];
			} else if (classification.type === LINE_TYPES.instructor && currentCourse) {
				var prof = line == "Staff" ? line : classification.match[INSTRUCTOR_GROUPS.full];
				if (currentCourse.prof) {
					currentCourse.prof += ", " + prof;
				} else {
					currentCourse.prof = prof;
				}
			}

			foundForCurrent[classification.type] = true;
		}
	} catch (err) {
		console.log("There was an error parsing the data: " + err);
		callback({
			ok: false,
			error: "Could not parse the data."
		});
		return;
	}

	pushCourse(courses, currentCourse, extraTimes, foundForCurrent);
	callback({
		ok: true,
		data: courses
	});
}

module.exports = parseCourseData;

// var data = fs.readFileSync("data.in", "utf8");
// parseCourseData(data, function (res) {
// 	console.log(res);
// });
