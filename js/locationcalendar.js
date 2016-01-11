/**
 * Created by fnokeke on 1/9/16.
 */

var workOffline = true;

var gCal = {

    CLIENT_ID: '176049196616-koqftr6rrmlk91m5ssqdnbbe2cfdgsul.apps.googleusercontent.com',
    SCOPES: ["https://www.googleapis.com/auth/calendar"],

    run: function () {
        if (!workOffline) {
            gCal.checkAuth();
        }
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
     * Load Google Calendar client library. List upcoming events TODO: remove comment
     * once client library is loaded.
     */
    loadCalendarApi: function () {
        gapi.client.load('calendar', 'v3', function () {
            console.log("loadCalAPI here ");
        });
    }
};
gCal.run();

var ui = {

    run: function () {
        ui.executeAllCalendarOperations();
    },

    executeAllCalendarOperations: function () {
        console.log("did call it fine");

        var home = $('#homeAddress').val();
        var work = $('#workAddress').val();
        var hobby = $('#hobbyAddress').val();
        var daysCount = $('#daysCount').val();

        /* do not move past this until user provides all addresses */
        if (index === '' || work === '' || hobby === '' || daysCount === '') {
            $('#addressStatus').text('Please enter valid addresses');
            $('#addressStatus').css('color', 'red');
            return;
        }
        $('#addressStatus').text('Addresses successfully entered!');
        $('#addressStatus').css('color', 'green');

        /* remove user fields since it should be a one-time event */
        var addressDiv = document.getElementById('address-div');
        addressDiv.style.display = 'none';

        var allMappedAddresses = {
            "home": "308 University Ave, Ithaca, NY, 14850",
            "work": "Bill and Melinda Gates Hall, Ithaca, NY 14853",
            "hobby": "65 Woodcrest Ave, Ithaca, NY 14850",
        };

        var getLatLng = function (allMappedAddresses, callback) {
            var coords = {};
            var counter = 0;
            var addresses = _.values(allMappedAddresses);

            var getKey = function (obj, value) {
                for (var key in obj) {
                    if (obj[key] === value)
                        return key;
                }
                return "error getting key";
            }

            addresses.forEach(function (address) {
                counter++;

                var geocoder = new google.maps.Geocoder();
                geocoder.geocode({'address': address}, function (results, status) {

                    if (status == google.maps.GeocoderStatus.OK) {
                        var lat = results[0].geometry.location.lat();
                        var lng = results[0].geometry.location.lng();
                        var label = getKey(allMappedAddresses, address);
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

        getLatLng(allMappedAddresses, function (addresses) {
            console.log("allMappedAddresses:", allMappedAddresses);
            console.log("Received addresses:", addresses);
            doCalendarOperations(addresses);

            //TODO: change the dates used
            //var url = "https://www.google.com/calendar/render?tab=mc&date=20150918&mode=week";
            //window.location.href = url;
        });


        /**
         *
         * Print the summary and start datetime/date of the next ten events in
         * the authorized user's calendar. If no events are found an
         * appropriate message is printed.
         */
        function doCalendarOperations(addresses) {

            console.log("doCalendarOperations running");
            $(document).ready(function () {
                console.time('loaddata'); //TODO: remove

                $.getJSON('dataset/FabianLocationHistory.json', function (data) {
                    filterDataset(data);
                });

            });

            function filterDataset(data) {
                console.timeEnd('loaddata'); //TODO: remove
                console.time('filterDataset'); //TODO: remove

                data = data.locations;

                // TODO: testing template to be removed
                (function testing() {
                })();

                // TODO: use actual testing
                (function testing() {
                    if (data.length > 0) {
                        console.log("Data Load Test Passed!");
                        console.log("Number of rows:", data.length);
                    } else {
                        console.log("Data Load Test Failed!");
                    }
                })();

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
                var oldDataLen = data.length; //TODO: remove after passing test
                data = _.sortBy(data, 'timestampMs');

                // reduce data to only last N days
                var noOfDays = 30;
                var lastDay = "10-02-2015",
                    dateOfLastDay = new Date(lastDay),
                    lastDayTimestamp = dateOfLastDay.getTime(),
                    nDaysAgoTimestamp = dateOfLastDay.setDate(dateOfLastDay.getDate() - noOfDays);

                data = data.filter(function (row) {
                    return row.timestampMs >= nDaysAgoTimestamp &&
                        row.timestampMs <= lastDayTimestamp;
                });

                // TODO: use actual testing
                (function testing() {
                    var newDataLen = data.length;
                    var diff = oldDataLen - newDataLen;
                    if (diff > 0) {
                        console.log("2 Weeks Test Passed!");
                        console.log("Number of rows dropped:", diff);
                    } else {
                        console.log("2 Weeks Test Failed!");
                        console.log("Old Length:", oldDataLen);
                        console.log("New Length:", newDataLen);
                    }
                })();

                /*
                 * ignore locations with accuracy over 1000m
                 */
                data = data.filter(function (row) {
                    return row.accuracy <= 1000;
                });

                /*
                 * ignore all locations outside CITY
                 */
                var CITY = [42.446594, -76.493736],
                    cityLatMargin = 0.1,
                    cityLonMargin = 1.0;

                data = data.filter(function (row) {
                    return Math.abs(row.latitudeE7 - CITY[0]) <= cityLatMargin &&
                        Math.abs(row.longitudeE7 - CITY[1]) <= cityLonMargin
                });

                // determine if location falls into specific location label such as home, work, etc
                var HOME = addresses.home,
                    HOBBY = addresses.hobby,
                    WORK = addresses.work;

                var LAT_MARGIN = 0.00052,
                    LON_MARGIN = 0.0052;

                data.forEach(function (row) {
                    if (Math.abs(row.latitudeE7 - HOME[0]) < LAT_MARGIN &&
                        Math.abs(row.longitudeE7 - HOME[1]) < LON_MARGIN) {
                        row.locationLabel = 'home';
                    } else if (Math.abs(row.latitudeE7 - WORK[0]) < LAT_MARGIN &&
                        Math.abs(row.longitudeE7 - WORK[1]) < LON_MARGIN) {
                        row.locationLabel = 'work';
                    } else if (Math.abs(row.latitudeE7 - HOBBY[0]) < LAT_MARGIN &&
                        Math.abs(row.longitudeE7 - HOBBY[1]) < LON_MARGIN) {
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
                var createCalendar = function (calendarSummary) {

                    return new Promise(function (resolve, reject) {
                        var request = gapi.client.calendar.calendars.insert({
                            'summary': calendarSummary
                        });

                        request.execute(function (resp) {
                            if (resp === undefined) {
                                var msg = "error making calendar: " + resp;
                                reject(msg);
                            }
                            else {
                                var msg = "Successful in creating calendar: " + createdCalendarSummary;
                                resolve(msg);
                                localStorage.createdCalendarId = resp.result.id;
                                localStorage.createdCalendarSummary = calendarSummary;
                            }
                        });
                    });
                }

                var showClearThenBatchInsertEvents = function (calendarId, givenData) {

                    /*
                     * show all events
                     */
                    var request = gapi.client.calendar.events.list({
                        'calendarId': localStorage.createdCalendarId,
                        'showDeleted': false,
                        'singleEvents': true,
                        'orderBy': 'startTime'
                    });
                    request.execute(function (resp) {
                        var events = resp.result.items;
                        var text = "All Events Before Resetting " + localStorage.createdCalendarSummary;
                        appendPre('<h2>' + text + '</h2>');

                        if (events.length > 0) {
                            for (var i = 0; i < events.length; i++) {
                                var event = events[i];
                                var when = event.start.dateTime;
                                if (!when) {
                                    when = event.start.date;
                                }
                                appendPre(event.summary + ' (' + when + ')' + '<br/>');
                            }
                        } else {
                            appendPre('No upcoming events found.');
                        }
                    });

                    /*
                     * remove events to avoid creating duplicates when refreshing page during testing phase
                     */
                    deleteAllEvents(calendarId).then(function (deleteResp) {
                        console.log(deleteResp);

                        /*
                         * create new events where each event is time at each location of interest per day
                         * batch insert events to reduce HTTP overhead
                         * make sure calendar exists before you insert events
                         */
                        var dataForDay,
                            allEventsForDay,
                            request,
                            groupedByDayData = _.groupBy(givenData, 'date');

                        var reverseGeonamesThenInsertRequest = function (ev) {
                            var urlRequest = "http://api.geonames.org/findNearestAddressJSON?lat=" +
                                ev.location.lat + "&lng=" + ev.location.lng +
                                "&username=fnokeke";

                            $.getJSON(urlRequest, function (result) {

                                if (result.address !== undefined) {
                                    result = result.address;
                                    var address = [
                                        result.streetNumber + " " + result.street,
                                        result.placename,
                                        result.adminCode1,
                                        result.postalcode
                                    ];
                                    var reversedAddress = address.join(", ");
                                    console.log(reversedAddress);
                                    ev.location = reversedAddress;
                                } else if (result.status.message === "invalid username") {
                                    console.log("invalid username");
                                } else {
                                    console.log("uknown error:", result);
                                }

                                request = gapi.client.calendar.events.insert({
                                    'calendarId': localStorage.createdCalendarId,
                                    'resource': ev
                                });
                                request.execute();
                            });
                        }

                        var insertCounter = 0;
                        for (var selectedDay in groupedByDayData) {

                            dataForDay = groupedByDayData[selectedDay];
                            allEventsForDay = getAllDwellTime(dataForDay);

                            if (allEventsForDay.length > 0) {
                                for (var i = 0; i < allEventsForDay.length; i++) {
                                    reverseGeonamesThenInsertRequest(allEventsForDay[i]);
                                    insertCounter++;
                                }
                            }
                        }
                        console.log("Total events inserted:", insertCounter);

                    });
                }

                var createdCalendarSummary = 'My Location Calendar';
                if (localStorage.createdCalendarId === undefined) {

                    createCalendar(createdCalendarSummary).then(function (result) {
                        console.log(result);
                        showClearThenBatchInsertEvents(localStorage.createdCalendarId, data);
                    });
                }
                else {

                    var request = gapi.client.calendar.calendars.get({
                        'calendarId': localStorage.createdCalendarId
                    });

                    request.execute(function (resp) {

                        if (resp.code === 404) {
                            console.log("404: CalendarId not found. Creating one...");
                            createCalendar(createdCalendarSummary).then(function (result) {
                                console.log(result);
                                showClearThenBatchInsertEvents(localStorage.createdCalendarId, data);
                            });
                        }
                        else {
                            console.log("Calendar exists and everything is fine.");
                            showClearThenBatchInsertEvents(localStorage.createdCalendarId, data);
                        }
                    });
                }

                console.timeEnd('filterDataset');
                console.time('plots');
            }


            //TODO: check if calendar exists before continue other operations
            // TODO: batch events
            // TODO: add timezone to calendar
            // TODO: clear calendar then reload event
            //TODO: make sure that calendar exists before you check its events
            //TODO: set calendar timezone
            //TODO: remove locations where user was moving or not stationary
            //TODO: add colors to calendar events

        }

        //===================================
        //===== UTILITY FUNCTIONS ===========
        //===================================
        function appendPre(message) {
            var pre = document.getElementById('output');
            pre.innerHTML += message;
        }

        function deleteAllEvents(calendarId) {

            return new Promise(function (resolve) {
                var request = gapi.client.calendar.events.list({
                    'calendarId': calendarId,
                    'showDeleted': false,
                    'singleEvents': true,
                    'orderBy': 'startTime'
                });

                request.execute(function (resp) {
                    var events = resp.result.items;
                    if (events.length > 0) {
                        var batchDelete = gapi.client.newBatch();
                        for (var i = 0; i < events.length; i++) {
                            var event = events[i];
                            var request = deleteRequest(event.id);
                            batchDelete.add(request);
                        }
                        batchDelete.execute(function () {
                            var msg = "No of events deleted before loading new ones: " + events.length;
                            resolve(msg);
                        });
                    }
                    else {
                        var msg = "No events to delete.";
                        resolve(msg);
                    }
                });
            });
        }

        function createResource(startTime, endTime, summary, location, colorId) {
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

        function deleteRequest(eventId) {
            return gapi.client.calendar.events.delete({
                'calendarId': localStorage.createdCalendarId,
                'eventId': eventId
            });
        }

        function extractDate(date) {
            if (!(date instanceof Date))
                date = new Date(date);

            return ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2) + "-" +
                date.getFullYear();
        }

        function extractTime(date) {
            if (!(date instanceof Date))
                date = new Date(date);
            return roundToTwoDP(date.getHours() + date.getMinutes() / 60.0);
        }

        function getAllDwellTime(dayData) {

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
                tmpStore = [];

            tmpStore.push(dayData[0]);
            var counter = 0;
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
                        " (~ " + timeDiff + " hours)" +
                        " [" + firstItem.latitudeE7 + "," + firstItem.longitudeE7 + "]";

                    if (firstItem.locationLabel == "home")
                        colorId = "10"; //green
                    else if (firstItem.locationLabel == "work")
                        colorId = "11"; //red
                    else if (firstItem.locationLabel == "hobby")
                        colorId = "6"; //brown
                    else if (firstItem.locationLabel == "other")
                        colorId = "8"; //grey

                    resource = createResource(
                        new Date(firstItem.timestampMs),
                        new Date(lastItem.timestampMs),
                        locLabel, latlng, colorId);
                    allResourcesForDay.push(resource);

                    // reset tmpStore to store next location
                    tmpStore = [];
                }
            }
            console.log("no of minor tweaks done =", counter);

            return allResourcesForDay;
        }

        function roundToTwoDP(num) {
            return +(Math.round(num + "e+2") + "e-2");
        }
    }
};

var dsuAnalysis = {

    run: function () {
        dsuAnalysis.runOffline();
        dsuAnalysis.activateFileUpload();

        if (!workOffline) {
            dsuAnalysis.fetchDataForDate([]);
        }
    },

    runOffline: function () {

        $.getJSON('dataset/mobility_sample_andy.json', function (data) {
            console.log("No of days of data:", data.length);

            // use today as end date if custom end date is not provided
            var
                nDays = 3,
                endDate = '2015-12-20',
                todayTimestamp = (endDate !== '') ? new Date(endDate).getTime() : new Date().getTime(),
                dsuDates = [];

            for (var i = 0; i < nDays; i++) {
                var tmpDate = new Date(todayTimestamp - (i * 24 * 60 * 60 * 1000));
                tmpDate = tmpDate.toJSON().substring(0, 10); //YYYY-mm-dd
                dsuDates.push(tmpDate);
            }
            console.log("dsuDates:", dsuDates);

            var
                results = [],
                place = [34.0529931, -118.4443538];

            data.forEach(function (day) {
                if (dsuDates.indexOf(day.body.date) !== -1 && day.body.episodes) {
                    var episodes = day.body.episodes;
                    episodes.forEach(function (episode) {
                        if (episode.cluster) {
                            var ec = episode.cluster;
                            if (place[0] === ec.latitude && place[1] === ec.longitude) {
                                results.push([episode.start, episode.end]);
                            }
                        }
                    });
                }
            });
            console.log("results:", results);
        });
    },

    fetchDataForDate: function (dsuDates) {
        dsuDates.forEach(function (date) {
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

    activateFileUpload: function () {
        $('#file').change(function () {
            if (!this.files[0]) return;

            var file = this.files[0];
            console.log(file);
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
                status(percentLoaded + '% of ' + fileSize + ' loaded...', 'grey');
            };

            reader.onload = function (e) {
                var data;

                try {
                    data = getLocationDataFromJson(e.target.result);
                    status('File loaded successfully! (' + fileSize + ')', 'green');
                } catch (ex) {
                    status('Something went wrong generating your map. Ensure you\'re uploading a ' +
                        'Google Takeout JSON file that contains location data and try again. ' +
                        '(error: ' + ex.message + ')', 'red');
                    return;
                }
                console.log("data:", data);
            };

            reader.onerror = function () {
                status('Something went wrong reading your JSON file. ' +
                    'Ensure you\'re uploading a "direct-from-Google" JSON file and try again. ' +
                    '(error: ' + reader.error + ')', 'red');
            };

            reader.readAsText(file);
        });
    }

};
dsu.run();
