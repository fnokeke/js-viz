/**
 * Created by fnokeke on 11/7/15.
 */

$.get('dataset/location_shorter.csv', function(csv) {
	var data = $.csv.toObjects(csv);
	console.log("data length: ", data.length);

	for (var i=0; i<data.length; i++) {
		var row = data[i];
		row['datetime'] = new Date(row['datetime']);
		row['latitude'] = parseFloat(row['latitude']);
		row['longitude'] = parseFloat(row['longitude']);
		row['accuracy'] = parseInt(row['accuracy']);
	}

	//
	// ignore locations with accuracy over 1000m
	//
	data = data.filter(function(row) {
		return row.accuracy <= 1000;
	});
	console.log("filtered data length: ", data.length);

	var CITY = [42.446594, -76.493736];
	var latMargin = 0.1;
	var longMargin = 1.0;

	//
	// ignore all locations outside CITY
	//
	data = data.filter(function(row) {
		return (Math.abs(row.latitude - CITY[0] <= latMargin) &&
				Math.abs(row.longitude - CITY[1] <= longMargin));
	});
	console.log("only places in city: ", data.length);

	//
	// split city data into home, work, other
	//
	var HOME = [42.446594, -76.493736];
	var WORK = [42.444877, -76.480814];

	latMargin = 0.0005;
	longMargin = 0.005;

	var homeLoc = [];
	var workLoc = [];
	var otherLoc = [];

	for (var i=0; i<data.length; i++) {
		var row = data[i];

		if (Math.abs(row.latitude - HOME[0] < latMargin) &&
				Math.abs(row.longitude - HOME[1] < longMargin)) {
			homeLoc.push([row.latitude, row.longitude]);
		}
		else if (Math.abs(row.latitude - WORK[0] < latMargin) &&
				Math.abs(row.longitude - WORK[1] < longMargin)) {
			workLoc.push([row.latitude, row.longitude]);
		}
		else {
			otherLoc.push([row.latitude, row.longitude]);
		}
	}

	console.log("homeLoc:", homeLoc.length);
	console.log("workLoc:", workLoc.length);
	console.log("otherLoc:", otherLoc.length);

	//
	// combined plot for home, work, other
	//
	$('#latLongChart').highcharts({
		chart: {
			type: 'scatter'
		},
		title: {
			text: 'Cluster of Three(3) locations'
		},
		xAxis: {
			title: {
				text: 'Latitude'
			}
		},
		yAxis: {
			title: {
				text: 'Longitude'
			}
		},
		series: [{
			name: 'Home',
			color: 'rgba(83, 223, 83, .5)',
			data: homeLoc
		}, {
			name: 'Work',
			color: 'rgba(223, 83, 83, .5)',
			data: workLoc
		}, {
			name: 'Other',
			color: 'rgba(83, 83, 223, .5)',
			data: otherLoc
		}]
	});

});


$(function () {
	$('#container').highcharts({
		chart: {
			type: 'bar'
		},
		title: {
			text: 'Fruit Consumption'
		},
		xAxis: {
			categories: ['Apples', 'Bananas', 'Oranges']
		},
		yAxis: {
			title: {
				text: 'Fruit eaten'
			}
		},
		series: [{
			name: 'Jane',
			data: [1, 0, 4]
		}, {
			name: 'John',
			data: [5, 7, 3]
		}]
	});
});

$(function () {
	window.chart = new Highcharts.Chart({
		chart: {
			renderTo: 'graph',
			defaultSeriesType: 'bar'
		},
		xAxis: {
			categories: ['Total'],
			labels: {
				enabled: false
			}
		},
		plotOptions: {
			series: {
				allowPointSelect: true,
				stacking: 'normal'
			}
		},
		series: [{
			id: 'positive',
			name: 'Positive',
			data: [29.9],
			color: 'blue',
			stack: 'total',
			states: {
				select: {
					color: 'green'
				}
			}
		}, {
			id: 'negative',
			name: 'Negative',
			data: [-130.4],
			color: 'blue',
			stack: 'total',
			states: {
				select: {
					color: 'red'
				}
			}
		}]
	});



});
