var username;

$(document).ready(function () {
	$('.available').hide();
	$('.unavailable').hide();

	username = $('#username').text();
	console.log(username);

	var servicesList = $('.loading');
	$.each(servicesList, function(service) {
		fetchAvailability(servicesList[service].id);
	});
});

function fetchAvailability(service) {
	$.get( "/available/" + service + "/" + username, function(res) {
		console.log(res);
		$('#' + res.service + ' .loading-spinner').fadeOut(function() {
			if(res.available)
				$('#' + res.service + ' .available').fadeIn();
			else
				$('#' + res.service + ' .unavailable').fadeIn();
		});
	});
}