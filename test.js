var time = "12:00AM"

var amIndex = time.indexOf("AM");
var colonIndex = time.indexOf(":");
var hour = Number(time.substring(0, colonIndex));
if(amIndex != -1) {
	time = time.substring(0, amIndex);
	if(hour == 12) hour = 0;
	time = hour + ":" + time.substring(colonIndex + 1);
} else {
	var pmIndex = time.indexOf("PM");
	time = time.substring(0, pmIndex);
	if(hour != 12) hour = hour + 12;
	time = hour + ":" + time.substring(colonIndex + 1);
}

console.log(time);