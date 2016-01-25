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
      console.log("google calendar client loaded.");
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
      if (authResult && !authResult.error) {
        // Hide auth UI, then load client library.
        authorizeDiv.style.display = 'none';
        gCal.loadCalendarApi();
      } else {
        // Show auth UI, allowing the user to initiate authorization by
        // clicking authorize button.
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
        $('#sourceStatus').text('Calendar authorization successful!');
        $('#sourceStatus').css('color', 'green');
        utility.modifyDiv("welcome-div", 'hide');
        utility.modifyDiv('address-div', 'show');
      });
    }
  },

  ui = {

    // ui values are set using user input
    host: window.location.hostname === 'localhost' ?
      'http://localhost:63342/js-viz/' :
      'https://eaf.smalldata.io/partner/slm/',
    allMappedAddresses: {},
    daysCount: 0,

    // find out if user's location data is from mobility or Google Takeout
    processSourceResponse: function () {
      var locSource = $('input:radio[name=source]:checked').val();
      if (locSource === undefined) {
        $('#sourceStatus').text('You need to select an option.');
        $('#sourceStatus').css('color', 'red');
        return;
      }
      utility.modifyDiv('source-div', 'hide');
      utility.modifyDiv('address-div', 'hide');

      if (locSource === 'yes') {
        utility.modifyDiv('upload-div', 'show');
        utility.modifyDiv('note-div', 'show');
        ui.getUploadedData(function (data) {
          ui.processGoogleLocation(data);
        });
      } else if (locSource === 'no') {
        utility.modifyDiv('mobility-div', 'show');
        ui.processMobilityLocation();
      } else if (locSource === 'download') {
        window.location.href = ui.host + 'download.html';
      }
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

    getUploadedData: function (callback) {

      $('#file').change(function () {
        if (!this.files[0]) return;
        utility.modifyDiv('uploadingData-div', 'show');
        utility.modifyDiv('working-div', 'show');

        var file = this.files[0];
        var fileSize = prettySize(file.size);
        var reader = new FileReader();

        function status(message, color) {
          $('#fileStatus').text(message);
          if (color)
            $('#fileStatus').css('color', color);
        }

        function getLocationDataFromJson(data) {
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
            var data = getLocationDataFromJson(e.target.result);
            status('File loaded successfully! (' + fileSize + ')', 'green');
            callback(data);
          } catch (ex) {
            utility.modifyDiv('working-div', 'hide');
            status('Something went wrong generating your location entries. Ensure you\'re uploading a ' +
              'Google Takeout JSON file that contains location data and try again. ' +
              '(error: ' + ex.message + ')', 'red');
            return;
          }
        };

        reader.onerror = function () {
          utility.modifyDiv('working-div', 'hide');
          status('Something went wrong reading your JSON file. ' +
            'Ensure you\'re uploading a "direct-from-Google" JSON file and try again. ' +
            '(error: ' + reader.error + ')', 'red');
        };

        reader.readAsText(file);
      });
    },

    useInputProvided: function () {

      var
        home,
        work,
        hobby,
        daysCount;

      home = $('#homeAddress').val();
      work = $('#workAddress').val();
      hobby = $('#hobbyAddress').val();
      daysCount = $('#daysCount').val();

      if (home === '' || work === '' || hobby === '' || daysCount === '') {
        $('#sourceStatus').text('Please complete all fields.');
        $('#sourceStatus').css('color', 'red');
        return;
      } else {
        $('#sourceStatus').text('');

        ui.allMappedAddresses = {
          "home": home,
          "work": work,
          "hobby": hobby
        };
        ui.daysCount = daysCount;

        localStorage.home = home;
        localStorage.work = work;
        localStorage.hobby = hobby;
        localStorage.daysCount = daysCount;
      }

      utility.modifyDiv('address-div', 'hide');
      utility.modifyDiv('source-div', 'show');
    },

    processGoogleLocation: function (uploadedData) {

      utility.modifyDiv('address-div', 'hide');
      utility.modifyDiv('upload-div', 'hide');
      utility.modifyDiv('note-div', 'hide');
      utility.modifyDiv('uploadingData-div', 'hide');
      utility.modifyDiv('calendar-div', 'show');

      // convert full addresses to lat,lon
      var getLatLng = function (allMappedAddresses, callback) {

        var coords,
          counter,
          addresses,
          getKey;

        coords = {};
        counter = 0;
        addresses = _.values(allMappedAddresses);

        getKey = function (obj, value) {
          for (var key in obj) {
            if (obj[key] === value)
              return key;
          }
          return "error getting key";
        }

        addresses.forEach(function (address) {
          counter++;

          var geocoder,
            lat,
            lng,
            label;

          geocoder = new google.maps.Geocoder();
          geocoder.geocode({'address': address}, function (results, status) {

            if (status == google.maps.GeocoderStatus.OK) {
              lat = results[0].geometry.location.lat();
              lng = results[0].geometry.location.lng();
              label = getKey(allMappedAddresses, address);
              coords[label] = [lat, lng];

              // all addresses have been processed
              if (_.size(coords) === addresses.length) {
                callback(coords);
              }
            }
            else {
              callback(status);
            }
          });
        });
      }

      getLatLng(ui.allMappedAddresses, function (geocodedAddresses) {
          console.log("Geocoded addresses:", geocodedAddresses);

          var doCalendarOperations = function (addresses, uploadedData, noOfDays) {

            var
              data,
              city,
              cityLatMargin,
              cityLonMargin,
              dateOfLastDay,
              lastDayTimestamp,
              nDaysAgoTimestamp,
              HOME,
              HOBBY,
              WORK,
              latMargin,
              lngMargin,
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

            var text =
              "Data for (" + noOfDays + " days):\n" +
              new Date(nDaysAgoTimestamp).toDateString() + " - " + new Date(lastDayTimestamp).toDateString();
            $('#date-output').text(text);

            /*
             * ignore locations with accuracy over 1000m
             */
            data = data.filter(function (row) {
              return row.accuracy <= 1000;
            });

            HOME = addresses.home;
            HOBBY = addresses.hobby;
            WORK = addresses.work;

            // center of city is half-way between home and work
            city = [
              0.5 * (HOME[0] + WORK[0]),
              0.5 * (HOME[1] + WORK[1]),
            ];

            cityLatMargin = 1.0;
            cityLonMargin = 1.0;

            /*
             * ignore all locations outside city
             */
            data = data.filter(function (row) {
              return Math.abs(row.latitudeE7 - city[0]) <= cityLatMargin &&
                Math.abs(row.longitudeE7 - city[1]) <= cityLonMargin
            });

            // determine if location falls into specific place label such as home, work, etc
            latMargin = 0.00052;
            lngMargin = 0.0052;

            data.forEach(function (row) {
              if (Math.abs(row.latitudeE7 - HOME[0]) < latMargin &&
                Math.abs(row.longitudeE7 - HOME[1]) < lngMargin) {
                row.locationLabel = 'home';
              } else if (Math.abs(row.latitudeE7 - WORK[0]) < latMargin &&
                Math.abs(row.longitudeE7 - WORK[1]) < lngMargin) {
                row.locationLabel = 'work';
              } else if (Math.abs(row.latitudeE7 - HOBBY[0]) < latMargin &&
                Math.abs(row.longitudeE7 - HOBBY[1]) < lngMargin) {
                row.locationLabel = 'hobby';
              }
              else {
                row.locationLabel = 'other';
              }
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

            createdCalendarSummary = 'My Location Calendar';
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

                // get the full reverse address of where each event occurred using their lat,lng
                // then insert the event with retrieved address
                insertEventWithFullAddress = function (ev) {
                  //var urlRequest = "//api.geonames.org/findNearestAddressJSON?lat=" +
                  //  ev.location.lat + "&lng=" + ev.location.lng + "&username=fnokeke";

                  /*if (ev.location === 'home' || ev.location === 'work' || ev.location === 'hobby') {
                   }
                   else {
                   $.getJSON(urlRequest, function (result) {
                   var
                   address,
                   reversedAddress,
                   insertRequest;

                   if (result.address !== undefined) {
                   result = result.address;
                   address = [
                   result.streetNumber + " " + result.street,
                   result.placename,
                   result.adminCode1,
                   result.postalcode
                   ];
                   reversedAddress = address.join(", ");
                   ev.location = reversedAddress;
                   } else if (result.status.message === "invalid username") {
                   console.log("invalid username");
                   } else {
                   console.log("uknown error:", result);
                   }

                   });
                   } */

                  var insertRequest = gapi.client.calendar.events.insert({
                    'calendarId': localStorage.createdCalendarId,
                    'resource': ev
                  });
                  insertRequest.execute();
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

                      if (firstItem.locationLabel === 'other')
                        continue;

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

                // calendar operations all done so open main calendar view for inserted events
                var dateStr = new Date(nDaysAgoTimestamp);
                dateStr = extractDate(dateStr);
                dateStr = dateStr.replace(/-/g, ''); //yyyymmdd

                setTimeout(function () {
                  var url = "https://www.google.com/calendar/render?tab=mc&date=" + dateStr + "&mode=list";
                  window.open(url, '_blank');
                  utility.modifyDiv('working-div', 'hide');
                  utility.modifyDiv('complete-div', 'show');
                }, 5000);

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


//TODO: check if calendar exists before continue other operations
// TODO: batch events
// TODO: add timezone to calendar
// TODO: clear calendar then reload event
//TODO: set calendar timezone
//TODO: remove locations where user was moving or not stationary



//TODO: let users know that they have to be patient because the archive download could actually be slow
