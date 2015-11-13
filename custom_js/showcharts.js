/**
 * Created by fnokeke on 11/7/15.
 */

//===================================
//===================================
//====== DATA FILTERING =============
//===================================
//===================================

// Papa parse is super fast in loading data
console.time('papaparse'); //TODO: remove

$(document).ready(function () {
  Papa.parse('dataset/location.csv', {
    download: true,
    header: true,
    complete: processingCharts
  });
});

console.timeEnd('papaparse'); //TODO: remove

function processingCharts(results) {

  console.time('load'); //TODO: remove

  var data = results.data;
  data = _.sample(data, 1400); // get few data for test purposes @TODO: remove

  var WEEKDAY = ["Sun", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat"];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    row['timestamp'] = parseFloat(row['timestamp']);
    row['datetime'] = new Date(row['datetime']);
    row['latitude'] = parseFloat(row['latitude']);
    row['longitude'] = parseFloat(row['longitude']);
    row['accuracy'] = parseInt(row['accuracy']);

    var rowDate = row.datetime,
        dayNum = rowDate.getDay();

    row['day'] = dayNum;
    row['weekday'] = WEEKDAY[dayNum];
    row['date'] = extractDate(rowDate);
    row['time'] = extractTime(rowDate);
  }

  // re-arrange data in ascending order to be used later
  data = _.sortBy(data, 'datetime');

  // ignore locations with accuracy over 1000m
  data = data.filter(function (row) {
    return row.accuracy <= 1000;
  });

  var CITY = [42.446594, -76.493736];
  var latMargin = 0.1;
  var longMargin = 1.0;

  // ignore all locations outside CITY
  data = data.filter(function (row) {
    return (Math.abs(row.latitude - CITY[0] <= latMargin) &&
    Math.abs(row.longitude - CITY[1] <= longMargin));
  });

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

  console.timeEnd('load');

  //===================================
  //===================================
  //======GRAPH PLOTS ================
  //===================================
  //===================================

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

  // ===============
  // cluster of locations for home, work, other
  // ===============

  $('#latLongChart').highcharts({
    chart: {
      type: 'scatter',
      zoomType: 'x'

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

  // ===============
  // where are you by weekday
  // ===============

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


  // ===============
  // time left home and time returned home
  // ===============
  var groupedDate = _.groupBy(data, 'date');

  var dwellHome = {};
  for (var key in groupedDate) {
    var locArray = groupedDate[key];
    dwellHome[key] = [
      getTimeLeftHome(locArray),
      getTimeReturnedHome(locArray)
    ];
  }

  // drop all dwell time values that have any error/negative numbers
  var plotDwellHome = {};
  for (key in dwellHome) {
    var arrayValue = dwellHome[key];
    if (_.min(arrayValue) > 0) {
      plotDwellHome[key] = arrayValue;
    }
  }

  var leftHomeArray = [],
    returnedHomeArray = [];

  for (key in plotDwellHome) {
    var arrayValue = plotDwellHome[key],
      leftDatetime = arrayValue[0],
      returnedDatetime = arrayValue[1];

    leftHomeArray.push([leftDatetime, extractTime(leftDatetime)]);
    returnedHomeArray.push([returnedDatetime, extractTime(returnedDatetime)]);
  }

  $('#leftReturnedChart').highcharts({
    chart: {
      type: 'line',
      //inverted: true,
      zoomType: 'xy'
    },
    title: {
      text: 'When do you leave home and when do you get back?'
    },
    subtitle: {
      text: document.ontouchstart === undefined ?
        'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
    },
    xAxis: {
      type: 'datetime',
      //tickInterval: 1 * 24 * 36e5, // 24 * 36e5 === 1 day
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
      name: 'Left Home',
      //color: 'rgba(0, 0, 0, .5)',
      data: leftHomeArray,
    }, {
      name: 'Returned Home',
      //color: 'rgba(223, 83, 83, .5)',
      data: returnedHomeArray
    }]
  });

  //@TODO: remember to consistently use single/double quotes throughout


  // ===============
  // time spent at home
  // ===============

  var homeDwellArray = [],
    workDwellArray = [],
    otherDwellArray = [];

  for (var dateKey in groupedDate) {
    var arraylocObj = groupedDate[dateKey],
      arrayDate = new Date(dateKey).getTime(), //float value so Highcharts renders properly
      allDwellDuration = getAllDwellTime(arraylocObj);

    homeDwellArray.push([arrayDate, allDwellDuration[0]]);
    workDwellArray.push([arrayDate, allDwellDuration[1]]);
    otherDwellArray.push([arrayDate, allDwellDuration[2]]);
  }

  $('#timeSpentCharts').highcharts({
    chart: {
      type: 'area',
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
      data: homeDwellArray,
    }, {
      name: 'Time at Work',
      color: 'rgba(223, 0, 0, .9)',
      data: workDwellArray,
    }, {
      name: 'Time at Other Places',
      color: 'rgba(223, 223, 223, .5)',
      data: otherDwellArray,
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

  var allPieTimeArray = getPieTime(part01GroupedDate),
      homeTotal = allPieTimeArray[0],
      workTotal = allPieTimeArray[1],
      otherTotal = allPieTimeArray[2];


  $(function () {
  $('#part01Pie').highcharts({
    chart: {
      type: 'pie',
      options3d: {
        enabled: true,
        alpha: 45,
        beta: 0
      }
    },
    title: {
      text: 'First 1/4 of Total Time'
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        depth: 35,
        dataLabels: {
          enabled: true,
          format: '{point.name}'
        }
      }
    },
    series: [{
      name: "Locations",
      data: [
        {name: "Home", y: homeTotal},
        {name: "Work", y: workTotal},
        {name: "Other", y: otherTotal}
      ]
    }]
  });
  });

  allPieTimeArray = getPieTime(part02GroupedDate),
    homeTotal = allPieTimeArray[0],
    workTotal = allPieTimeArray[1],
    otherTotal = allPieTimeArray[2];

  $(function () {
    $('#part02Pie').highcharts({
      chart: {
        type: 'pie',
        options3d: {
          enabled: true,
          alpha: 45,
          beta: 0
        }
      },
      title: {
        text: 'Second 1/4 of Total Time'
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          depth: 35,
          dataLabels: {
            enabled: true,
            format: '{point.name}'
          }
        }
      },
      series: [{
        name: "Locations",
        data: [
          {name: "Home", y: homeTotal},
          {name: "Work", y: workTotal},
          {name: "Other", y: otherTotal}
        ]
      }]
    });
  });

  allPieTimeArray = getPieTime(part03GroupedDate),
    homeTotal = allPieTimeArray[0],
    workTotal = allPieTimeArray[1],
    otherTotal = allPieTimeArray[2];

  $(function () {
    $('#part03Pie').highcharts({
      chart: {
        type: 'pie',
        options3d: {
          enabled: true,
          alpha: 45,
          beta: 0
        }
      },
      title: {
        text: 'Third 1/4 of Total Time'
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          depth: 35,
          dataLabels: {
            enabled: true,
            format: '{point.name}'
          }
        }
      },
      series: [{
        name: "Locations",
        data: [
          {name: "Home", y: homeTotal},
          {name: "Work", y: workTotal},
          {name: "Other", y: otherTotal}
        ]
      }]
    });
  });

  allPieTimeArray = getPieTime(part04GroupedDate),
    homeTotal = allPieTimeArray[0],
    workTotal = allPieTimeArray[1],
    otherTotal = allPieTimeArray[2];

  $(function () {
    $('#part04Pie').highcharts({
      chart: {
        type: 'pie',
        options3d: {
          enabled: true,
          alpha: 45,
          beta: 0
        }
      },
      title: {
        text: 'Fourth 1/4 of Total Time'
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          depth: 35,
          dataLabels: {
            enabled: true,
            format: '{point.name}'
          }
        }
      },
      series: [{
        name: "Locations",
        data: [
          {name: "Home", y: homeTotal},
          {name: "Work", y: workTotal},
          {name: "Other", y: otherTotal}
        ]
      }]
    });
  });

  var p1 = getPieTime(part01GroupedDate),
      p2 = getPieTime(part02GroupedDate),
      p3 = getPieTime(part03GroupedDate),
      p4 = getPieTime(part04GroupedDate);

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
        stacking: 'normal',
        dataLabels: {
          format: '{point.y:.1f}', // one decimal
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


  console.timeEnd('plots');
}


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
  return (d.getHours() + d.getMinutes() / 60.0);
}

function getTimeLeftHome(locArray) {
  var timeArray = _.map(locArray, 'timestamp'),
    labelArray = _.map(locArray, 'locationLabel'),
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
  var timeArray = _.map(locArray, 'timestamp'),
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
      currentTimeStamp = locationObject.timestamp;

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

function getPieTime(mGroupedDate) {

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

  return [homeSum, workSum, otherSum]
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
