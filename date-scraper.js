// get libraries
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var htmlparser = require('htmlparser2');

// declare constants
var dbURL = "mongodb://localhost:27017/schedule-app";
var dataURL = "https://www.ucalgary.ca/pubs/calendar/current/academic-schedule.html";

// Hello, World!
console.log("Running UofC Schedule to Google Calendar date scraper.");
console.log("\nGetting web page: " + dataURL);

// declare variables
var currentlyReadingTable = false;
var currentlyReadingRow = false;
var currentlyReadingCol = false;
var currentRowDecoder = null;
var currentRow = 0;
var currentCol = 0;
var currentColText = null;
var currentSemesterData = [];
var currentTableColCount = 0;

var semesterData = [];

// https://stackoverflow.com/questions/13566552/easiest-way-to-convert-month-name-to-month-number-in-js-jan-01
function getMonth(monthStr){
	return new Date(monthStr+'-1-01').getMonth() + 1;
}

// https://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

// save semester data to the MongoDB database
function saveSemesters(semesters, index) {
	if(index === null) {
		MongoClient.connect(dbURL, function(err, db) {
			if(err !== null) { console.log("Error saving semester data to database: " + err); return; }

			db.collection("semesters").remove({}, function(err, results) {
				if(err !== null) { console.log("Error saving semester data to database: " + err); return; }

				db.close();
				saveSemesters(semesters, 0);
			});
		});
	} else {
		var semester = semesters[index];
		console.dir(semester);
		console.log("\n");
		MongoClient.connect(dbURL, function(err, db) {
			if(err !== null) { console.log("Error saving semester data to database: " + err); return; }

			db.collection("semesters").insertOne(semester, function(err, results) {
				if(err !== null) { console.log("Error saving semester data to dataabse: " + err); return; }

				db.close();
				if(index + 1 < semesters.length) {
					saveSemesters(semesters, index + 1);
				} else {
					console.log("Finished saving dates.");
				}
			});
		});
	}
}

// call each function as you move through the rows of the table
// pass the current column and text as parameters
var rowDecoders = {
	// header: get semester names
	"HEADER": function(column, text) {
		if(column > 0 && text.indexOf("/") == -1) {
			var name = text.match(/(Spring|Summer|Fall|Winter)/g)[0];
			var year = text.match(/\d+/)[0];

			currentSemesterData.push({
				"name": name,
				"year": year
			});
		}
	},

	// start of classes: save results
	"Start of Classes": function(column, text) {
		var semester = currentSemesterData[column - (currentTableColCount == 4 ? 2 : 1)];
		if(semester && column > 0) {
			var dateInfo = text.split(/\W+/);
			if(dateInfo.length === 3 && Number(dateInfo[2]) !== null) {
				semester.start = {
					"month": pad(getMonth(dateInfo[1]), 2),
					"day": pad(Number(dateInfo[2]), 2)
				};
			}
		}
	},

	// end of classes: save results
	"End of Classes": function(column, text) {
		var semester = currentSemesterData[column - (currentTableColCount == 4 ? 2 : 1)];
		if(semester && column > 0) {
			var dateInfo = text.split(/\W+/);
			if(dateInfo.length === 3 && Number(dateInfo[2]) !== null) {
				semester.end = {
					"month": pad(getMonth(dateInfo[1]), 2),
					"day": pad(Number(dateInfo[2]) + 1, 2)
				};
			}
		}
	}
};

// do the parsing
var htmlparser = require("htmlparser2");
var parser = new htmlparser.Parser({
	onopentag: function(name, attribs) {
		if(name === "table" && attribs.id && attribs.id.indexOf("uc-table-left") != -1) {
			currentlyReadingTable = true;
			currentRow = 0;
			currentTableColCount = 0;
			currentSemesterData = [];
		} else if(name === "tr" && currentlyReadingTable) {
			currentCol = 0;
			currentlyReadingRow = true;
		} else if(name === "td" && currentlyReadingRow) {
			currentlyReadingCol = true;
			currentColText = "";
		}
	},
	ontext: function(text) {
		if(currentlyReadingCol) {
			currentColText += text.trim();
		}
	},
	onclosetag: function(tagname) {
		if(tagname === "table" && currentlyReadingTable) {
			currentlyReadingTable = false;
			for(var i = currentSemesterData.length - 1; i >= 0; i--) {
				semesterData.push(currentSemesterData[i]);
			}
		} else if(tagname === "tr" && currentlyReadingRow) {
			currentlyReadingRow = false;
			currentRow++;
		} else if(tagname === "td" && currentlyReadingCol) {
			currentlyReadingCol = false;
			if(currentCol === 0) {
				if(currentRow === 0) {
					currentRowDecoder = rowDecoders.HEADER;
				} else {
					currentRowDecoder = rowDecoders[currentColText];
				}
			} else if(currentRowDecoder) {
				currentRowDecoder(currentCol, currentColText);
			}
			currentCol++;
			currentTableColCount = Math.max(currentTableColCount, currentCol);
		}
	}
}, {decodeEntities: true});

// get the webpage
request({
	uri: dataURL,
	method: "GET"
}, function(err, res, body) {
	if(err || res.statusCode != 200) {
		console.log("Error occured: " + err);
		return;
	}

	console.log("Finished getting webpage.");
	console.log("\nParsing webpage.");

	parser.write(body);
	parser.end();

	console.log("Finished parsing webpage.");
	console.log("\nSaving semester data.");

	saveSemesters(semesterData);
});