/**
 * Created by fnokeke on 11/7/15.
 */


//graph data
//break


// Parse local CSV file
$(document).ready(function () {
  Papa.parse('dataset/location.csv', {
    download: true,
    header: true,
    complete: processingCharts
  });
});


function processingCharts(results) {
  console.time('load');

  var data = results.data;
//data = _.sample(data, 500); // get few data for test purposes TODO: remove

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    row['datetime'] = new Date(row['datetime']);
    row['latitude'] = parseFloat(row['latitude']);
    row['longitude'] = parseFloat(row['longitude']);
    row['accuracy'] = parseInt(row['accuracy']);
  }

//
// re-arrange data in ascending order to be used later
//
  data = _.sortBy(data, 'datetime');
  //console.log("data ", data);

//
// ignore locations with accuracy over 1000m
//

  data = data.filter(function (row) {
    return row.accuracy <= 1000;
  });
  //console.log("data(accuracy < 1000m): ", data.length);

  var CITY = [42.446594, -76.493736];
  var latMargin = 0.1;
  var longMargin = 1.0;

//
// ignore all locations outside CITY
//

  data = data.filter(function (row) {
    return (Math.abs(row.latitude - CITY[0] <= latMargin) &&
    Math.abs(row.longitude - CITY[1] <= longMargin));
  });
  //console.log("only places in city: ", data.length);

//
// add column to show if location is home, work, other
//

  var HOME = [42.446594, -76.493736];
  var WORK = [42.444877, -76.480814];

  latMargin = 0.0005;
  longMargin = 0.005;

  for (var i = 0; i < data.length; i++) {
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
  for (var i = 0; i < data.length; i++) {
    var row = data[i],
      date = row.datetime,
      dayNum = date.getDay();

    row['day'] = dayNum;
    row['weekday'] = WEEKDAY[dayNum];
    row['date'] = extractDate(date);
    row['time'] = extractTime(date);
  }
  console.timeEnd('load');

//
//
// =========GRAPH PLOTS ===========
//
//
  console.time('plots');
  var homeLoc = [];
  var workLoc = [];
  var otherLoc = [];

  for (var i = 0; i < data.length; i++) {
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
//  console.log("homeLoc:", homeLoc);
//  console.log("workLoc:", workLoc);
//  console.log("otherLoc:", otherLoc);
//
//  console.log("Data processing donee=========");
//
////
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
  //console.log("first plot processing donee=========");

// groupBy date counts
  var countDate = _.countBy(data, function (obj) {
    return obj.weekday;
  });


//
// where are you by time of weekday
//

  var grpCount = _.groupBy(data, function (obj) {
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
  for (var i = 0; i < 25; i++) {
    if (i == 0 || i == 24) {
      timeLabel.push("Midnight");
    }
    else if (i == 12) {
      timeLabel.push("Noon");
    }
    else if (i < 12) {
      timeLabel.push(i + "am");
    }
    else {
      timeLabel.push(i % 12 + "pm");
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
  //console.log("first plot processing donee=========");

//
// where are you by time of given DATES
//

  var grpCount = _.groupBy(data, function (obj) {
    return obj.locationLabel;
  });

  var homeGrp = grpCount['home'];
  var workGrp = grpCount['work'];
  var otherGrp = grpCount['other'];

  homeGrp = _.map(homeGrp, function (obj) {
    return [obj.datetime, obj.time];
  });
  workGrp = _.map(workGrp, function (obj) {
    return [obj.datetime, obj.time];
  });
  otherGrp = _.map(otherGrp, function (obj) {
    return [obj.datetime, obj.time];
  });

  $('#dateTimeChart').highcharts({
    chart: {
      type: 'scatter',
      zoomType: 'x'
    },
    title: {
      text: 'Where are you by time of date?'
    },
    subtitle: {
      text: document.ontouchstart === undefined ?
        'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
    },
    xAxis: {
      type: 'datetime',
      tickInterval: 1 * 24 * 36e5, // 24 * 36e5 === 1 day
      labels: {
        format: '{value: %a %d %b %Y}',
        //align: 'right',
        // rotation: -30
      },
      title: {
        text: 'date',
      },
      min: Date.UTC(2013, 7, 2),
    },
    yAxis: {
      title: {
        text: 'time of day'
      },
      min: 0,
      tickInterval: 6,
      categories: timeLabel,
    },
    series: [{
      name: 'Home',
      color: '    rgba(83, 223, 83, .5)',
      data: homeGrp,
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
// time left home and time returned home
//
  var groupedDate = _.groupBy(data, 'date');
//groupedDate = _.each(groupedDate, function(obj) {
//  obj.leftHome = -1;
//  obj.returnedHome = -1;
//});
//  console.log("groupedDate:\n", groupedDate);

  var count = 0;
  for (var key in groupedDate) {
    var locArray = groupedDate[key],
      timeArray = _.map(locArray, 'datetime'),
      labelArray = _.map(locArray, 'locationLabel');

    if (locArray.length == 0) // no location data
      locArray.leftHome = -1;
    else if (_.uniq(labelArray).indexOf('home') === -1) //no home label recorded
      locArray.leftHome = -2;
    else if (_.uniq(labelArray).length < 2) //maybe stayed in one location all day
      locArray.leftHome = -3;
    else {
      var firstIndex = locArray.indexOf('home'),
        workIndex = locArray.indexOf('work', firstIndex),
        otherIndex = locArray.indexOf('other', firstIndex);

      var LARGE = 999999;
      workIndex = workIndex === -1 ? LARGE : workIndex;
      otherIndex = otherIndex === -1 ? LARGE : workIndex;

      var leftHomeIndex = Math.min(workIndex, otherIndex);
      key.leftHome = timeArray[leftHomeIndex];


    }

    //console.log(timeArray);
    //console.log(labelArray);
    //

    count++;
    if (count === 20) break;
  }

//
// ====== UTILITY FUNCTIONS =========
//


  //console.log("finally waiting for document ready plot processing donee=========");

  console.timeEnd('plots');
}

function extractDate(d) {
  return ("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    d.getFullYear();
}

function extractTime(d) {
  return (d.getHours() + d.getMinutes() / 60.0);
}
