// get libraries
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

// declare constants
var dbURL = "mongodb://localhost:27017/schedule-app";

// get arguments
var outputFile = process.argv[2];
if(outputFile == null) { outputFile = "out.csv"; }

console.log("Starting usage reader.");

// read data from database
function getData(callback) {
	MongoClient.connect(dbURL, function(err, db) {
		if(err != null) { console.log("Error connecting to database: " + err); return; }

		console.log("Reading data from database.");

		var cursor = db.collection("usage").find();
		var data = []

		cursor.each(function(err, doc) {
			if(err != null) { console.log("Error reading data from database: " + err); return; }

			if(doc != null) {
				var name = null
				if(doc.userInfo) { name = doc.userInfo.displayName; }

				var usage = {
					date: doc.date.year + "/" + doc.date.month + "/" + doc.date.day,
					calendarName: doc.calendarname,
					courses: [],
					userName: name
				}

				for(var i = doc.courseData.length - 1; i >= 0; i--) {
					var courseData = doc.courseData[i];
					usage.courses[usage.courses.length] = {
						courseName: courseData.classInfo.name,
						instructor: courseData.prof
					}
				}

				data[data.length] = usage;
			} else {
				db.close();
				callback(data);
			}
		})
	});
}

// write data to .csv file
getData(function(data) {
	console.log("Saving data to .csv file.");

	var formattedData = "";
	for(var i = data.length - 1; i >= 0; i--) {				// TODO: write simple library to make this easier :P
		var usage = data[i];
		formattedData += usage.userName + ",";
		formattedData += usage.date + ",";
		formattedData += usage.calendarName + "\n";
		for(var j = 0; j < usage.courses.length; j++) {
			var course = usage.courses[j];
			formattedData += ((j + 1) + ",");
			formattedData += course.courseName + ","
			formattedData += course.instructor + "\n"
		}
		formattedData += "\n"
	}

	fs.writeFile(outputFile, formattedData, function(err) {
		if(err) { return console.log("Error writing to .csv file: " + err); }

		console.log("Data saved to " + outputFile);
	});
});