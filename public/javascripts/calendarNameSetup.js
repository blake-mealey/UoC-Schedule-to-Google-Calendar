var year = new Date().getFullYear();
var defaultName = year + " Course Schedule";

var seasons = ["Fall", "Winter", "Spring", "Summer"];
function canChange(current) {
	if(current == defaultName) return true;
	for (var i = 0; i < seasons.length; i++) {
		if(current == year + " " + seasons[i] + " Schedule") return true;
	};
	return false;
}

$(document).ready(function() {
	$("#inputName").attr("value", defaultName);
	$("#selectSemester").change(function() {
		var current = $("#inputName").attr("value");
		if(canChange(current)) {
			var selected = $("#selectSemester :selected").text();
			if(selected == "Select One") {
				$("#inputName").attr("value", defaultName);
			} else {
				$("#inputName").attr("value", year + " " + selected + " Schedule");
			}
		}
	});
});