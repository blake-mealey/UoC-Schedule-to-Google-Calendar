/*****************************************************************************************************************
******************************************** COLOR SELECTOR GENERATION *******************************************
*****************************************************************************************************************/

var colors = {
	calendar: {
		"1": "#ac725e",
		"2": "#d06b64",
		"3": "#f83a22",
		"4": "#fa573c",
		"5": "#ff7537",
		"6": "#ffad46",
		"7": "#42d692",
		"8": "#16a765",
		"9": "#7bd148",
		"10": "#b3dc6c",
		"11": "#fbe983",
		"12": "#fad165",
		"13": "#92e1c0",
		"14": "#9fe1e7",
		"15": "#9fc6e7",
		"16": "#4986e7",
		"17": "#9a9cff",
		"18": "#b99aff",
		"19": "#c2c2c2",
		"20": "#cabdbf",
		"21": "#cca6ac",
		"22": "#f691b2",
		"23": "#cd74e6",
		"24": "#a47ae2"
	},
	event: {
		"1": "#a4bdfc",
		"2": "#7ae7bf",
		"3": "#dbadff",
		"4": "#ff887c",
		"5": "#fbd75b",
		"6": "#ffb878",
		"7": "#46d6db",
		"8": "#e1e1e1",
		"9": "#5484ed",
		"10": "#51b749",
		"11": "#dc2127"
	}
}

var defaults = [7, 1, 2];

var block = "<li id='temp'>" + 
				"<label>" +
					"<input type='radio'>" +
					"<div></div>" +
				"</label>" +
			"</li>"

var count = 0;

function initializeColors() {
	$(".colorContainer").each(function(index) {
		var id = $(this).attr('id');
		count++;
		for(var key in colors[id]) {
			if(!colors[id].hasOwnProperty(key)) continue;
			$(this).append(block);
			var newBlock = $(this).find("#temp");
			newBlock.attr("id", "");
			var input = newBlock.find("input");
			input.attr("name", "coloroption" + count);
			input.attr("value", key);
			if(key == defaults[count - 1].toString()) input.prop("checked", true);
			newBlock.find("div").css("background-color", colors[id][key]);
		}
	});
}

/*****************************************************************************************************************
********************************************** CALENDAR NAME SETUP ***********************************************
*****************************************************************************************************************/

var year = new Date().getFullYear();
var defaultName = year + " Course Schedule";

var seasons = ["Fall", "Winter", "Spring", "Summer"];
function canChange(current) {
	if(current == null) return true;
	for (var i = 0; i < seasons.length; i++) {
		if(current == year + " " + seasons[i] + " Schedule") return true;
	};
	return false;
}

function initializeCalendarName() {
	$("#inputName").attr("placeholder", defaultName);
	$("#selectSemester").change(function() {
		var current = $("#inputName").attr("value");
		if(canChange(current)) {
			$("#inputName").attr("value", year + " " + $("#selectSemester :selected").text() + " Schedule");
		}
	});
}

/*****************************************************************************************************************
************************************************** ERROR HANDLER *************************************************
*****************************************************************************************************************/

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

function initializeErrorHandler() {
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
}

/*****************************************************************************************************************
************************************************ TEXT AREA RESIZER ***********************************************
*****************************************************************************************************************/

function setTextAreaSize() {
	console.log('resize');
	$("#textAreaCourseData").css("min-height", $("#right").outerHeight() - 52);
}

function initializeTextAreaResizer() {
	setTextAreaSize();
	$(window).resize(setTextAreaSize);
}

/*****************************************************************************************************************
************************************************ APP INITIALIZATION **********************************************
*****************************************************************************************************************/

$(document).ready(function() {
	initializeColors();
	initializeCalendarName();
	initializeTextAreaResizer();
	initializeErrorHandler();
});