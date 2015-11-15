/**
 * Created by fnokeke on 11/7/15.
 */

//===================================
//===================================
//====== DATA FILTERING =============
//===================================
//===================================

$(document).ready(function () {
  console.time('loaddata'); //TODO: remove

  $.getJSON('dataset/LocationHistory.json', function (data) {
    processingCharts(data);
  });
});

function processingCharts(data) {
  console.timeEnd('loaddata'); //TODO: remove
  console.time('processingCharts'); //TODO: remove

  data = data.locations;

  // get few data for test purposes @TODO: remove
  //data = _.sample(data, 1000);

  // convert columns to expected format and add other new columns
  data.forEach(function (row) {
    var timestamp = parseInt(row.timestampMs),
      rowDate = new Date(timestamp);

    row.latitudeE7 = row.latitudeE7 / 10e6;
    row.longitudeE7 = row.longitudeE7 / 10e6;
    row.timestampMs = timestamp;

    row.fullDate = rowDate;
    row.day = rowDate.getDay();
    row.date = extractDate(rowDate);
    row.time = extractTime(rowDate);
  });

  // sorted entire time once otherwise have to sort each value from groupby date keys
  // sorting is needed for HighStock plots
  data = _.sortBy(data, 'timestampMs');

  // ignore locations with accuracy over 1000m
  // ignore all locations outside CITY
  var CITY = [42.446594, -76.493736],
    cityLatMargin = 0.1,
    cityLonMargin = 1.0;

  data = data.filter(function (row) {
    return row.accuracy <= 1000 &&
      Math.abs(row.latitudeE7 - CITY[0] <= cityLatMargin) &&
      Math.abs(row.longitudeE7 - CITY[1] <= cityLonMargin)
  });

  // determine if location falls into either of home, work, other
  var HOME = [42.446594, -76.493736],
    WORK = [42.444877, -76.480814],
    latMargin = 0.0005,
    lonMargin = 0.005;

  data.forEach(function (row) {
    if (Math.abs(row.latitudeE7 - HOME[0] < latMargin) &&
      Math.abs(row.longitudeE7 - HOME[1] < lonMargin)) {
      row.locationLabel = 'home';
    } else if (Math.abs(row.latitudeE7 - WORK[0] < latMargin) &&
      Math.abs(row.longitudeE7 - WORK[1] < lonMargin)) {
      row.locationLabel = 'work';
    } else {
      row.locationLabel = 'other';
    }
  });

  console.timeEnd('processingCharts');

  // ===============
  // HighStock bar chart for number of hours spent per location
  // ===============

  var groupedData = _.groupBy(data, 'date'),
      date,
      arrayOfLocationObjects,
      homeData = [],
      workData = [],
      timeSpentAtHome,
      timeSpentAtWork,
      allDwellTimes;


  for (var dateKey in groupedData) {
    date = new Date(dateKey).getTime();
    arrayOfLocationObjects = groupedData[dateKey];
    allDwellTimes = getAllDwellTime(arrayOfLocationObjects);
    timeSpentAtHome = Math.round(allDwellTimes[0]);
    timeSpentAtWork = Math.round(allDwellTimes[1]);
    homeData.push({'x':date, 'y':timeSpentAtHome});
    workData.push({'x':date, 'y':timeSpentAtWork});
  }

  // sorted time is needed for HighStock plots
  // HighStock automatically formats the datetime for you
  homeData = _.sortBy(homeData, 'x');
  workData = _.sortBy(workData, 'x');

  // time chart creation
  var start = +new Date();
  // create first stockChart
  $('#timeSpentBar').highcharts('StockChart', {
    chart: {
      alignTicks: false,
      events: {
        load: function () {
          if (!window.isComparing) {
            this.setTitle(null, {
              text: 'Built chart in ' + (new Date() - start) + 'ms'
            });
          }
        }
      },
      zoomType: 'x'
    },
    rangeSelector: {
      buttons: [{
        type: 'week',
        count: 1,
        text: '1w'
      }, {
        type: 'month',
        count: 1,
        text: '1m'
      }, {
        type: 'month',
        count: 3,
        text: '3m'
      }, {
        type: 'month',
        count: 6,
        text: '6m'
      }, {
        type: 'year',
        count: 1,
        text: '1y'
      }, {
        type: 'all',
        text: 'All'
      }],
      selected: 1
    },
    yAxis: {
      title: {
        text: 'hours'
      }
    },
    title: {
      text: "Avg Time (hours) at Location"
    },
    plotOptions: {
      column: {
        stacking: 'normal',
      }
    },
    series: [{
      name: 'Home',
      type: 'column',
      name: "Home",
      data: homeData,
      dataGrouping: {
        approximation: "average",
      }
    }, {
      name: 'Work',
      type: 'column',
      name: "Work",
      data: workData,
      dataGrouping: {
        approximation: "average",
      }
    }
    ]
  });

  // ===============
  // time left home and time returned home
  //
  // dataformat [[date, timeLeft, timeReturned],
  //             [date, timeLeft, timeReturned]]
  // date must be in unix time format so that it is automatically formatted in plot
  // ===============

  var leftReturnedData = [],
      arrayOfLocationObjects,
      timestampLeft,
      timestampReturned,
      date;

  for (var dateKey in groupedData) {
    arrayOfLocationObjects = groupedData[dateKey];
    timestampLeft = getTimeLeftHome(arrayOfLocationObjects);
    if (timestampLeft >= 0)
      timestampReturned = getTimeReturnedHome(arrayOfLocationObjects);
    if (timestampLeft >= 0 && timestampReturned >= 0) {
      date = new Date(dateKey).getTime();
      timestampLeft = extractTime(timestampLeft);
      timestampReturned = extractTime(timestampReturned);
      leftReturnedData.push([date, timestampLeft, timestampReturned]);
    }
  }

  var TIMELABEL = [];
  for (var i = 0; i < 25; i++) {
    if (i == 0 || i == 24) {
      TIMELABEL.push("Midnight");
    }
    else if (i == 12) {
      TIMELABEL.push("Noon");
    }
    else if (i < 12) {
      TIMELABEL.push(i + "am");
    }
    else {
      TIMELABEL.push(i % 12 + "pm");
    }
  }

  // labels for specific dates on x-axis
  var THANKSGIVING2014 = 1417064400000,
      FALL2014BEGINS = 1408680000000;

  $('#leftReturnedAreaSpline').highcharts('StockChart', {
    chart: {
      type: 'arearange'
    },
    title: {
      text: 'Time left home and returned back'
    },
    yAxis: {
      title: {
        text: 'time of day'
      },
      min: 0,
      tickInterval: 2,
      categories: TIMELABEL,
    },
    rangeSelector: {
      selected: 2
    },
    tooltip: {
      valueSuffix: ':00 hours', //@TODO: find better ways to show hours
      valueDecimals: 0
    },
    series: [{
      name: 'Left-Returned',
      data: leftReturnedData
    }, {
      type: 'flags',
      name: 'Flags on axis',
      data: [{
        x: FALL2014BEGINS,
        title: 'Fall 2014 Begins'
      }, {
        x: THANKSGIVING2014,
        title: 'Thanksgiving 2014'
      }],
      shape: 'squarepin'
    }]
  });























//===================================
//===================================
//===== UTILITY FUNCTIONS ===========
//===================================
//===================================

function extractDate(d) {
  if (!(d instanceof Date))
    d = new Date(d);

  return ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + "-" +
    d.getFullYear();
}

function extractTime(d) {
  if (!(d instanceof Date))
    d = new Date(d);
  return roundToTwoDP(d.getHours() + d.getMinutes() / 60.0);
}

function roundToTwoDP(num) {
  return +(Math.round(num + "e+2")  + "e-2");
}

function getTimeLeftHome(arrayOfLocationObject) {
  var timeArray = _.map(arrayOfLocationObject, 'timestampMs'),
    labelArray = _.map(arrayOfLocationObject, 'locationLabel'),
    homeStatus = getHomeStatus(labelArray),
    leftHome = 0;

  if (homeStatus < 0) {
    leftHome = homeStatus;
  }
  else {
    var startIndex = labelArray.indexOf('home'),
      workIndex = labelArray.indexOf('work', startIndex),
      otherIndex = labelArray.indexOf('other', startIndex),
      LARGE = 999999;

    workIndex = workIndex === -1 ? LARGE : workIndex;
    otherIndex = otherIndex === -1 ? LARGE : workIndex;

    var leftHomeIndex = Math.min(workIndex, otherIndex);
    if (leftHomeIndex == LARGE) // no record of work or other
      leftHome = -4;
    else
      leftHome = timeArray[leftHomeIndex];
  }
  return leftHome;
}

function getTimeReturnedHome(locArray) {
  var timeArray = _.map(locArray, 'timestampMs'),
    labelArray = _.map(locArray, 'locationLabel'),
    homeStatus = getHomeStatus(labelArray),
    returnedHome = 0;

  if (homeStatus < 0) {
    returnedHome = homeStatus;
  }
  else {
    var startIndex = labelArray.lastIndexOf('home'),
      workIndex = labelArray.lastIndexOf('work', startIndex),
      otherIndex = labelArray.lastIndexOf('other', startIndex),
      SMALL = -999999;

    workIndex = workIndex === -1 ? SMALL : workIndex;
    otherIndex = otherIndex === -1 ? SMALL : workIndex;

    var returnedHomeIndex = Math.max(workIndex, otherIndex);
    if (returnedHomeIndex == SMALL)
      returnedHome = -4;
    else
      returnedHome = timeArray[returnedHomeIndex];
  }
  return returnedHome;
}

function getHomeStatus(labelArray) {
  var status = 0;
  if (labelArray.length == 0) // no location data
    status = -1;
  else if (_.uniq(labelArray).indexOf('home') === -1) //no home label recorded
    status = -2;
  else if (_.uniq(labelArray).length === 1) //maybe stayed in one location all day
    status = -3;
  return status;
}

function getAllDwellTime(arrayOfLocObjects) {
  var homeDwell = 0,
    workDwell = 0,
    otherDwell = 0,
    homeLastTimestamp = -1,
    workLastTimestamp = -1,
    otherLastTimestamp = -1,
    CONVERTER = 1000 * 60 * 60;

  for (var i = 0; i < arrayOfLocObjects.length; i++) {
    var locationObject = arrayOfLocObjects[i],
      currentTimeStamp = locationObject.timestampMs;

    if (locationObject.locationLabel == 'home') {
      workLastTimestamp = -1;
      otherLastTimestamp = -1;

      if (homeLastTimestamp != -1) {
        homeDwell += currentTimeStamp - homeLastTimestamp
      }
      homeLastTimestamp = currentTimeStamp;
    }

    else if (locationObject.locationLabel == 'work') {
      homeLastTimestamp = -1;
      otherLastTimestamp = -1;

      if (workLastTimestamp != -1) {
        workDwell += currentTimeStamp - workLastTimestamp
      }
      workLastTimestamp = currentTimeStamp;
    }

    else if (locationObject.locationLabel == 'other') {
      homeLastTimestamp = -1;
      workLastTimestamp = -1;

      if (otherLastTimestamp != -1) {
        otherDwell += currentTimeStamp - otherLastTimestamp
      }
      otherLastTimestamp = currentTimeStamp;

    }
  }

  // original value is in milliseconds
  // seconds = milliseconds/1000
  homeDwell /= CONVERTER;
  workDwell /= CONVERTER;
  otherDwell /= CONVERTER;

  return [homeDwell, workDwell, otherDwell];
}

function getQuarterTime(mGroupedDate) {

  var homeArray = [],
    workArray = [],
    otherArray = [];

  for (var dateKey in mGroupedDate) {
    var arraylocObj = mGroupedDate[dateKey],
      arrayDate = new Date(dateKey).getTime(), //float value so Highcharts renders properly
      allDwellDuration = getAllDwellTime(arraylocObj);

    homeArray.push([arrayDate, allDwellDuration[0]]);
    workArray.push([arrayDate, allDwellDuration[1]]);
    otherArray.push([arrayDate, allDwellDuration[2]]);
  }

  var homeSum = 0;
  for (var i=0; i < homeArray.length; i++) {
    homeSum += homeArray[i][1];
  }

  var workSum = 0;
  for (var i=0; i < workArray.length; i++) {
    workSum += workArray[i][1];
  }

  var otherSum = 0;
  for (var i=0; i < otherArray.length; i++) {
    otherSum += otherArray[i][1];
  }

  homeSum = Math.round(homeSum);
  workSum = Math.round(workSum);
  otherSum = Math.round(otherSum);
  return [homeSum, workSum, otherSum]
}


/*


  $('#dayTimeChart').highcharts({
    chart: {
      type: 'scatter',
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


  // ===============
  // where are you by given dates
  // ===============

  var grpCount = _.groupBy(data, function (obj) {
    return obj.locationLabel;
  });

  var homeGrp = grpCount['home'];
  var workGrp = grpCount['work'];
  var otherGrp = grpCount['other'];

  homeGrp = _.map(homeGrp, function (obj) {
    return [obj.timestamp, obj.time];
  });
  workGrp = _.map(workGrp, function (obj) {
    return [obj.timestamp, obj.time];
  });
  otherGrp = _.map(otherGrp, function (obj) {
    return [obj.timestamp, obj.time];
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
      tickInterval: 60 * 24 * 36e5, // 24 * 36e5 === 1 day
      labels: {
        format: '{value: %a %d %b %Y}',
        //align: 'right',
        // rotation: -30
      },
      title: {
        text: 'date',
      },
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
      color: 'rgba(83, 223, 83, .5)',
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



  //@TODO: remember to consistently use single/double quotes throughout


  // ===============
  // time spent at home
  // ===============

    homeArray = [],
    workArray = [],
    otherArray = [];

  for (var dateKey in groupedDate) {
    var arraylocObj = groupedDate[dateKey],
      arrayDate = new Date(dateKey).getTime(), //float value so Highcharts renders properly
      allDwellDuration = getAllDwellTime(arraylocObj);

    homeArray.push([arrayDate, allDwellDuration[0]]);
    workArray.push([arrayDate, allDwellDuration[1]]);
    otherArray.push([arrayDate, allDwellDuration[2]]);
  }

  $('#timeSpentCharts').highcharts({
    chart: {
      type: 'column',
      zoomType: 'x'
    },
    title: {
      text: 'How much time do you spend at specific locations?'
    },
    subtitle: {
      text: document.ontouchstart === undefined ?
        'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
    },
    xAxis: {
      type: 'datetime',
      //tickInterval: 60 * 24 * 36e5, // 24 * 36e5 === 1 day
      labels: {
        format: '{value: %b %d,%Y}',
      },
      title: {
        text: 'date',
      },
    },
    yAxis: {
      title: {
        text: 'number of hours'
      },
      min: 0,
    },
    plotOptions: {
      column: {
        stacking: 'normal'
      }
    },
    series: [{
      name: 'Time at Home',
      color: 'rgba(0, 100, 0, .1)',
      data: homeArray,
    }, {
      name: 'Time at Work',
      color: 'rgba(223, 0, 0, .9)',
      data: workArray,
    }, {
      name: 'Time at Other Places',
      color: 'rgba(223, 223, 223, .5)',
      data: otherArray,
    }]
  });

  // ===============
  // total time spent at each location for first half and second half
  // ===============

  var part01GroupedDate = {},
      part02GroupedDate = {},
      part03GroupedDate = {},
      part04GroupedDate = {},
      interval = _.size(groupedDate) / 4,
      counter = 0;

  for (var key in groupedDate) {
    if (counter < interval)
      part01GroupedDate[key] = groupedDate[key];
    else if (counter < interval * 2)
      part02GroupedDate[key] = groupedDate[key];
    else if (counter < interval * 3)
      part03GroupedDate[key] = groupedDate[key];
    else
      part04GroupedDate[key] = groupedDate[key];
    counter++;
  }

  var p1 = getQuarterTime(part01GroupedDate),
      p2 = getQuarterTime(part02GroupedDate),
      p3 = getQuarterTime(part03GroupedDate),
      p4 = getQuarterTime(part04GroupedDate);

  $('#barTimeSpentCharts').highcharts({
    chart: {
      type: 'column',
      inverted: true
    },
    title: {
      text: 'Change in time by splitting location data into four (4) quarters'
    },
    subtitle: {
      text: '(Aug 2013 - Oct 2015)' //@TODO: remove hard coded date
    },
    xAxis: {
      title: {
        text: 'date',
      },
      categories: ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"]
    },
    yAxis: {
      title: {
        text: 'number of hours'
      },
      min: 0,
    },
    plotOptions: {
      column: {
        stacking: 'percent',
        dataLabels: {
          enabled: true,
          color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white',
          style: {
            textShadow: '0 0 3px black',
          }
        }
      }
    },
    series: [{
      name: 'Home',
      data: [p1[0], p2[0], p3[0], p4[0]],
    }, {
      name: 'Work',
      data: [p1[1], p2[1], p3[1], p4[1]],
    }, {
      name: 'Other',
      data: [p1[2], p2[2], p3[2], p4[2]],
    },
    ]
  });

  // ===============
  // HeatMap for total time spent at each location for first half and second half
  // ===============

  $(function () {
    $('#heatMapTimeSpent').highcharts({

    chart: {
      type: 'heatmap',
      marginTop: 40,
      marginBottom: 80,
      plotBorderWidth: 1
    },

    title: {
      text: 'No of hours spent'
    },

    xAxis: {
      categories: ['Home', 'Work']
    },

    yAxis: {
      categories: ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"],
      title: null
    },

    colorAxis: {
      min: 0,
      minColor: '#FFFFFF',
      maxColor: Highcharts.getOptions().colors[0]
    },

    legend: {
      align: 'right',
      layout: 'vertical',
      margin: 0,
      verticalAlign: 'top',
      y: 25,
      symbolHeight: 280
    },

    tooltip: {
      formatter: function () {
        return 'spent '+
          '<b>' + this.point.value + '</b> hours at <br>' +
          '<b>' + this.series.xAxis.categories[this.point.x] + '</b> during ' +
          '<b>' + this.series.yAxis.categories[this.point.y] + '</b>';
      }
    },
    series: [{
      name: 'Time per location',
      borderWidth: 1,
      data: [[0, 0, p1[0]], [0, 1, p2[0]], [0, 2, p3[0]], [0, 3, p4[0]],
             [1, 0, p1[1]], [1, 1, p2[1]], [1, 2, p3[1]], [1, 3, p4[1]]],
      dataLabels: {
        enabled: true,
        color: '#000000'
      }
    }]

  });
  });


  console.timeEnd('plots');
}


//===================================
//===================================
//===== CALENDAR ===========
//===================================
//===================================


$(document).ready(function() {

  $('#calendar').fullCalendar({
    header: {
      left: 'prev,next today',
      center: 'title',
      right: 'month,agendaWeek,agendaDay'
    },
    //defaultDate: '2014-11-12',
    editable: true,
    //eventLimit: true, // allow "more" link when too many events

    eventSources: [

      // your event source
      {
        events: [ // put the array in the `events` property
          {
            title  : 'Home',
            start  : '2015-11-01:8:00:00',
            end    : '2015-11-07'
          },
          {
            title  : 'Home',
            start  : '2015-11-08:8:00:00',
            end    : '2015-11-15'
          },
          {
            title  : 'Work',
            start  : '2015-11-10',
            end    : '2015-11-14'
          },
          {
            title  : 'Work',
            start  : '2015-11-15T12:45:00',
            end    : '2015-11-21'
          },
          {
            title  : 'Work',
            start  : '2015-11-22T14:45:00',
            end    : '2015-11-28'
          }
        ],
        color: 'black',     // an option!
        textColor: 'yellow' // an option!
      }

      // any other event sources...

    ]

  });

  $('#calendar').fullCalendar('option', 'height', 500);

});


 function showDefaultChart(chartDiv) {
 $(chartDiv).highcharts({
 chart: {
 zoomType: 'x'
 },
 title: {
 text: 'Where are you by time of day?'
 },
 subtitle: {
 text: document.ontouchstart === undefined ?
 'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
 },
 xAxis: {
 type: 'datetime'
 },
 yAxis: {
 title: {
 text: 'Exchange rate'
 }
 },
 legend: {
 enabled: false
 },
 plotOptions: {
 area: {
 fillColor: {
 linearGradient: {
 x1: 0,
 y1: 0,
 x2: 0,
 y2: 1
 },
 stops: [
 [0, Highcharts.getOptions().colors[0]],
 [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
 ]
 },
 marker: {
 radius: 2
 },
 lineWidth: 1,
 states: {
 hover: {
 lineWidth: 1
 }
 },
 threshold: null
 }
 },

 series: [{
 type: 'area',
 name: 'USD to EUR',
 data: []
 }]
 });
 }

  */


//var homeArray = [],
//    workArray = [],
//    otherArray = [];
//
//data.forEach(function (row) {
//  if (row.locationLabel === 'home')
//    homeArray.push([row.timestampMs, Math.round(row.time)]);
//  else if (row.locationLabel === 'work')
//    workArray.push([row.timestampMs, Math.round(row.time)]);
//  else if (row.locationLabel === 'other')
//    otherArray.push([row.timestampMs, Math.round(row.time)]);
//});

// var WEEKDAY = ["Sun", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat"];
//row.weekday = WEEKDAY[row.day];

}