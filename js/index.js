//  Created by fnokeke on 1/9/16.

(function (gapi, $, prettySize, _) {
      'use strict';

      initView();

      function initView() {
        var addresses;

        // populate address fields with last entries
        for (var key in localStorage) {
          if (key.indexOf('placeAddress') > -1) {
            createAddressField(key, localStorage[key], true);
          } else {
            $('#' + key).val(localStorage[key]);
          }
        }

        // attach autocomplete listeners to addresses
        addresses = ['defaultAddress'];
        addresses.forEach(function (address) {
          addAutocompleteListener(address);
        });

        updateLabelsOfPlaces();

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

      function updateLabelsOfPlaces() {
        var clusteredPlaces,
            labelColors;

        clusteredPlaces = getClusteredPlaces();
        labelColors = JSON.stringify(Object.keys(clusteredPlaces));
        localStorage.setItem('labelColors', labelColors);

        console.log('user places labels:', labelColors);

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
            helper.updateDiv('addressStatus', 'Please complete all fields.', 'red');
            return;
          } else {
            // helper.updateDiv('addressStatus', 'Fields successfully completed!', 'green');
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

            //update labelColors as places are added
            updateLabelsOfPlaces();

            // clear previous file input if any there before
            helper.resetFileupload();
            helper.updateDiv('uploadStatus', '', 'darkgrey');

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
              limit,
              filename,
              reader;

          if (!this.files[0]) {
            return;
          }

          helper.modifyDiv('uploadingData-div', 'show');
          helper.modifyDiv('working-div', 'show');

          file = this.files[0];

          // add unzip
          // JSZip.loadAsync(file).then(function (zip) {
          //   console.log("zip.files:", zip.files);
          //
          //   // zip.file('Takeout/Location History/LocationHistory.json').loadAsync(locContent);//({type:"blob"})
          //       // .then(function (content) {
          //       //   // see FileSaver.js
          //       // });
          //   zip.file("Takeout/Location History/LocationHistory.json")
          //       .async("string", function (meta) {
          //         console.log("Generating the content, we are at " + meta.percent.toFixed(2) + " %");
          //       })
          //       .then(function () {
          //             console.log("all done");
          //       });
          //
          //
          //
          //   return zip.file('Takeout/Location History/LocationHistory.json');
          // }).then(function (locFile) {
          //   console.log("I got text here.");
          // });

          filename = file.name;
          fileSize = prettySize(file.size);

          // we are interested in (max of 1 month). Note that about 250MB is the browser limit for loading in memory
          // JSON file has descending order of timestamp. For instance, first entry has today's timestamp
          // while second entry has yesterday's timestamp
          blob = file;
          limit = 100 * 1000 * 1000;

          if (file.size > limit) {
            blob = file.slice(0, 100 * 1024 * 1024);
          }

          reader = new FileReader();
          reader.onprogress = function (e) {
            var percentLoaded = Math.round(( e.loaded / e.total ) * 100);
            helper.updateDiv('uploadStatus', percentLoaded + '% of ' + fileSize + ' loaded.', 'grey');
          };

          reader.onload = function (e) {
            var msg;
            try {
              if (e.target.result === '') {
                throw new RangeError();
              }

              // format selected data to valid json string and extract locations
              var data = e.target.result;

              if (!data) {
                throw new ReferenceError('No location data found.');
              }

              if (file.size > limit) {
                var startSearchIndex = data.length - 1000;
                var lastCloseBrace = data.indexOf("accuracy", startSearchIndex);

                if (lastCloseBrace !== -1) {
                  var subDATA = data.substr(0, lastCloseBrace - 1);
                  data = subDATA + "\"accuracy\": 0}]}";
                }
              }

              data = JSON.parse(data);
              if (_.size(data) === 0) {
                throw new ReferenceError("Uh oh, you have no locations data :(");
              }
              data = data.locations;

              helper.updateDiv('uploadStatus', filename + ' loaded successfully! (' + fileSize + ')', 'darkgrey');
              helper.modifyDiv('calendar-div', 'show');

              processLocationHistory(data);
            } catch (err) {
              helper.modifyDiv('working-div', 'hide');
              console.log("err:", err);
              if (err instanceof SyntaxError) {
                msg = 'Wrong file uploaded. Your file should end in ".json"';
              }
              else if (err instanceof RangeError) {
                msg = 'Sorry cannot continue because there is no data in the file uploaded :(';
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
            helper.updateDiv('uploadStatus', 'Something went wrong reading your JSON file. ', 'red');
          };

          reader.readAsText(blob);
        });

        function processLocationHistory(uploadedData) {
          var userAddresses,
              listOfAddr,
              promiseGeocode,
              promiseReset;

          userAddresses = getClusteredPlaces();

          // Cornell Tech address gives wrong geocoded lat/lng so we'll replace it with 111 8th Ave
          for (var label in userAddresses) {
            if (userAddresses.hasOwnProperty(label)) {

              listOfAddr = userAddresses[label];
              for (var i = 0; i < listOfAddr.length; i++) {
                if (listOfAddr[i] === 'Cornell Tech, 8th Avenue, New York, NY, United States') {
                  listOfAddr[i] = '111 8th Avenue, New York, NY, United States';
                }
              }

            }
          }
          console.log("userAddresses:", userAddresses);

          // geocode all addresses to lat,lng coordinates
          promiseGeocode = geocodeAddress(userAddresses);
          promiseGeocode.then(function (geocodedAddresses) {
            var tmpGeocodedAddress = {};
            var colorCounter = 1;
            var newLabelName;

            console.log("geocodedAddresses: ", geocodedAddresses);

            //update label of geocoded Addresses to have their own specific color of events for google calendar
            for (var label in geocodedAddresses) {
              if (geocodedAddresses.hasOwnProperty(label)) {
                tmpGeocodedAddress[label] = geocodedAddresses[label];
              }
            }

            for (var label in tmpGeocodedAddress) {
              if (tmpGeocodedAddress.hasOwnProperty(label)) {

                if (colorCounter === 8) { // 8 is grey and this color is reserved for other categories
                  colorCounter++;
                }

                if (colorCounter > 11) { // google only makes events colors with ids 1-11. Wonder why :/
                  colorCounter %= 11;
                }

                newLabelName = label + ';' + colorCounter;
                geocodedAddresses[newLabelName] = geocodedAddresses[label];
                delete geocodedAddresses[label];
                colorCounter++;
              }
            }

            var data = clusterLocations(uploadedData, geocodedAddresses);
            promiseReset = resetCalendar(localStorage.createdCalendarId);
            promiseReset.then(function () {
              try {
                analyzeData(data);
                helper.updateStatus();
                helper.goToAnchor('calendar');
              } catch (err) {
                console.log("analyzeData error caught:", err);
                helper.updateStatus("Uh oh, couldn't finish processing your location data. Please contact admin.");
              }
            });
          });

          function geocodeAddress(userAddresses) {
            return new Promise(function (resolve, reject) {

              var counter,
                  coords,
                  listOfUserAddr,
                  noOfAddresses;

              coords = {};
              counter = 0;
              noOfAddresses = 0;

              for (var label in userAddresses) {
                if (userAddresses.hasOwnProperty(label)) {
                  listOfAddr = userAddresses[label];
                  noOfAddresses += listOfAddr.length;
                }
              }
              console.log("Total number of user addresses:", noOfAddresses);


              for (var label in userAddresses) {
                if (userAddresses.hasOwnProperty(label)) {

                  listOfUserAddr = userAddresses[label];
                  for (var i = 0; i < listOfUserAddr.length; i++) {

                    (function (addrLabel, addr) {
                      var url,
                          lat,
                          lng;

                      url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(addr);
                      $.getJSON(url, function (response) {

                        try {
                          lat = response.results[0].geometry.location.lat;
                          lng = response.results[0].geometry.location.lng;

                          if (!coords[addrLabel]) {
                            coords[addrLabel] = [[lat, lng]];
                          } else {
                            coords[addrLabel].push([lat, lng]);
                          }
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

                    }(label, listOfUserAddr[i]));

                  }
                }
              }
            });
          }

          function clusterLocations(data, geocodedAddresses) {

            var
                noOfDays,
                dateOfLastDay,
                lastDayTimestamp,
                nDaysAgoTimestamp,
                dateStr;

            noOfDays = localStorage.daysCount;
            helper.assert(data.length > 0, "uploaded data length test");

            // var activitysCounter = 0;
            // var totalDataPoint = 0;
            // var onFootCounter = 0;
            // var inVehicleCounter = 0;

            // convert columns to expected format and add other new columns
            data.forEach(function (row) {
              var timestamp = parseInt(row.timestampMs),
                  rowDate = new Date(timestamp);

              row.latitudeE7 = row.latitudeE7 / 10e6;
              row.longitudeE7 = row.longitudeE7 / 10e6;
              row.timestampMs = timestamp;
              row.fullDate = rowDate;
              row.date = helper.formatDate(rowDate);

              // if (row.date === '2016-04-16' && row.activitys) {
              //
              //   row.activitys.forEach(function (activityArray) {
              //     if (activitysCounter > 100) {
              //       // throw new BreakException("100 encountered");
              //     }
              //
              //     activityArray.activities.forEach(function (activity) {
              //       totalDataPoint++;
              //       // console.log("confidence:", activity.confidence, "type:", activity.type);
              //
              //       if (activity.type === "inVehicle" && activity.confidence >= 85) {
              //         inVehicleCounter++;
              //       } else if (activity.type === "onFoot" && activity.confidence >= 85) {
              //         onFootCounter++;
              //       }
              //
              //     });
              //
              //   });
              //
              // }


            });

            // console.log("total activities", totalDataPoint);
            // console.log("invehicle counter", inVehicleCounter);
            // console.log("onFootCounter", onFootCounter);
            // console.log("onFootcounter ratio:", 1.0 * onFootCounter / totalDataPoint);

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

            // show me all entries
            var prevRow = {};
            data.forEach(function (row) {
              // if (row.date === '2016-04-20') {
              console.log(row.fullDate, row.accuracy, row.activitys || '', row.latitudeE7, row.longitudeE7,
                  row.velocity || '', row.heading || '', row.altitude || '');
              if (prevRow.latitudeE7 && prevRow.longitudeE7) {
                console.log("Distance (prev-curr):",
                    distance(prevRow.latitudeE7, prevRow.longitudeE7, row.latitudeE7, row.longitudeE7));
                console.log("--------");
              }
              prevRow.latitudeE7 = row.latitudeE7;
              prevRow.longitudeE7 = row.longitudeE7;
              // }
            });
            console.log("size of data:", data.length);

            // ignore locations with accuracy over threshold
            // var oldLen = _.size(data);
            // data = data.filter(function (row) {
            //   return row.accuracy <= 1000;
            // });
            // console.log("num of rows dropped after accuracy filter:", oldLen - _.size(data));


            // ==========
            // dbscan
            // ==========
            // var selectedDates = ["2016-04-15", "2016-04-16", "2016-04-19", "2016-04-20"];
            var datasetSelected = [];

            data.forEach(function (row) {
              datasetSelected.push([row.latitudeE7, row.longitudeE7, row.timestampMs]);
            });
            console.log("dataset rows selected for clusters:", datasetSelected.length);

            // each cluster contains indices of values that belong to that cluster
            var dayEvents = getDayEventsFromCluster(geocodedAddresses, datasetSelected);
            console.log("total dayEvents::::::::::", dayEvents);

            // compress events for each place
            for (var i = 0; i < dayEvents.length; i++) {
              dayEvents[i] = mergeSimilarEvents(dayEvents[i]);
            }
            console.log("compressed total dayEvents::::::::::", dayEvents);

            // batch insert all events
            batchInsertEvents(dayEvents);


            function mergeSimilarEvents(dayEvents) {
              var dayLen = dayEvents.length;
              var begin, curr, prev;
              var minDuration = 60; //mins
              minDuration = minDuration * 60 * 1000; //microseconds
              var eventsArr = [];

              var index = 0;
              while (index < dayLen - 1) {
                begin = dayEvents[index];

                for (var i = index + 1; i < dayLen; i++) {
                  prev = dayEvents[i - 1];
                  curr = dayEvents[i];
                  index = i;

                  if (curr[1] - prev[1] <= minDuration) {
                    begin[2] = curr[2]; //extend end time of event
                  } else {
                    eventsArr.push(begin);

                    if (index === dayLen - 1) {
                      eventsArr.push(curr);
                    }

                    break;
                  }

                  if (index === dayLen - 1) {
                    eventsArr.push(begin);
                  }
                }
              }

              return eventsArr;
            }

            function batchInsertEvents(events) {
              var item,
                  counter = 0,
                  batchInsert,
                  startTime,
                  endTime,
                  minDuration,
                  requestToInsert;

              minDuration = 0; //number of minutes
              minDuration = minDuration * 60 * 1000; //microseconds
              batchInsert = gapi.client.newBatch();

              for (var i = 0; i < events.length; i++) {
                item = events[i];
                for (var j = 0; j < item.length; j++) {
                  startTime = item[j][1];
                  endTime = item[j][2];

                  if ((endTime - startTime) >= minDuration) {
                    requestToInsert = insertSingleRequest(item[j]);
                    batchInsert.add(requestToInsert);
                    counter++;
                  }
                }
              }

              batchInsert.execute(function (resp) {

                for (var key in resp) {
                  if (resp[key].error) {
                    console.log("error occurred during insert:", resp[key]);
                    helper.updateStatus("oh no something bad happened. Please contact admin.");
                  }
                }

                if (counter > 0) {
                  console.log("Total events inserted:", counter);
                  $('#date-output').html(localStorage.dateText);
                } else {
                  console.log("No events inserted.");
                }

              });
            }

            function insertSingleRequest(ev) {
              var resource = {
                "summary": ev[0],
                "location": ev[4],
                "colorId": ev[3],
                "start": {
                  "dateTime": ev[1] //e.g. "2015-12-23T10:00:00.000-07:00"
                },
                "end": {
                  "dateTime": ev[2] //e.g. "2015-12-23T17:25:00.000-07:00"
                }
              };

              return gapi.client.calendar.events.insert({
                'calendarId': localStorage.createdCalendarId,
                'resource': resource
              });
            }

            function getDayEventsFromCluster(geocodedAddresses, oneDayDatset, eps=100, minPts=3, debug) {

              var dbscan = new DBSCAN();
              var clusters = dbscan.run(oneDayDatset, eps, minPts, haversineDistance);
              var noiseValues = getClusterValues(dbscan.noise, oneDayDatset);

              console.log("noise indices points(", dbscan.noise.length, ") pts:", dbscan.noise);
              console.log("Actual noise values:", noiseValues);

              var label = "PLACE**";
              var eventColorId = 11;
              for (var i = 0; i < noiseValues.length; i++) {
                var point = noiseValues[i];
                var latLng = point[0] + "," + point[1];
                var eventTime = new Date(point[2]);
                noiseValues[i] = [label, eventTime, eventTime, eventColorId, latLng];

                console.log("noise date: ", eventTime);
              }

              if (debug) {
                console.log("Number of clusters:", clusters.length);
              }

              var sortedCentroidCluster = {};
              var values;
              var centroid;
              var centroidKey;

              clusters.forEach(function (cluster) {
                values = getClusterValues(cluster, oneDayDatset);
                centroid = getCentroid(values);
                centroidKey = centroid.toString();
                sortedCentroidCluster[centroidKey] = sortByTimestamp(values);

                if (debug) {
                  console.log("centroid:", centroid);
                }

              });

              if (debug) {
                console.log("centroidCluster = ", sortedCentroidCluster);
                console.log("Ended DB Scan");
                console.log("------------------");
              }

              //
              // find the cluster that user address falls into
              //
              var arrLatLng;
              var labelClusterValues;
              var listLatLng;
              var events;
              var eventLabel;
              var results;
              var allDayEvents = [];

              for (var label in geocodedAddresses) {
                if (geocodedAddresses.hasOwnProperty(label)) {

                  listLatLng = geocodedAddresses[label];
                  for (var i = 0; i < listLatLng.length; i++) {
                    arrLatLng = listLatLng[i];
                    results = getLabelClusterValues(arrLatLng, sortedCentroidCluster);
                    if (results.length > 0) {
                      delete sortedCentroidCluster[results[0].toString()];
                      labelClusterValues = results[1];

                      if (debug) {
                        console.log("====================");
                      }

                      helper.assert(labelClusterValues.length > 3, "DBSCAN should have min of 3 values");
                      eventLabel = label + ';' + arrLatLng;
                      events = getEvents(eventLabel, labelClusterValues);
                      allDayEvents.push(events);

                      if (debug) {
                        console.log("summarized duration (", label, "):", events);

                        var eventItem;
                        for (var i = 0; i < events.length; i++) {
                          eventItem = events[i];
                          console.log(eventItem[0], "::::::::", eventItem[1], "-", eventItem[2]);
                        }
                      }

                    }
                  }
                }
              }

              // add other places that user didn't specify
              var count = 1;
              var clusterLabel;
              for (var centroid in sortedCentroidCluster) {
                clusterLabel = "PLACE" + count + ';' + '8' + ';' + centroid; //PLACE1;colorId;lat,lng
                if (count === 1) {
                  console.log("debug for place", count);
                }
                events = getEvents(clusterLabel, sortedCentroidCluster[centroid]);
                allDayEvents.push(events);
                count++;

                if (debug) {
                  console.log("summarized duration (", clusterLabel, "):", events);

                  var eventItem;
                  for (var i = 0; i < events.length; i++) {
                    eventItem = events[i];
                    console.log(eventItem[0], "::::::::", eventItem[1], "-", eventItem[2]);
                  }
                }
              }

              //add noiseValues to allDayEvents because of people who have sparse data esp for iOS
              // allDayEvents.push(noiseValues);

              return allDayEvents;
            }

            function haversineDistance(x, y) {
              var lat1 = x[0];
              var lon1 = x[1];
              var lat2 = y[0];
              var lon2 = y[1];

              var p = 0.017453292519943295;    // Math.PI / 180
              var c = Math.cos;
              var a = 0.5 - c((lat2 - lat1) * p) / 2 +
                  c(lat1 * p) * c(lat2 * p) *
                  (1 - c((lon2 - lon1) * p)) / 2;

              // return distance in meters
              return 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
            }

            function getClusterValues(cluster, dataset) {
              var clusterValues = [];
              var item;

              for (var i = 0; i < cluster.length; i++) {
                item = cluster[i];
                clusterValues.push(dataset[item]);
              }

              return clusterValues;
            }

            function getCentroid(clusterValues) {
              var centroid = [0, 0];
              var item;
              var numOfPoints = clusterValues.length;

              for (var i = 0; i < numOfPoints; i++) {
                item = clusterValues[i];
                centroid[0] += item[0];
                centroid[1] += item[1];
              }

              centroid[0] /= (1.0 * numOfPoints);
              centroid[1] /= (1.0 * numOfPoints);

              return centroid;
            }

            function sortByTimestamp(cluster) {
              var clusterToSort = [];
              var result = [];
              var item;

              // convert to fortmat that allows use to use sortBy
              for (var i = 0; i < cluster.length; i++) {
                item = cluster[i];
                clusterToSort.push({lat: item[0], lng: item[1], timestampMs: item[2]});
              }
              clusterToSort = _.sortBy(clusterToSort, 'timestampMs');

              for (var i = 0; i < clusterToSort.length; i++) {
                item = clusterToSort[i];
                result.push([item.lat, item.lng, new Date(item.timestampMs)]);
              }

              return result;
            }

            function getLabelClusterValues(arrLatLng, centroidCluster, eps=100) {
              var keyLatLng;
              var result = [];
              for (var key in centroidCluster) {
                if (centroidCluster.hasOwnProperty(key)) {

                  keyLatLng = key.split(",");
                  keyLatLng = [parseFloat(keyLatLng[0]), parseFloat(keyLatLng[1])];

                  if (haversineDistance(keyLatLng, arrLatLng) < eps) {
                    result = [key, centroidCluster[key]];
                    break;
                  }
                }
              }

              return result;
            }

            function getEvents(labelKey, sortedLocValues) {

              var results = [];
              var eventBegin;
              var prevItem, currItem;
              var maxDiff = 15; // time in minutes
              maxDiff = maxDiff * 60 * 1000; //convert to microseconds
              var duration;
              var index;
              var sortedLen = sortedLocValues.length;
              var labels = labelKey.split(';');
              var eventLabel = labels[0];
              var colorId = labels[1];
              var latLng = labels[2];


              index = 0;
              while (index < sortedLen - 1) {
                eventBegin = sortedLocValues[index];

                for (var i = index + 1; i < sortedLen; i++) {
                  prevItem = sortedLocValues[i - 1];
                  currItem = sortedLocValues[i];
                  duration = currItem[2] - prevItem[2];

                  if (duration > maxDiff) {
                    results.push([eventLabel, eventBegin[2], prevItem[2], colorId, latLng]); //label, beginTime, endTime
                    eventBegin = currItem;
                  }

                  if (i === sortedLen - 1 && duration <= maxDiff) {
                    results.push([eventLabel, eventBegin[2], currItem[2], colorId, latLng]);
                  } else if (i === sortedLen - 1 && duration > maxDiff) {
                    results.push([eventLabel, prevItem[2], prevItem[2], colorId, latLng]);
                    results.push([eventLabel, currItem[2], currItem[2], colorId, latLng]);
                  }

                  index = i;
                }
              }

              return results;
            }


            // cluster locations into different categories within margin of error
            var listOfLatLng,
                latLng,
                foundLabel,
                marginError = 200;

            data.forEach(function (row) {
              foundLabel = false;

              for (var label in geocodedAddresses) {
                if (geocodedAddresses.hasOwnProperty(label)) {
                  listOfLatLng = geocodedAddresses[label];

                  for (var i = 0; i < listOfLatLng.length; i++) {
                    latLng = listOfLatLng[i];

                    if (distance(latLng[0], latLng[1], row.latitudeE7, row.longitudeE7) <= marginError) {
                      row.locationLabel = label;
                      foundLabel = true;
                      break;
                    }
                  }

                  if (foundLabel) {
                    break;
                  }

                }
              }

              if (!foundLabel) {
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
              // if (ev.summary.indexOf('OTHER') > -1) {
              ev.location = "(" + ev.location.lat + ", " + ev.location.lng + ")";
              // }

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
                if (allEventsForDay === -1) {
                  console.log("error seen here: allEventsForDay == -1");
                  helper.updateStatus("Something just went wrong. Please contact Admin.");
                  helper.modifyDiv('date-output', 'hide');
                  break;
                }
                // allEventsForDay = compressAndFilter(allEventsForDay);

                // todo: @remove
                // put batch insert on hold
                // if (allEventsForDay.length > 0) {
                //   batchInsert = gapi.client.newBatch();
                //   for (var i = 0; i < allEventsForDay.length; i++) {
                //     requestToInsert = insertRequest(allEventsForDay[i]);
                //     batchInsert.add(requestToInsert);
                //     insertCounter++;
                //   }
                //
                //   batchInsert.execute(function () {
                //   });
                // }
              }
            }

            // todo: @remove
            // if (insertCounter > 0) {
            //   console.log("Total events inserted:", insertCounter);
            //   $('#date-output').html(localStorage.dateText);
            // } else {
            //   console.log("No events inserted.");
            // }

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
                  latLng,
                  eventColorId,
                  prevLocObject,
                  tmpStore = [],
              // threshold,
              // duration,
                  counter = 0;

              // threshold = 0; // number in minutes
              tmpStore.push(dayData[0]);

              for (var i = 1; i < dayData.length; i++) {
                currentLocObject = dayData[i];
                prevLocObject = dayData[i - 1];

                //check that events are actually close enough before tagging them as same bucket
                // duration = (currentLocObject.timestampMs - prevLocObject.timestampMs) / (1000.0 * 60);

                // if (currentLocObject.locationLabel === 'other' && duration < threshold) {
                //   continue;
                // }

                if (currentLocObject.locationLabel === prevLocObject.locationLabel && i !== dayData.length - 1) {

                  // 'other' could be midpoint between first and last
                  // or first point or just last point
                  // if (currentLocObject.locationLabel === 'other' && duration > threshold) {
                  // if (currentLocObject.locationLabel === 'other') {
                  //   currentLocObject = prevLocObject;
                  // }

                  tmpStore.push(currentLocObject);
                } else {
                  firstItem = tmpStore[0];
                  lastItem = tmpStore[tmpStore.length - 1];

                  if (!firstItem || !lastItem) {
                    counter++;
                    continue; //minor tweak to temporary avoid bug
                  }

                  latLng = {lat: firstItem.latitudeE7, lng: firstItem.longitudeE7}; //TODO: change input passed

                  // color id can only be from string '1' to '11' to get valid event color
                  // '8'('grey') used for category that doesn't exist
                  locLabel = firstItem.locationLabel.toUpperCase();
                  eventColorId = JSON.parse(localStorage.getItem('labelColors'));
                  eventColorId = (locLabel !== 'OTHER') ? eventColorId.indexOf(firstItem.locationLabel) : '8';

                  timeDiff = (lastItem.timestampMs - firstItem.timestampMs) / (1000 * 60 * 60);
                  if (timeDiff < 1.67) {
                    timeDiff = 60 * timeDiff;
                    locLabel = firstItem.locationLabel.toUpperCase() + '(~ ' + timeDiff.toFixed(0) + ' mins)';
                  } else {
                    locLabel = firstItem.locationLabel.toUpperCase() + '(~ ' + timeDiff.toFixed(1) + ' hrs)';
                  }

                  resource = createResource(
                      new Date(firstItem.timestampMs),
                      new Date(lastItem.timestampMs),
                      locLabel, latLng, eventColorId, timeDiff, firstItem.locationLabel
                  );
                  allResourcesForDay.push(resource);

                  // reset tmpStore to store next location
                  tmpStore = [];
                }
              }

              return allResourcesForDay;
            }

            function createResource(startTime, endTime, summary, location, colorId, tdiff, label) {
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
                "label": label
              };
            }


            function compressAndFilter(allEv) {

              var tmpArr,
                  lastEntry,
                  currEv,
                  timeDiff,
                  ev,
                  resultsArr;


              if (allEv.length < 1) {
                return [];
              }

              tmpArr = [];
              tmpArr.push(allEv[0]);

              for (var i = 1; i < allEv.length; i++) {
                lastEntry = tmpArr[tmpArr.length - 1];
                currEv = allEv[i];

                if (lastEntry.label === currEv.label) {
                  lastEntry.end = currEv.end;
                } else if ((lastEntry.label !== currEv.label) && (currEv.timediff === 0)) {

                  if (allEv[i + 1]) { // if next is same as current event label then accept zero as timediff
                    if ((allEv[i + 1].label === currEv.label) && allEv[i + 1].label !== "other") {
                      tmpArr.push(currEv); // "don't ignore because next event has same label as this: currEv.label
                    }
                    else if (allEv[i + 2]) {
                      if ((allEv[i + 2].label === currEv.label) && allEv[i + 2].label !== "other") {
                        tmpArr.push(currEv); // don't ignore because next TWO event has same label as this: currEv.label
                      }
                    }
                  }
                } else if ((lastEntry.label !== currEv.label) && (currEv.label === "other")) { // home-other-home == home-home
                  if (allEv[i + 1]) {
                    if (allEv[i + 1].label === lastEntry.label) {
                      lastEntry.end = currEv.end; // extending with label from 'OTHER'
                    }
                  }
                } else {
                  tmpArr.push(currEv);
                }
              }

              //update summary and delete irrelevant fields
              resultsArr = [];
              for (var i = 0; i < tmpArr.length; i++) {
                ev = tmpArr[i];
                ev.summary = ev.summary.split('(')[0];
                timeDiff = (ev.end.dateTime - ev.start.dateTime) / (1000 * 60 * 60);

                if (timeDiff > 0) {

                  if (timeDiff < 1.67) {
                    timeDiff = 60 * timeDiff;
                    ev.summary += '(~ ' + timeDiff.toFixed(0) + ' mins)';
                  } else {
                    ev.summary += '(~ ' + timeDiff.toFixed(1) + ' hrs)';
                  }

                  delete ev.label;
                  delete ev.timediff;
                  resultsArr.push(ev);
                }

              }
              return resultsArr;
            } //compressAndFilter


          } //analyzeData
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
          var loc = document.location.toString().split('#')[0]

          document.location = loc + '#' + anchor;
          return false;
        },

        modifyDiv: function (div, action) {
          var divElement = document.getElementById(div);
          (action === 'hide') ? divElement.style.display = 'none' : divElement.style.display = 'block';
        },

        openFullCalendarView: function () {
          window.open(localStorage.fullCalendarViewURL || 'http://calendar.google.com', '_blank');
        },

        resetFileupload: function () {
          $('#file').val('');
        },

        updateStatus: function (msg) {
          var error = msg || '';
          helper.resetFileupload();
          helper.modifyDiv('working-div', 'hide');
          helper.modifyDiv('calendar-div', 'hide');
          helper.updateDiv('uploadStatus', error, 'red');
        },

        updateDiv: function (div, message, color) {
          $('#' + div).text(message);
          $('#' + div).css('color', color);
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
              placeholder: 'enter label of place e.g. home, school, gym',
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
          localStorage.placeId = placeLabel.split("placeLabel")[1];

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
          delete localStorage["placeLabel" + inputName.split("placeAddress")[1]]; //e.g. placeLabel8
          updateLabelsOfPlaces();
        });

      }


      // cluster addresses with same label
      // {
      //    home: [address1],
      //    hobby: [address1, address2],
      //    school: [address1, address2, address3]
      // }
      function getClusteredPlaces() {

        var clusteredPlaces = {},
            label,
            addr;

        for (var entry in localStorage) {

          if (entry.indexOf('Label') > -1) {

            if (entry.indexOf('defaultLabel') > -1) {
              addr = 'defaultAddress' + entry.substr(14);
            } else if (entry.indexOf('placeLabel') > -1) {
              addr = 'placeAddress' + entry.substr(10);
            }

            addr = localStorage[addr];
            label = localStorage[entry];

            if (!clusteredPlaces[label]) {
              clusteredPlaces[label] = [addr];
            } else {
              clusteredPlaces[label].push(addr);
            }

          }
        }

        return clusteredPlaces;
      }

    }(gapi, jQuery, prettySize, _)
);


//TODO: remove locations where user was moving or not stationary
//TODO: people don't know what to view or expect when the calendar finally pops up
//TODO: remove illegal characters from text input of addresses or labels

//TODO: compressFilter doesn't account for hour jumps between two times. For instance, if I was at home at 10am and
// TODO: compressFilter cont'd: then no location recorded again until 2pm. Then compressFilter assumes I was home from 10am to 2pm, which might be
//TODO: compressFilter cont'd:  inaccurate especially if my phone was off or if I just went somewhere else.

//TODO: smooth out compressFilter: remove locations with short amount of time (threshold of 3 minutes is fine)
// TODO: remove non-still location

//TODO: don't use both green and red colors.


//TODO: if difference between start and stop time is less than 3 minutes then throw the event away
// add lat,lng to the event that you've created
//TODO: fix picking up thai restaurant
//check that your clustering is by day
