window.onload = function() {
	$(".page-content > p").each(function(index) {
		if($(this).find("img").length && $(this).find("em").length) {
			$(this).css("text-align", "center");
			var img = $(this).find("img")
			img.wrap(function() {
				return "<a class=\"gallery-item\" href=\"" + img.attr("src") + "\"></a>";
			});
			/*img.parent().magnificPopup({
				type: "image",
				mainClass: "mfp-with-zoom",
				zoom: {
					enabled: true,
					duration: 300,
					easing: 'ease-in-out',
					opener: function(openerElement) {
						return openerElement.is('img') ? openerElement : openerElement.find('img');
					}
				},
				gallery: {
					enabled: true,
					navigateByImgClick: true,
					arrowMarkup: '<button title="%title%" type="button" class="mfp-arrow mfp-arrow-%dir%"></button>',
					tPrev: 'Previous (Left arrow key)', // title for left button
					tNext: 'Next (Right arrow key)', // title for right button
					tCounter: '<span class="mfp-counter">%curr% of %total%</span>'
				}
			});*/
		}
	});

	$(".page-content").each(function(index) {
		$(this).find(".gallery-item").magnificPopup({
			type: "image",
			mainClass: "mfp-with-zoom",
			zoom: {
				enabled: true,
				duration: 300,
				easing: 'ease-in-out',
				opener: function(openerElement) {
					return openerElement.is('img') ? openerElement : openerElement.find('img');
				}
			},
			gallery: {
				enabled: true,
				navigateByImgClick: true,
			},
			/*image: {
				titleSrc: function(item) {
					return "hello";
				}
			}*/
		});
	});
}