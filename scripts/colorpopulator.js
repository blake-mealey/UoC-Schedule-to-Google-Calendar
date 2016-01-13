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

var block = "<li id='temp'>" + 
				"<label>" +
					"<input type='radio'>" +
					"<div></div>" +
				"</label>" +
			"</li>"

var count = 0;

jQuery(document).ready(function($) {
	$(".colorContainer").each(function(index) {
		var id = $(this).attr('id');
		count++;
		for(var key in colors[id]) {
			console.log(id);
			if(!colors[id].hasOwnProperty(key)) continue;
			$(this).append(block);
			var newBlock = $(this).find("#temp");
			newBlock.attr("id", "");
			var input = newBlock.find("input");
			input.attr("name", "coloroption" + count);
			input.attr("value", key);
			newBlock.find("div").css("background-color", colors[id][key]);
		}
	});
});