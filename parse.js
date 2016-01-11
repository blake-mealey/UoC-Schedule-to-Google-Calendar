var readline = require('readline');
var fs = require('fs');

/*
	From input:

		CPSC 359-01
		(12973)
		Computing Machinery II (Lecture)
		TuTh 15:30 - 16:45
		ST 145
		J. Kawash
		3.00
		Enrolled

	Comes output:

		[
			{
				classInfo: {
					type: "Lecture",
					number: "01",
					id: "12973",
					shortName: "CPSC 359",
					name: "Computing Machinery II"
				},
				meetingInfo: {
					days: ["Tu", "Th"],
					start: "15:30",
					end: "16:45",
					room: "ST 145"
				},
				prof: "J. Kawash"
			}
		]
*/
function parseClasses() {
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
				classes[current].meetingInfo.days = res[0].match(/[A-Z][a-z]/g);
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
		console.log(classes);
		lineReader.close();
	});
}

parseClasses();