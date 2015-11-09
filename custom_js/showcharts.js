/**
 * Created by fnokeke on 11/7/15.
 */

$.get('dataset/location.csv', function(csv) {
	var data = $.csv.toObjects(csv);
    data = _.sample(data, 1000); // get few data for test purposes TODO: remove
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
	// add column to show if location is home, work, other
	//
	var HOME = [42.446594, -76.493736];
	var WORK = [42.444877, -76.480814];

	latMargin = 0.0005;
	longMargin = 0.005;

    for (var i=0; i<data.length; i++) {
        var row = data[i];

        if (Math.abs(row.latitude - HOME[0] < latMargin) &&
            Math.abs(row.longitude - HOME[1] < longMargin)) {
            row['locationLabel'] = 'home';
        } else if (Math.abs(row.latitude - WORK[0] < latMargin) &&
            Math.abs(row.longitude - WORK[1] < longMargin)) {
            row['locationLabel'] = 'work';
        } else {
            row['locationLabel'] = 'other';
        }
    }

    //
    // Add other relevant columns
    // day column: 0 is Sunday, 1 is Monday, etc
    //
    var WEEKDAY = ["Sun", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat"];
    for (var i=0; i < data.length; i++) {
        var row = data[i];
        var date = row.datetime;
        var dayNum = date.getDay();
        row['day'] = dayNum;
        row['weekday'] = WEEKDAY[dayNum];
        row['date'] = extractDate(date);
        row['time'] = extractTime(date);
    }
    console.log("weekday data ", data);

    //
    //
    // =========GRAPH PLOTS ===========
    //
    //
	var homeLoc = [];
	var workLoc = [];
	var otherLoc = [];

	for (var i=0; i<data.length; i++) {
		var row = data[i];

        if (row.locationLabel == 'home') {
            homeLoc.push([row.latitude, row.longitude]);
        }
        else if (row.locationLabel == 'work') {
            workLoc.push([row.latitude, row.longitude]);
        }
        else if (row.locationLabel == 'other') {
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

    // groupBy date counts
    var countDate = _.countBy(data, function(obj) {
        return obj.weekday;
    });


    //
    // where are you by time of weekday
    //
    var grpCount = _.groupBy(data, function(obj){
        return obj.locationLabel;
    });

    var homeGrp = grpCount['home'];
    var workGrp = grpCount['work'];
    var otherGrp = grpCount['other'];

    homeGrp = _.map(homeGrp, function (obj) {
        return [obj.day, obj.time];
    });
    workGrp = _.map(workGrp, function (obj) {
        return [obj.day, obj.time];
    });
    otherGrp = _.map(otherGrp, function (obj) {
        return [obj.day, obj.time];
    });

    var timeLabel = [];
    for (var i=0; i<25; i++) {
        if (i==0 || i == 24) {
            timeLabel.push("Midnight");
        }
        else if (i == 12) {
            timeLabel.push("Noon");
        }
        else if (i < 12) {
            timeLabel.push(i+"am");
        }
        else {
            timeLabel.push(i%12 + "pm");
        }
    }

    $('#dayTimeChart').highcharts({
        chart: {
            type: 'scatter'
        },
        title: {
            text: 'Where are you by time of weekday?'
        },
        xAxis: {
            title: {
                text: 'Weekday',
            },
            categories: ["Sun", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat"],
        },
        yAxis: {
            title: {
                text: 'Time'
            },
            categories: timeLabel,
        },
        series: [{
            name: 'Home',
            color: 'rgba(83, 223, 83, .5)',
            data: homeGrp
        }, {
            name: 'Work',
            color: 'rgba(223, 83, 83, .5)',
            data: workGrp
        }, {
            name: 'Other',
            color: 'rgba(83, 83, 223, .5)',
            data: otherGrp
        }]
    });

    //
    // utility functions
    //
    function extractDate(d) {
        return ("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
            d.getFullYear();
    }

    function extractTime(d) {
        return (d.getHours() + d.getMinutes()/60.0);
    }

    function extractTimeStr(d) {
        return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    }

    function getColumn(data, colName) {
        var colArray = [];
        for (var i = 0; i < data.length; i++) {
            colArray.push(data[i][colName]);
        }
        return colArray;
    }

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