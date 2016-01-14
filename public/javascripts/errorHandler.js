var errorVisible = false;

function throwError(text, timeout) {
	if(errorVisible) return;
	errorVisible = true;
	$("#error").text(text).css("opacity", 1);
	window.setTimeout(hideError, timeout != null ? timeout : 3000);
}

function hideError() {
	if(!errorVisible) return;
	errorVisible = false;
	$("#error").css("opacity", 0);
}

$(document).ready(function() {
	$("#buttonSubmit").click(function(e) {
		e.preventDefault();

		var regex = /^\s*$/;
		if(regex.test($("#textAreaCourseData").val())) {
			throwError("The course data is empty.");
			return;
		} if(regex.test($("#inputName").val())) {
			throwError("The calendar name is empty.");
			return;
		} if($("#selectSemester :selected").text() == "Select One") {
			throwError("You have not selected a semester.");
			return;
		}

		hideError();
		$("#formMakeCalendar").submit();
	});
});