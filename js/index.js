//  Created by fnokeke on 1/9/16.

//Code Refactoring

(function (gapi, $, prettySize, _) {
      'use strict';

      initView();

      function initView() {

        // populate address fields with last entries
        for (var key in localStorage) {
          if (key.indexOf('placeAddress') > -1) {
            createAddressField(key, localStorage[key], true);
          } else {
            $('#' + key).val(localStorage[key]);
          }
        }

        // attach autocomplete listeners to addresses
        var addresses = ['defaultAddress'];
        addresses.forEach(function (address) {
          addAutocompleteListener(address);
        });

        // embed calendar view
        if (localStorage.iFrameText) {
          // $('#date-output').html(localStorage.iFrameText);
        } else {
          localStorage.iFrameText =
              '<iframe src="https://calendar.google.com/calendar/embed?title=%20&amp;' +
              'showPrint=0&amp;mode=WEEK&amp;height=600&amp;wkst=2&amp;bgcolor=%23FFFFFF&amp;' +
              'src=' + encodeURIComponent(localStorage.createdCalendarId) + '&amp;color=%888DF47&amp;' +
              'ctz=' + encodeURIComponent(localStorage.timeZone) +
              'style="border-width:0" width="98%" height="90%" frameborder="0" scrolling="no"> ' +
              '</iframe>';
        }

      }

      stageOne();

      function stageOne() {

        var CLIENT_ID = '176049196616-koqftr6rrmlk91m5ssqdnbbe2cfdgsul.apps.googleusercontent.com',
            SCOPES = ["https://www.googleapis.com/auth/calendar"];

        window.onload = function () {
          checkAuth();
        };

        //Check if current user has authorized this application.
        function checkAuth() {
          gapi.auth.authorize({
            'client_id': CLIENT_ID,
            'scope': SCOPES.join(' '),
            'immediate': true
          }, handleAuthResult);
        }

        //Handle response from authorization server.
        function handleAuthResult(authResult) {
          var authorizeDiv = document.getElementById('authorize-div');
          var beginDiv = document.getElementById('begin-div');

          if (authResult && !authResult.error) {
            beginDiv.style.display = 'inline';
            authorizeDiv.style.display = 'none';
            loadCalendar();
          } else {
            beginDiv.style.display = 'none';
            authorizeDiv.style.display = 'inline';
          }
        }

        // Initiate auth flow in response to user clicking authorize button.
        $('#authorizeButton').click(function () {
          gapi.auth.authorize({
            client_id: CLIENT_ID, scope: SCOPES, immediate: false
          }, handleAuthResult);
          return false;
        });

        $('#beginButton').click(function () {
          helper.goToAnchor('address');
        });

        // Load Google Calendar client library.
        function loadCalendar() {
          var request,
              calendarName;

          gapi.client.load('calendar', 'v3', function () {

            // store primary calendar Id
            request = gapi.client.calendar.calendars.get({
              'calendarId': 'primary'
            });
            request.execute(function (resp) {
              localStorage.primaryCalendarId = resp.id;
              localStorage.timeZone = resp.timeZone;
            });

            // create new calendar if non exists
            calendarName = 'Location';
            checkCalendarExists(calendarName, function (calId) {
              if (calId === -1) {
                createCalendar(calendarName, function (resp) {
                  if (resp === -1) {
                    throw new ReferenceError("Calendar creation failed!");
                  }
                });
              }
            });
          });
        }

      } // stageOne

      stageTwo();
      function stageTwo() {

        $('#addPlaceButton').click(function () {
          createAddressField('place');
        });

        $('#openCalendar').click(function () {
          helper.openFullCalendarView();
        });

        $('#saveInputButton').click(function () {
          saveInput();
        });

        $('#getDataButton').click(function () {
          var $locSource = $('input:radio[name=locationHistory]:checked').val();
          $locSource === 'yes' ? helper.goToAnchor('upload') : helper.goToAnchor('download');
        });

        // save input from user
        function saveInput() {

          var placesAdded = [],
              placeEntry,
              $formResults,
              entryName,
              entryValue,
              daysCount,
              createdCalendarId,
              createdCalendarSummary,
              token;

          $formResults = $("#addressForm").serializeArray();

          for (var i = 0; i < $formResults.length; i++) {
            placeEntry = $formResults[i];
            if (placeEntry.name.indexOf('Label') > -1 || placeEntry.name.indexOf('Address') > -1) {

              entryName = placeEntry.name.replace(/[|&;$%@"<>()+,]/g, ""); //remove illegal characters
              entryValue = placeEntry.value.replace(/[|&;$%@"<>()+,]/g, "");
              if (entryName !== '' && entryValue !== '') {
                placesAdded.push(placeEntry);
              }

            } else if (placeEntry.name === 'daysCount') {
              daysCount = placeEntry.value;
            }
          }

          //check if place label and addresses provided are valid entries
          if (!(placesAdded.length > 0 && daysCount !== '')) {
            helper.goToAnchor('address');
            helper.updateDiv('#addressStatus', 'Please complete all fields.', 'red');
            return;
          } else {
            helper.updateDiv('#addressStatus', 'Fields successfully completed!', 'green');
            createdCalendarId = localStorage.createdCalendarId;
            createdCalendarSummary = localStorage.createdCalendarSummary;
            token = localStorage.dsuToken;

            localStorage.clear();
            localStorage.createdCalendarId = createdCalendarId;
            localStorage.createdCalendarSummary = createdCalendarSummary;
            localStorage.dsuToken = token;

            // store day count and all addresses in localStorage
            localStorage.daysCount = daysCount;
            for (var i = 0; i < placesAdded.length; i++) {
              placeEntry = placesAdded[i];
              localStorage[placeEntry.name] = placeEntry.value;
            }

            // clear previous file input if any there before
            helper.resetFileupload();
            helper.updateDiv('#uploadStatus', '', 'darkgrey');

            // clear previously uploaded file
            helper.goToAnchor('data');
          }

        }
      } // stageTwo

      stageThree();

      function stageThree() {

        $('#file').on('change', function () {

          var file,
              fileSize,
              blob,
              filename,
              reader;

          if (!this.files[0]) {
            return;
          }

          helper.modifyDiv('uploadingData-div', 'show');
          helper.modifyDiv('working-div', 'show');

          file = this.files[0];
          filename = file.name;
          fileSize = prettySize(file.size);

          // extract only last 100 MB of data of uploaded file as this is enough for time frame
          // we are interested in. Note that about 250MB is the browser limit for loading at once in memory
          blob = file.slice(-100 * 1024 * 1024);

          reader = new FileReader();
          reader.onprogress = function (e) {
            var percentLoaded = Math.round(( e.loaded / e.total ) * 100);
            helper.updateDiv('#uploadStatus', percentLoaded + '% of ' + fileSize + ' loaded.', 'grey');
          };

          reader.onload = function (e) {
            var msg;
            try {
              if (e.target.result === '') {
                throw new RangeError();
              } else if (e.target.result === '{}') {
                throw new ReferenceError("Sorry, you have no locations data :(");
              }

              // format selected data to valid json string and extract locations
              var data = e.target.result;
              helper.assert(data !== '', 'parse json test.');

              var startIndex = data.indexOf('timestampMs');
              data = '{ "locations": [ {"' + data.substr(startIndex);
              data = JSON.parse(data).locations;
              if (!data || data.length === 0) {
                throw new ReferenceError('No location data found.');
              }

              helper.updateDiv('#uploadStatus', filename + ' loaded successfully! (' + fileSize + ')', 'darkgrey');
              helper.modifyDiv('calendar-div', 'show');

              processLocationHistory(data);
            } catch (err) {
              helper.modifyDiv('working-div', 'hide');
              console.log("err:", err);
              if (err instanceof SyntaxError) {
                msg = 'Wrong file uploaded. Your file should end in ".json"';
              }
              else if (err instanceof RangeError) {
                msg = 'Your data is too large for this browser. Please use Safari.';
              }
              else if (err instanceof ReferenceError) {
                msg = err.message || 'Uh oh. That doesn\'t look like your location data. Check and try again.';
              }
              else {
                msg = 'Uh oh :/ Something weird happened. Please contact admin.';
              }
              helper.updateStatus(msg);
              return;
            }
          };

          reader.onloadend = function (e) {
            helper.modifyDiv('uploadingData-div', 'hide');
          };

          reader.onerror = function () {
            helper.modifyDiv('working-div', 'hide');
            helper.updateDiv('#uploadStatus', 'Something went wrong reading your JSON file. ', 'red');
          };

          reader.readAsText(blob);
        });

        function processLocationHistory(uploadedData) {
          var userAddresses,
              promiseGeocode,
              promiseReset;

          userAddresses = {
            home: localStorage.homeAddress0,
            work: localStorage.workAddress0,
            hobby: localStorage.hobbyAddress0
          };

          // Cornell Tech address gives wrong geocoded lat/lng so we'll replace it with 111 8th Ave
          for (var label in userAddresses) {
            if (userAddresses.hasOwnProperty(label)) {
              if (userAddresses[label] === 'Cornell Tech, 8th Avenue, New York, NY, United States') {
                userAddresses[label] = '111 8th Avenue, New York, NY, United States';
              }
            }
          }

          promiseGeocode = geocodeAddress(userAddresses);
          promiseGeocode.then(function (geocodedAddresses) {

            var data = clusterLocations(uploadedData, geocodedAddresses);
            promiseReset = resetCalendar(localStorage.createdCalendarId);
            promiseReset.then(function () {
              analyzeData(data);
              $('#date-output').html(localStorage.dateText);
              helper.updateStatus();
              helper.goToAnchor('calendar');
            });

          });

          function geocodeAddress(userAddresses) {
            return new Promise(function (resolve, reject) {
              console.log("user addresses:", userAddresses);
              // for (var i = 0; i < hobby.length; i++) {
              //   if (hobby[i] !== '') {
              //     hasValidHobby = true;
              //     break;
              //   }
              // }


              var counter,
                  coords,
                  noOfAddresses;

              coords = {};
              counter = 0;
              noOfAddresses = _.size(userAddresses);

              for (var label in userAddresses) {
                if (userAddresses.hasOwnProperty(label)) {

                  (function (addrLabel, addr) {
                    var url,
                        lat,
                        lng;

                    url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(addr);
                    $.getJSON(url, function (response) {

                      try {
                        lat = response.results[0].geometry.location.lat;
                        lng = response.results[0].geometry.location.lng;
                        coords[addrLabel] = [lat, lng];
                        counter++;

                        if (counter === noOfAddresses) {
                          resolve(coords);
                        }

                        if (response.status === 'ZERO_RESULTS') {
                          reject("Invalid address provided.");
                        }
                      } catch (err) {
                        reject("Error happened. Please contact Admin.");
                        helper.updateStatus('Address is not valid. Try again or contact admin.');
                      }
                    });

                  }(label, userAddresses[label]));
                }
              }
            });
          }

          function clusterLocations(data, addresses) {

            var
                noOfDays,
                dateOfLastDay,
                lastDayTimestamp,
                nDaysAgoTimestamp,
                dateStr,
                HOME,
                HOBBY,
                WORK;

            // addresses = geocodedAddresses;
            // data = uploadedData;
            console.log("Geocoded addresses:", addresses);

            noOfDays = localStorage.daysCount;
            helper.assert(data.length > 0, "uploaded data length test");

            // convert columns to expected format and add other new columns
            data.forEach(function (row) {
              var timestamp = parseInt(row.timestampMs),
                  rowDate = new Date(timestamp);

              row.latitudeE7 = row.latitudeE7 / 10e6;
              row.longitudeE7 = row.longitudeE7 / 10e6;
              row.timestampMs = timestamp;
              row.fullDate = rowDate;
              row.date = helper.formatDate(rowDate);
            });

            // sort entire time once otherwise have to sort each value from groupby date keys
            data = _.sortBy(data, 'timestampMs');

            // reduce data to only last N days
            dateOfLastDay = new Date(data[data.length - 1].timestampMs);
            lastDayTimestamp = dateOfLastDay.getTime();
            nDaysAgoTimestamp = dateOfLastDay.setDate(dateOfLastDay.getDate() - noOfDays);

            // update calenderViewURL
            dateStr = new Date(nDaysAgoTimestamp);
            dateStr = helper.formatDate(dateStr);
            dateStr = dateStr.replace(/-/g, ''); //yyyymmdd
            localStorage.fullCalendarViewURL = "https://www.google.com/calendar/render?tab=mc&date=" +
                dateStr + "&mode=list";

            // update dateText
            localStorage.dateText =
                "<i> Data inserted for (" + noOfDays + " days): " +
                new Date(nDaysAgoTimestamp).toDateString() + " - " + new Date(lastDayTimestamp).toDateString() +
                "</i>.";


            data = data.filter(function (row) {
              return (row.timestampMs >= nDaysAgoTimestamp) && (row.timestampMs <= lastDayTimestamp);
            });

            // ignore locations with accuracy over 1000m
            data = data.filter(function (row) {
              return row.accuracy <= 1000;
            });

            HOME = addresses.home;
            HOBBY = addresses.hobby;
            WORK = addresses.work;

            // cluster locations into different categories within margin of error
            var marginError = 300;
            data.forEach(function (row) {
              if (distance(HOME[0], HOME[1], row.latitudeE7, row.longitudeE7) <= marginError) {
                row.locationLabel = 'home';
              } else if (distance(WORK[0], WORK[1], row.latitudeE7, row.longitudeE7) <= marginError) {
                row.locationLabel = 'work';
              } else if (distance(HOBBY[0], HOBBY[1], row.latitudeE7, row.longitudeE7) <= marginError) {
                row.locationLabel = 'hobby';
              } else {
                row.locationLabel = 'other';
              }
            });

            function distance(lat1, lon1, lat2, lon2) {
              var p = 0.017453292519943295;    // Math.PI / 180
              var c = Math.cos;
              var a = 0.5 - c((lat2 - lat1) * p) / 2 +
                  c(lat1 * p) * c(lat2 * p) *
                  (1 - c((lon2 - lon1) * p)) / 2;

              return 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
            }

            return data;
          }

          function resetCalendar(calendarId) {
            helper.assert(calendarId, "calendarId exist test");
            return new Promise(function (resolve) {
              var events,
                  event,
                  listRequest,
                  batchDelete,
                  requestDeleted,
                  deleteRequest,
                  msg;

              listRequest = gapi.client.calendar.events.list({
                'calendarId': calendarId,
                'showDeleted': false,
                'singleEvents': true,
                'orderBy': 'startTime'
              });
              listRequest.execute(function (resp) {
                if (!resp.result) {
                  return;
                }

                deleteRequest = function (eventId) {
                  return gapi.client.calendar.events.delete({
                    'calendarId': localStorage.createdCalendarId,
                    'eventId': eventId
                  });
                };

                events = resp.result.items;
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
                } else {
                  msg = "No events to delete.";
                  resolve(msg);
                }
              });
            });
          }

          function analyzeData(givenData) {

            var
                dataForDay,
                allEventsForDay,
                groupedByDayData,
                insertCounter,
                batchInsert,
                requestToInsert,
                insertRequest;

            groupedByDayData = _.groupBy(givenData, 'date');

            insertRequest = function (ev) {
              if (ev.summary.indexOf('OTHER') > -1) {
                ev.location = "(" + ev.location.lat + ", " + ev.location.lng + ")";
              }

              return gapi.client.calendar.events.insert({
                'calendarId': localStorage.createdCalendarId,
                'resource': ev
              });
            };

            insertCounter = 0;

            for (var selectedDay in groupedByDayData) {
              if (groupedByDayData.hasOwnProperty(selectedDay)) {

                dataForDay = groupedByDayData[selectedDay];
                allEventsForDay = getAllDwellTime(dataForDay);
                allEventsForDay = compressAndFilter(allEventsForDay);

                if (allEventsForDay.length > 0) {
                  batchInsert = gapi.client.newBatch();
                  for (var i = 0; i < allEventsForDay.length; i++) {
                    requestToInsert = insertRequest(allEventsForDay[i]);
                    batchInsert.add(requestToInsert);
                    insertCounter++;
                  }

                  batchInsert.execute(function () {
                  });
                }
              }
            }
            console.log("Total events inserted:", insertCounter);

            function getAllDwellTime(dayData) {

              if (dayData.length < 1) {
                return [];
              }

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
              };

              for (var i = 1; i < dayData.length; i++) {
                currentLocObject = dayData[i];
                prevLocObject = dayData[i - 1];
                if (currentLocObject.locationLabel === prevLocObject.locationLabel && i !== dayData.length - 1) {
                  tmpStore.push(currentLocObject);
                } else {
                  firstItem = tmpStore[0];
                  lastItem = tmpStore[tmpStore.length - 1];

                  if (firstItem === undefined || lastItem === undefined) {
                    counter++;
                    continue; //minor tweak to temporary avoid bug
                  }

                  timeDiff = roundToTwoDP((lastItem.timestampMs - firstItem.timestampMs) / (1000 * 60 * 60));
                  latlng = {lat: firstItem.latitudeE7, lng: firstItem.longitudeE7}; //TODO: change input passed
                  locLabel = firstItem.locationLabel.toUpperCase();

                  if (firstItem.locationLabel == "home") {
                    colorId = "10"; //green
                  } else if (firstItem.locationLabel == "work") {
                    colorId = "11"; //red
                  } else if (firstItem.locationLabel == "hobby") {
                    colorId = "6"; //brown
                  } else if (firstItem.locationLabel == "other") {
                    colorId = "8"; //grey
                  }

                  createResource = function (startTime, endTime, summary, location, colorId, tdiff, label) {
                    return {
                      "summary": summary || 'no summary',
                      "location": location || 'empty location',
                      "colorId": colorId,
                      "start": {
                        "dateTime": startTime //e.g. "2015-12-23T10:00:00.000-07:00"
                      },
                      "end": {
                        "dateTime": endTime //e.g. "2015-12-23T17:25:00.000-07:00"
                      },
                      "timediff": tdiff,
                      "label": label,
                    };
                  };

                  resource = createResource(
                      new Date(firstItem.timestampMs),
                      new Date(lastItem.timestampMs),
                      locLabel, latlng, colorId, timeDiff, firstItem.locationLabel
                  );

                  allResourcesForDay.push(resource);

                  // reset tmpStore to store next location
                  tmpStore = [];
                }
              }

              return allResourcesForDay;
            }

            function compressAndFilter(allEv) {

              if (allEv.length < 1) {
                return [];
              }

              var
                  tmpArr = [],
                  lastEntry,
                  currEv;

              tmpArr.push(allEv[0]);

              for (var i = 1; i < allEv.length; i++) {
                lastEntry = tmpArr[tmpArr.length - 1];
                currEv = allEv[i];

                if (lastEntry.label === currEv.label) {
                  lastEntry.end = currEv.end
                }
                else if ((lastEntry.label !== currEv.label) && (currEv.timediff === 0)) {
                  //console.log("ignore counter:", ignoreCounter);
                  //console.log("entry to ignore:", currEv.summary, currEv.start.dateTime, "----", currEv.end.dateTime);

                  if (allEv[i + 1]) { // if next is same as current event label then accept zero as timediff
                    if ((allEv[i + 1].label === currEv.label) && allEv[i + 1].label !== "other") {
                      tmpArr.push(currEv);
                      //console.log("Not gonna ignore because next event has same label as this: ", currEv.label)
                    }
                    else if (allEv[i + 2]) {
                      if ((allEv[i + 2].label === currEv.label) && allEv[i + 2].label !== "other") {
                        tmpArr.push(currEv);
                        //console.log("Not gonna ignore because next TWO event has same label as this:", currEv.label)
                      }
                    }
                  }
                }
                else if ((lastEntry.label !== currEv.label) && (currEv.label === "other")) { // home-other-home == home-home
                  if (allEv[i + 1]) {
                    if (allEv[i + 1].label === lastEntry.label) {
                      lastEntry.end = currEv.end;
                      //console.log("extending with label from OTHER");
                    }
                  }
                }
                else {
                  tmpArr.push(currEv);
                }
              }
              //console.log("total ignore counter:", ignoreCounter);

              var
                  timediff,
                  ev,
                  resultsArr = [];

              //update summary and delete irrelevant fields
              for (var i = 0; i < tmpArr.length; i++) {
                ev = tmpArr[i];
                timediff = (ev.end.dateTime - ev.start.dateTime) / (1000 * 60 * 60);

                if (timediff > 0) {
                  ev.summary += " (~ " + timediff.toFixed(1) + " hours)";
                  delete ev.label;
                  delete ev.timediff;
                  resultsArr.push(ev);
                }

              }
              return resultsArr;
            }
          }
        }

      } // stageThree

      stageFour();

      function stageFour() {

        var dsuAnalysis = {

          runSampleDSU: function () {

            $.getJSON('dataset/mobility_sample_andy.json', function (data) {
              console.log("No of days of data:", data.length);

              // use today as end date if custom end date is not provided
              var
                  endDate = '',
                  todayTimestamp = (endDate !== '') ? new Date(endDate).getTime() : new Date().getTime(),
                  dsuDates = [];

              for (var i = 0; i < localStorage.daysCount; i++) {
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
              if (dsuDates.indexOf(day.body.date) > -1 && day.body.episodes) {
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
        };

        function processMobilityLocation() {

          var endDate = '2015-12-20',
              todayTimestamp = (endDate !== '') ? new Date(endDate).getTime() : new Date().getTime(),
              mobilityDates = [];

          for (var i = 0; i < 1; i++) {
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

          // query pam data
          $.ajax({
            method: "GET",
            headers: {
              "Authorization": "Bearer [OAUTH_ACCESS_TOKEN]"
            },
            url: "http://aws-qa.smalldata.io/dsu/",
            data: {schema_namespace: "omh", schema_name: "physical-activity", schema_version: "1.0"},
            success: function (result) {
              console.log(result);
            },
            error: function (e, status, error) {
              console.log(e);
            }
          });
        }

      }


      // ===================
      // shared functions
      // for all stages
      // ===================

      var helper = {

        assert: function (condition, message) {
          if (!condition) {
            throw new Error(message);
          }
        },

        // format given date to yyyy-mm-dd
        formatDate: function (date) {
          return date.getFullYear() + "-" +
              ("0" + (date.getMonth() + 1)).slice(-2) +
              "-" + ("0" + date.getDate()).slice(-2);
        },

        goToAnchor: function (anchor) {
          var loc = document.location.toString().split('#')[0];
          document.location = loc + '#' + anchor;
          return false;
        },

        modifyDiv: function (div, action) {
          var divElement = document.getElementById(div);
          (action === 'hide') ? divElement.style.display = 'none' : divElement.style.display = 'block';
        },

        openFullCalendarView: function () {
          // window.location.href = localStorage.fullCalendarViewURL || 'http://calendar.google.com';
          window.open(localStorage.fullCalendarViewURL || 'http://calendar.google.com', '_blank');
        },

        resetFileupload: function () {
          $('#file').val('');
        },

        updateStatus: function (msg) {
          var error = msg || '';
          helper.updateDiv('#uploadStatus', error, 'red');
          helper.resetFileupload();
          helper.modifyDiv('working-div', 'hide');
          helper.modifyDiv('calendar-div', 'hide');
        },

        updateDiv: function (div, message, color) {
          $(div).text(message);
          $(div).css('color', color);
        }
      };

      function addAutocompleteListener(id) {
        var address,
            autocomplete,
            place;

        address = document.getElementById(id);
        autocomplete = new google.maps.places.Autocomplete(address);
        autocomplete.setTypes([]);

        autocomplete.addListener('place_changed', function () {
          place = autocomplete.getPlace();
        });
      }

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
          if (!resp) {
            callback(-1);
          } else {
            calendarList = resp.items;
            helper.assert(resp.items !== undefined, "calendarList test.");
            for (index = 0; index < calendarList.length; index++) {
              cal = calendarList[index];
              if (cal.summary === calSummary) {
                localStorage.createdCalendarId = cal.id;
                localStorage.createdCalendarSummary = cal.summary;
                callback(cal.id);
                break;
              }
            }

            if (index >= calendarList.length) {
              callback(-1);
            }
          }
        });
      }

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

      function createPlaceLabel(inputName, inputValue) {

        $('<input/>').attr(
            {
              type: 'text',
              name: inputName,
              id: inputName,
              value: inputValue || '',
              placeholder: 'label place e.g. home, school, gym',
              class: 'place-label'
            }
        ).appendTo('#placeAddress-div');
      }

      // create additional text fields when button is clicked
      function createAddressField(labelName, inputValue, isPopulating) {
        var counter,
            inputName,
            inputDiv,
            placeLabel,
            removeButtonName;

        if (isPopulating) {
          inputName = labelName;
          placeLabel = labelName.replace("placeAddress", "placeLabel");

        } else { //creating new fields
          localStorage.placeId = 1 + parseInt(localStorage.placeId || 0);
          counter = localStorage.placeId;
          inputName = labelName + 'Address' + counter;
          placeLabel = "placeLabel" + counter;
        }
        
        createPlaceLabel(placeLabel);

        removeButtonName = 'remove' + inputName;
        inputDiv = inputName.replace(/\d+/g, '') + '-div';
        inputValue = inputValue || '';

        // create text field for address
        $('<input/>').attr(
            {
              type: 'text',
              name: inputName,
              id: inputName,
              value: inputValue,
              placeholder: 'address of labelled place',
              class: 'place-address',
            }
        ).appendTo('#' + inputDiv);

        // attach autocomplete listener
        addAutocompleteListener(inputName);

        // add remove button
        $('<input/>').attr({
          type: 'button',
          name: removeButtonName,
          id: removeButtonName,
          value: '-',
          class: 'btn btn-sign',
        }).appendTo('#' + inputDiv);

        $('#' + removeButtonName).click(function () {
          $('#' + inputName).remove();
          $('#' + placeLabel).remove();
          $('#' + removeButtonName).remove();
          delete localStorage[inputName];
        });
      }


    }
    (gapi, jQuery, prettySize, _)
)
;


//TODO: throw error when page hangs during file loading
//TODO: prevent continuation when user does not enter address
//TODO: show calendar iframe

//TODO: remove locations where user was moving or not stationary
//TODO: let users know that they have to be patient because the archive download could actually be slow
//TODO: people don't know what to view or expect when the calendar finally pops up
