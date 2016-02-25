/**
 * Created by fnokeke on 1/9/16.
 */

// minor tweak to make sure google calendar client actually runs
function startGCal() {
  gCal.run()
}

var

  gCal = {

    CLIENT_ID: '176049196616-koqftr6rrmlk91m5ssqdnbbe2cfdgsul.apps.googleusercontent.com',
    SCOPES: ["https://www.googleapis.com/auth/calendar"],

    run: function () {
      gCal.checkAuth();
    },

    /**
     * Check if current user has authorized this application.
     */
    checkAuth: function () {
      gapi.auth.authorize(
        {
          'client_id': gCal.CLIENT_ID,
          'scope': gCal.SCOPES.join(' '),
          'immediate': true
        }, gCal.handleAuthResult);
    },

    /**
     * Handle response from authorization server.
     *
     * @param {Object} authResult Authorization result.
     */
    handleAuthResult: function (authResult) {
      var authorizeDiv = document.getElementById('authorize-div');
      var authorizeSuccessfulDiv = document.getElementById('authorizeSuccessful-div');
      if (authResult && !authResult.error) {
        // Hide auth UI, then load client library.
        authorizeSuccessfulDiv.style.display = 'inline';
        authorizeDiv.style.display = 'none';
        gCal.loadCalendarApi();
      } else {
        authorizeSuccessfulDiv.style.display = 'none';
        authorizeDiv.style.display = 'inline';
      }
    },

    /**
     * Initiate auth flow in response to user clicking authorize button.
     *
     * @param {Event} event Button click event.
     */
    handleAuthClick: function (event) {
      gapi.auth.authorize(
        {client_id: gCal.CLIENT_ID, scope: gCal.SCOPES, immediate: false},
        gCal.handleAuthResult);
      return false;
    },

    /**
     * Load Google Calendar client library.
     */
    loadCalendarApi: function () {
      gapi.client.load('calendar', 'v3', function () {
        $('#status').text('Calendar authorization successful!');
        $('#status').css('color', 'green');
      });

    }
  },

  ui = {

    host: window.location.hostname === 'localhost' ?
      'http://localhost:63342/js-viz/' :
      'https://eaf.smalldata.io/partner/slm/',

    daysCount: 0,
    workCounter: 1,
    hobbyCounter: 1,

    goToAnchor: function (anchor) {
      var loc = document.location.toString().split('#')[0];
      document.location = loc + '#' + anchor;
      return false;
    },

    createTextInput: function (labelName, inputValue) {
      var counter = labelName === 'work' ? ui.workCounter++ : ui.hobbyCounter++;
      var inputName = labelName + 'Address' + counter;
      var removeButtonName = 'remove' + inputName;
      var inputDiv = inputName.replace(/\d+/g, '') + '-div';
      inputValue = inputValue || '';

      $('<input/>').attr(
        {
          type: 'text',
          name: inputName,
          id: inputName,
          value: inputValue,
          placeholder: 'enter another ' + labelName + ' address.',
        }
      ).appendTo('#' + inputDiv);

      $('<input/>').attr(
        {
          type: 'button',
          name: removeButtonName,
          id: removeButtonName,
          value: '-',
          class: 'btn btn-sign',
        }
      ).appendTo('#' + inputDiv);

      $('#' + removeButtonName).click(function () {
        $('#' + inputName).remove();
        $('#' + removeButtonName).remove();
        delete localStorage[inputName];
      });
    },

    // find out if user's location data is from mobility or Google Takeout
    processSourceResponse: function () {
      var locSource = $('input:radio[name=locationHistory]:checked').val();
      locSource === 'yes' ? ui.goToAnchor('upload') : ui.goToAnchor('download');
      //if (locSource === 'yes') {
      //  ui.goToAnchor('upload');
      //} else if (locSource === 'no') {
      //  ui.goToAnchor('download');
      //}
    },

    processMobilityLocation: function () {
      return;

      var
        endDate = '2015-12-20',
        todayTimestamp = (endDate !== '') ? new Date(endDate).getTime() : new Date().getTime(),
        mobilityDates = [];

      for (var i = 0; i < ui.daysCount; i++) {
        var tmpDate = new Date(todayTimestamp - (i * 24 * 60 * 60 * 1000));
        tmpDate = tmpDate.toJSON().substring(0, 10); //YYYY-mm-dd
        mobilityDates.push(tmpDate);
      }

      console.log("mobilityDates:", mobilityDates);
      mobilityDates.forEach(function (date) {
        dsu.query({
          "date": date,
          "device": "android",
          "success": function (result) {
            console.log("callback success:", result);
          },
          "error": function (result) {
            console.log(date + " not found. Error code = " + result);
          },
        });
      });
    },

    useInputProvided: function () {

      var
        obj,
        home,
        work,
        hobby,
        hasValidHome,
        hasValidWork,
        hasValidHobby,
        daysCount;


      home = [], work = [], hobby = [];
      var formResults = $("#addressForm").serializeArray();

      for (var i = 0; i < formResults.length; i++) {
        obj = formResults[i];
        if (obj.name.indexOf('homeAddress') !== -1)
          home.push(obj.value);
        else if (obj.name.indexOf('workAddress') !== -1)
          work.push(obj.value);
        else if (obj.name.indexOf('hobbyAddress') !== -1)
          hobby.push(obj.value);
        else if (obj.name === 'daysCount')
          daysCount = obj.value;
      }

      hasValidHome = false, hasValidWork = false, hasValidHobby = false;

      for (var i = 0; i < home.length; i++) {
        if (home[i] !== '') {
          hasValidHome = true;
          break;
        }
      }

      for (var i = 0; i < work.length; i++) {
        if (work[i] !== '') {
          hasValidWork = true;
          break;
        }
      }

      for (var i = 0; i < hobby.length; i++) {
        if (hobby[i] !== '') {
          hasValidHobby = true;
          break;
        }
      }

      if (!(hasValidHome && hasValidWork && hasValidHobby && daysCount !== '')) {
        ui.goToAnchor('address');
        $('#addressStatus').text('Please complete all fields.');
        $('#addressStatus').css('color', 'red');
        return;
      } else {
        $('#addressStatus').text('Fields successfully completed!');
        $('#addressStatus').css('color', 'green');

        var
          createdCalendarId = localStorage.createdCalendarId,
          createdCalendarSummary = localStorage.createdCalendarSummary,
          token = localStorage.token;

        localStorage.clear();
        localStorage.createdCalendarId = createdCalendarId;
        localStorage.createdCalendarSummary = createdCalendarSummary;
        localStorage.token = token;

        // store primary calendar Id
        var request = gapi.client.calendar.calendars.get({
          'calendarId': 'primary'
        });
        request.execute(function (resp) {
          console.log('Retrieved primary id:', resp.id);
          console.log('Retrieved timezone:', resp.timeZone);
          localStorage.primaryCalendarId = resp.id;
          localStorage.timeZone = resp.timeZone;
        });

        // store all form data in localStorage
        for (var i = 0; i < formResults.length; i++) {
          obj = formResults[i];
          if (obj.value !== '')
            localStorage[obj.name] = obj.value;
        }

        ui.daysCount = daysCount;
        ui.goToAnchor('locationHistory');
      }

    },

    processGoogleLocation: function (uploadedData) {
      // convert full addresses to lat,lon
      var getLatLng = function (allMappedAddresses, callback) {
        console.log("ui addresses:", allMappedAddresses);

        var
          addressLength,
          counter,
          coords,
          geocoder,
          lat,
          lng;

        coords = {};
        counter = 0;
        addressLength = _.size(allMappedAddresses);
        geocoder = new google.maps.Geocoder();

        for (var label in allMappedAddresses) {

          (function (label, address) {
            geocoder.geocode({'address': address}, function (results, status) {

              if (status == google.maps.GeocoderStatus.OK) {
                lat = results[0].geometry.location.lat();
                lng = results[0].geometry.location.lng();
                coords[label] = [lat, lng];
              } else {
                console.log("error geocoding:", address);
                callback(status);
              }

              counter++;
              if (counter === addressLength) {
                callback(coords);
              }
            });

          }(label, allMappedAddresses[label]));
        }

      }

      var allMappedAddresses = {
        home: localStorage.homeAddress0,
        work: localStorage.workAddress0,
        hobby: localStorage.hobbyAddress0
      }

      console.log("allMappedAddresses:", allMappedAddresses);
      console.log("so processGoogleLocation has been called.");

      getLatLng(allMappedAddresses, function (geocodedAddresses) {
          console.log("Geocoded addresses:", geocodedAddresses);

          var doCalendarOperations = function (addresses, uploadedData, noOfDays) {

            var
              data,
              dateOfLastDay,
              lastDayTimestamp,
              nDaysAgoTimestamp,
              HOME,
              HOBBY,
              WORK,
              createdCalendarSummary,
              extractDate;

            data = uploadedData;
            utility.assert(data.length > 0, "uploaded data length test");

            // format given date to yyyy-mm-dd
            extractDate = function (date) {
              return date.getFullYear() + "-" +
                ("0" + (date.getMonth() + 1)).slice(-2) +
                "-" + ("0" + date.getDate()).slice(-2);
            }

            // convert columns to expected format and add other new columns
            data.forEach(function (row) {

              var
                timestamp = parseInt(row.timestampMs),
                rowDate = new Date(timestamp);

              row.latitudeE7 = row.latitudeE7 / 10e6;
              row.longitudeE7 = row.longitudeE7 / 10e6;
              row.timestampMs = timestamp;
              row.fullDate = rowDate;
              row.date = extractDate(rowDate);
            });

            // sort entire time once otherwise have to sort each value from groupby date keys
            data = _.sortBy(data, 'timestampMs');

            // reduce data to only last N days
            // for testing purposes you can override input with custom noOfDays
            dateOfLastDay = new Date(data[data.length - 1].timestampMs);
            lastDayTimestamp = dateOfLastDay.getTime();
            nDaysAgoTimestamp = dateOfLastDay.setDate(dateOfLastDay.getDate() - noOfDays);

            data = data.filter(function (row) {
              return (row.timestampMs >= nDaysAgoTimestamp) && (row.timestampMs <= lastDayTimestamp);
            });

            /*
             * ignore locations with accuracy over 1000m
             */
            data = data.filter(function (row) {
              return row.accuracy <= 1000;
            });

            HOME = addresses.home;
            HOBBY = addresses.hobby;
            WORK = addresses.work;

            var distance = function (lat1, lon1, lat2, lon2) {
              var p = 0.017453292519943295;    // Math.PI / 180
              var c = Math.cos;
              var a = 0.5 - c((lat2 - lat1) * p) / 2 +
                c(lat1 * p) * c(lat2 * p) *
                (1 - c((lon2 - lon1) * p)) / 2;

              return 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
            }

            var marginError = 100;
            data.forEach(function (row) {
              if (distance(HOME[0], HOME[1], row.latitudeE7, row.longitudeE7) <= marginError)
                row.locationLabel = 'home';
              else if (distance(WORK[0], WORK[1], row.latitudeE7, row.longitudeE7) <= marginError)
                row.locationLabel = 'work';
              else if (distance(HOBBY[0], HOBBY[1], row.latitudeE7, row.longitudeE7) <= marginError)
                row.locationLabel = 'hobby';
              else
                row.locationLabel = 'other';
            });


            /*
             * add new calendar to calendar list but avoid creating duplicate calendar
             * but make sure the calendar id exists on Google Server
             * store new calendar id in localStorage
             */
            function checkCalendarExists(calSummary, callback) {

              var
                index,
                request,
                cal,
                calendarList = [];

              request = gapi.client.calendar.calendarList.list();
              request.execute(function (resp) {
                if (resp === undefined) {
                  callback(-1);
                }
                else {
                  calendarList = resp.items;
                  utility.assert(resp.items !== undefined, "calendarList test.");
                  for (index = 0; index < calendarList.length; index++) {
                    cal = calendarList[index];

                    if (cal.summary === calSummary) {
                      localStorage.createdCalendarId = cal.id;
                      localStorage.createdCalendarSummary = cal.summary;
                      callback(200);
                      break;
                    }
                  }

                  if (index >= calendarList.length) {
                    callback(-1);
                  }
                }
              });
            }

            createdCalendarSummary = 'Location';
            checkCalendarExists(createdCalendarSummary, function (status) {
              if (status === -1) {
                createCalendar(createdCalendarSummary, function (resp) {
                  if (resp === -1) {
                    console.log("calendar error")
                  }
                  else {
                    resetThenInsertNewEvents(localStorage.createdCalendarId, data);
                  }
                });
              }
              else if (status === 200) {
                resetThenInsertNewEvents(localStorage.createdCalendarId, data);
              }
            });

            function createCalendar(calendarSummary, callback) {
              var request = gapi.client.calendar.calendars.insert({
                'summary': calendarSummary
              });
              request.execute(function (resp) {
                if (resp === undefined) {
                  callback(-1);
                } else {
                  localStorage.createdCalendarId = resp.result.id;
                  localStorage.createdCalendarSummary = calendarSummary;
                  callback(200);
                  var msg = "Successful in creating calendar: " + createdCalendarSummary;
                  console.log(msg);
                }
              });
            }

            function resetThenInsertNewEvents(calendarId, givenData) {

              var deleteAllEvents = function (calendarId) {

                return new Promise(function (resolve) {
                  var request = gapi.client.calendar.events.list({
                    'calendarId': calendarId,
                    'showDeleted': false,
                    'singleEvents': true,
                    'orderBy': 'startTime'
                  });

                  request.execute(function (resp) {

                    var
                      events,
                      event,
                      batchDelete,
                      requestDeleted,
                      deleteRequest,
                      msg;

                    if (!resp.result) return;

                    events = resp.result.items;
                    deleteRequest = function (eventId) {
                      return gapi.client.calendar.events.delete({
                        'calendarId': localStorage.createdCalendarId,
                        'eventId': eventId
                      });
                    }

                    if (events.length > 0) {
                      batchDelete = gapi.client.newBatch();
                      for (var i = 0; i < events.length; i++) {
                        event = events[i];
                        requestDeleted = deleteRequest(event.id);
                        batchDelete.add(requestDeleted);
                      }
                      batchDelete.execute(function () {
                        msg = "No of events deleted before loading new ones: " + events.length;
                        resolve(msg);
                      });
                    }
                    else {
                      msg = "No events to delete.";
                      resolve(msg);
                    }
                  });
                });
              }

              deleteAllEvents(calendarId).then(function (response) {

                var
                  dataForDay,
                  allEventsForDay,
                  groupedByDayData,
                  insertEventWithFullAddress,
                  insertCounter,
                  getAllDwellTime;

                console.log(response);
                groupedByDayData = _.groupBy(givenData, 'date');

                insertEventWithFullAddress = function (ev) {
                  if (ev.summary.indexOf('HOME') === -1 && ev.summary.indexOf('WORK') === -1 &&
                    ev.summary.indexOf('HOBBY') === -1) {

                    ev.location = "(" + ev.location.lat + ", " + ev.location.lng + ")";
                  }

                  var insertRequest = gapi.client.calendar.events.insert({
                    'calendarId': localStorage.createdCalendarId,
                    'resource': ev
                  });
                  insertRequest.execute();

                  // get the full reverse address of where each event occurred using their lat,lng
                  // then insert the event with retrieved address

                  //var urlRequest = "//api.geonames.org/findNearestAddressJSON?lat=" +
                  //  ev.location.lat + "&lng=" + ev.location.lng + "&username=fnokeke";

                  //$.getJSON(urlRequest, function (result) {
                  //  var
                  //    address,
                  //    reversedAddress;
                  //
                  //  if (result.address !== undefined) {
                  //    result = result.address;
                  //    address = [
                  //      result.streetNumber + " " + result.street,
                  //      result.placename,
                  //      result.adminCode1,
                  //      result.postalcode
                  //    ];
                  //
                  //    reversedAddress = address.join(", ");
                  //    ev.location = reversedAddress;
                  //    console.log("Address set as:", reversedAddress);
                  //    makeInsertRequest(ev);
                  //
                  //  } else if (result.status.message === "invalid username") {
                  //    console.log("invalid username");
                  //  } else {
                  //    console.log("unknown error:", result);
                  //  }
                  //});

                }

                getAllDwellTime = function (dayData) {

                  if (dayData.length < 1)
                    return [];

                  var allResourcesForDay = [],
                    resource,
                    firstItem,
                    lastItem,
                    timeDiff,
                    currentLocObject,
                    locLabel,
                    latlng,
                    colorId,
                    prevLocObject,
                    tmpStore = [],
                    createResource;

                  tmpStore.push(dayData[0]);
                  var counter = 0;

                  var roundToTwoDP = function (num) {
                    return +(Math.round(num + "e+2") + "e-2");
                  }

                  for (var i = 1; i < dayData.length; i++) {
                    currentLocObject = dayData[i];
                    prevLocObject = dayData[i - 1];
                    if (currentLocObject.locationLabel === prevLocObject.locationLabel && i !== dayData.length - 1) {
                      tmpStore.push(currentLocObject);
                    }
                    else {
                      firstItem = tmpStore[0];
                      lastItem = tmpStore[tmpStore.length - 1];

                      if (firstItem === undefined || lastItem === undefined) {
                        counter++;
                        continue; //minor tweak to temporary avoid bug
                      }
                      timeDiff = roundToTwoDP((lastItem.timestampMs - firstItem.timestampMs) / (1000 * 60 * 60));
                      latlng = {lat: firstItem.latitudeE7, lng: firstItem.longitudeE7}; //TODO: change input passed

                      locLabel = "Time spent at " + firstItem.locationLabel.toUpperCase() +
                        " (~ " + timeDiff + " hours)";
                      //" [" + firstItem.latitudeE7 + "," + firstItem.longitudeE7 + "]";

                      if (firstItem.locationLabel == "home")
                        colorId = "10"; //green
                      else if (firstItem.locationLabel == "work")
                        colorId = "11"; //red
                      else if (firstItem.locationLabel == "hobby")
                        colorId = "6"; //brown
                      else if (firstItem.locationLabel == "other")
                        colorId = "8"; //grey

                      createResource = function (startTime, endTime, summary, location, colorId) {
                        return {
                          "summary": summary || 'no summary',
                          "location": location || 'empty location',
                          "colorId": colorId,
                          "start": {
                            "dateTime": startTime //e.g. "2015-12-23T10:00:00.000-07:00"
                          },
                          "end": {
                            "dateTime": endTime //e.g. "2015-12-23T17:25:00.000-07:00"
                          }
                        };
                      }
                      resource = createResource(
                        new Date(firstItem.timestampMs),
                        new Date(lastItem.timestampMs),
                        locLabel, latlng, colorId);
                      allResourcesForDay.push(resource);

                      // reset tmpStore to store next location
                      tmpStore = [];
                    }
                  }

                  return allResourcesForDay;
                }

                insertCounter = 0;
                for (var selectedDay in groupedByDayData) {

                  dataForDay = groupedByDayData[selectedDay];
                  allEventsForDay = getAllDwellTime(dataForDay);

                  if (allEventsForDay.length > 0) {
                    for (var i = 0; i < allEventsForDay.length; i++) {
                      insertEventWithFullAddress(allEventsForDay[i]);
                      insertCounter++;
                    }
                  }
                }
                console.log("Total events inserted:", insertCounter);


                //var dateStr = new Date(nDaysAgoTimestamp);
                //dateStr = extractDate(dateStr);
                //dateStr = dateStr.replace(/-/g, ''); //yyyymmdd
                //var url = "https://www.google.com/calendar/render?tab=mc&date=" + dateStr + "&mode=list";
                //window.open(url, '_blank');


                // embed calendar view
                var dateText =
                  "<i> Data inserted for (" + noOfDays + " days): " +
                  new Date(nDaysAgoTimestamp).toDateString() + " - " + new Date(lastDayTimestamp).toDateString() +
                  "</i>.";

                var primaryCalendarId = encodeURIComponent(localStorage.primaryCalendarId);
                var locationCalendarId = encodeURIComponent(localStorage.createdCalendarId);
                var timeZone = encodeURIComponent(localStorage.timeZone);

                var iFrameText =
                  '<iframe src="https://calendar.google.com/calendar/embed?title=%20&amp;' +
                  'showPrint=0&amp;mode=WEEK&amp;height=600&amp;wkst=2&amp;bgcolor=%23FFFFFF&amp;' +
                  'src=' + primaryCalendarId + '&amp;color=%23AB8B00&amp;' +
                  'src=' + locationCalendarId + '&amp;color=%888DF47&amp;' +
                  'ctz=' + timeZone +
                  'style="border-width:0" width="95%" height="75%" frameborder="0" scrolling="no"> ' +
                  '</iframe>';

                $('#date-output').html(dateText + iFrameText);

                localStorage.dateText = dateText;
                localStorage.iFrameText = iFrameText;

                utility.modifyDiv('calendar-div', 'hide');
                utility.modifyDiv('working-div', 'hide');

                ui.goToAnchor('calendarView');
              });
            }

          }
          doCalendarOperations(geocodedAddresses, uploadedData, ui.daysCount);
        }
      )
      ;
    }

  },

  dsuAnalysis = {

    runSampleDSU: function () {

      $.getJSON('dataset/mobility_sample_andy.json', function (data) {
        console.log("No of days of data:", data.length);

        // use today as end date if custom end date is not provided
        var
          endDate = '',
          todayTimestamp = (endDate !== '') ? new Date(endDate).getTime() : new Date().getTime(),
          dsuDates = [];

        for (var i = 0; i < ui.daysCount; i++) {
          var tmpDate = new Date(todayTimestamp - (i * 24 * 60 * 60 * 1000));
          tmpDate = tmpDate.toJSON().substring(0, 10); //YYYY-mm-dd
          dsuDates.push(tmpDate);
        }
        console.log("dsuDates:", dsuDates);

        var
          results = [],
          places = [
            [34.0529931, -118.4443538]
          ];

        var result = dsuAnalysis.checkForPlaces(places, dsuDates);
        console.log("results:", result);
      });
    },

    checkForPlaces: function (places, dsuDates) {

      var
        result = [],
        place = places[0];
      //place = [34.0529931, -118.4443538];

      data.forEach(function (day) {
        if (dsuDates.indexOf(day.body.date) !== -1 && day.body.episodes) {
          var episodes = day.body.episodes;
          episodes.forEach(function (episode) {
            if (episode.cluster) {
              var ec = episode.cluster;
              if (place[0] === ec.latitude && place[1] === ec.longitude) {
                result.push([episode.start, episode.end]);
              }
            }
          });
        }
      });

      return result;
    },
  },


  utility = {

    modifyDiv: function (div, action) {
      var divElement = document.getElementById(div);
      (action === 'hide') ? divElement.style.display = 'none' : divElement.style.display = 'inline';
    },

    assert: function (condition, message) {
      if (!condition) throw new Error(message)
    }
  };


// TODO: add timezone to calendar
// TODO: clear calendar then reload event
//TODO: set calendar timezone
//TODO: remove locations where user was moving or not stationary

//TODO: let users know that they have to be patient because the archive download could actually be slow
//TODO: people don't know what to view or expect when the calendar finally pops up


(function () {

  $('#file').on('change', function () {

    if (!this.files[0]) return;

    utility.modifyDiv('uploadingData-div', 'show');
    utility.modifyDiv('working-div', 'show');

    var file = this.files[0];
    var fileSize = prettySize(file.size);
    var reader = new FileReader();

    function status(message, color) {
      $('#uploadStatus').text(message);
      if (color)
        $('#uploadStatus').css('color', color);
    }

    function getLocationDataFromJson(data) {
      utility.assert(data !== '', 'parse json test.');
      var locations = JSON.parse(data).locations;

      if (!locations || locations.length === 0) {
        throw new ReferenceError('No location data found.');
      }
      return locations;
    }

    reader.onprogress = function (e) {
      var percentLoaded = Math.round(( e.loaded / e.total ) * 100);
      status(percentLoaded + '% of ' + fileSize + ' loaded.', 'grey');
    };

    reader.onload = function (e) {
      try {
        if (e.target.result === '') throw new Error("file too large for this browser. Use Safari.");

        var data = getLocationDataFromJson(e.target.result);
        status('File loaded successfully! (' + fileSize + ')', 'darkgrey');
        ui.processGoogleLocation(data);
      } catch (ex) {
        utility.modifyDiv('working-div', 'hide');
        status('(Make sure you upload location history file that ends in ".json" Error: ' + ex.message + ')', 'red');
        return;
      }
    };

    reader.onloadend = function (e) {
      utility.modifyDiv('uploadingData-div', 'hide');
      utility.modifyDiv('calendar-div', 'show');
    }

    reader.onerror = function () {
      utility.modifyDiv('working-div', 'hide');
      status('Something went wrong reading your JSON file. ' +
        'Ensure you\'re uploading a "direct-from-Google" JSON file and try again. ' +
        '(error: ' + reader.error + ')', 'red');
    };

    reader.readAsText(file);
  });
}());
