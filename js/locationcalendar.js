/**
 * Created by fnokeke on 1/9/16.
 */

var
    workOffline = false,

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
                utility.modifyDiv("welcome-div", 'hide');
                utility.modifyDiv("source-div", 'show');
                $('#sourceStatus').text('Calendar authorization successful!');
                $('#sourceStatus').css('color', 'green');
            });
        }
    },

    ui = {

        run: function () {
            ui.processUI();
        },

        processUI: function () {
            var locSource;

            // first find out if user's location data is from mobility or Google Takeout
            locSource = $('input:radio[name=source]:checked').val();
            if (locSource === undefined) {
                $('#sourceStatus').text('You need to select an option.');
                $('#sourceStatus').css('color', 'red');
                return;
            }
            utility.modifyDiv('source-div', 'hide');

            // users have to upload their data if using Google Location Data
            // otherwise mobility data is fetched online using the public api
            // hide field when data uploaded
            if (locSource === 'yes') {
                utility.modifyDiv('upload-div', 'show');
                ui.getUploadedData(function (data) {
                    ui.processUploadedData(data);
                });
            } else {
                utility.modifyDiv('mobility-div', 'show');

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
                dsuAnalysis.fetchDataForDate(dsuDates);
            }
        },

        getUploadedData: function (callback) {

            $('#file').change(function () {
                if (!this.files[0]) return;
                utility.modifyDiv('working', 'show');

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
                    var data;
                    try {
                        data = getLocationDataFromJson(e.target.result);
                        status('File loaded successfully! (' + fileSize + ')', 'green');
                    } catch (ex) {
                        utility.modifyDiv('working', 'hide');
                        status('Something went wrong generating your location entries. Ensure you\'re uploading a ' +
                            'Google Takeout JSON file that contains location data and try again. ' +
                            '(error: ' + ex.message + ')', 'red');
                        return;
                    }
                    callback(data);
                };

                reader.onerror = function () {
                    utility.modifyDiv('working', 'hide');
                    status('Something went wrong reading your JSON file. ' +
                        'Ensure you\'re uploading a "direct-from-Google" JSON file and try again. ' +
                        '(error: ' + reader.error + ')', 'red');
                };

                reader.readAsText(file);
            });
        },

        processUploadedData: function (uploadedData) {

            utility.modifyDiv('working', 'hide');
            utility.modifyDiv('address-div', 'show');

            $('#btnAddress').click(useInputProvided);
            function useInputProvided() {
                var
                    home,
                    work,
                    hobby,
                    allMappedAddresses,
                    daysCount,
                    getLatLng;

                home = $('#homeAddress').val();
                work = $('#workAddress').val();
                hobby = $('#hobbyAddress').val();
                daysCount = $('#daysCount').val();

                if (home === '' || work === '' || hobby === '' || daysCount === '') {
                    $('#addressStatus').text('Please complete all fields.');
                    $('#addressStatus').css('color', 'red');
                } else {
                    $('#addressStatus').text('Input verified successfully!');
                    $('#addressStatus').css('color', 'green');

                    utility.modifyDiv('upload-div', 'hide');
                    utility.modifyDiv('address-div', 'hide');
                    utility.modifyDiv('calendar-div', 'show');
                    utility.modifyDiv('working', 'show');

                    // for test purposes, override entries with fixed addresses
                    allMappedAddresses = {
                        "home": home,
                        "work": work,
                        "hobby": hobby
                    };

                    // convert full addresses to lat,lon
                    getLatLng = function (allMappedAddresses, callback) {

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
                    getLatLng(allMappedAddresses, function (geocodedAddresses) {
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
                            console.log("sorted uploaded data:", data);

                            // reduce data to only last N days
                            // for testing purposes you can override input with custom noOfDays
                            dateOfLastDay = new Date(data[data.length - 1].timestampMs);
                            lastDayTimestamp = dateOfLastDay.getTime();
                            nDaysAgoTimestamp = dateOfLastDay.setDate(dateOfLastDay.getDate() - noOfDays);

                            data = data.filter(function (row) {
                                return (row.timestampMs >= nDaysAgoTimestamp) && (row.timestampMs <= lastDayTimestamp);
                            });

                            console.log(
                                "Extract data for (", noOfDays, "days):\n",
                                new Date(nDaysAgoTimestamp), "-", new Date(lastDayTimestamp));

                            /*
                             * ignore locations with accuracy over 1000m
                             */
                            data = data.filter(function (row) {
                                return row.accuracy <= 1000;
                            });

                            /*
                             * ignore all locations outside city
                             */
                            city = [42.446594, -76.493736];
                            cityLatMargin = 0.1;
                            cityLonMargin = 1.0;

                            data = data.filter(function (row) {
                                return Math.abs(row.latitudeE7 - city[0]) <= cityLatMargin &&
                                    Math.abs(row.longitudeE7 - city[1]) <= cityLonMargin
                            });

                            // determine if location falls into specific location label such as home, work, etc
                            HOME = addresses.home;
                            HOBBY = addresses.hobby;
                            WORK = addresses.work;

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
                            createdCalendarSummary = 'My Location Calendar';
                            if (localStorage.createdCalendarId === undefined) {
                                createCalendar(createdCalendarSummary).then(function (result) {
                                    console.log("create calendar response:", result);
                                    resetThenInsertNewEvents(localStorage.createdCalendarId, data);
                                });
                            } else {
                                var request = gapi.client.calendar.calendars.get({
                                    'calendarId': localStorage.createdCalendarId
                                });
                                request.execute(function (resp) {

                                    if (resp.code === 404) {
                                        console.log("404: CalendarId not found. Creating one...");
                                        createCalendar(createdCalendarSummary).then(function (result) {
                                            console.log(result);
                                            resetThenInsertNewEvents(localStorage.createdCalendarId, data);
                                        });
                                    } else {
                                        console.log("Calendar exists and everything is fine.");
                                        resetThenInsertNewEvents(localStorage.createdCalendarId, data);
                                    }
                                });
                            }

                            //TODO: fix bug for newly created calendar
                            function createCalendar(calendarSummary) {
                                var request;

                                return new Promise(function (resolve, reject) {
                                    utility.assert(gapi.client.calendar !== undefined, "create new calendar test.");
                                    request = gapi.client.calendar.calendars.insert({
                                        'summary': calendarSummary
                                    });

                                    request.execute(function (resp) {
                                        if (resp === undefined) {
                                            var msg = "error making calendar: " + resp;
                                            reject(msg);
                                        } else {
                                            var msg = "Successful in creating calendar: " + createdCalendarSummary;
                                            resolve(msg);
                                            localStorage.createdCalendarId = resp.result.id;
                                            localStorage.createdCalendarSummary = calendarSummary;
                                        }
                                    });
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
                                        var urlRequest = "http://api.geonames.org/findNearestAddressJSON?lat=" +
                                            ev.location.lat + "&lng=" + ev.location.lng + "&username=fnokeke";

                                        if (ev.location === 'home' || ev.location === 'work' || ev.location === 'hobby') {
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

                                                insertRequest = gapi.client.calendar.events.insert({
                                                    'calendarId': localStorage.createdCalendarId,
                                                    'resource': ev
                                                });
                                                insertRequest.execute();
                                            });
                                        }
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
                                    var dateStr = new Date(lastDayTimestamp);
                                    dateStr = extractDate(dateStr);
                                    dateStr = dateStr.replace(/-/g, ''); //yyyymmdd

                                    var url =
                                        "https://www.google.com/calendar/render?tab=mc&date=" + dateStr + "&mode=week";
                                    window.location.href = url;
                                });
                            }


                        }
                        doCalendarOperations(geocodedAddresses, uploadedData, daysCount);
                    });
                }
            }

            //TODO: check if calendar exists before continue other operations
            // TODO: batch events
            // TODO: add timezone to calendar
            // TODO: clear calendar then reload event
            //TODO: set calendar timezone
            //TODO: remove locations where user was moving or not stationary
        },

    },

    dsuAnalysis = {

        run: function () {
            dsuAnalysis.runOffline();

            if (!workOffline) {
            }
        },

        processDSU: function (callback) {
            callback("random data coming soon");
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
        }


    },

    utility = {

        modifyDiv: function (div, action) {
            var divElement = document.getElementById(div);
            (action === 'hide') ? divElement.style.display = 'none' : divElement.style.display = 'inline';
        },

        assert: function (condition, message) {
            if (!condition) throw new Error(message)
            else console.log("Passed: ", message);
        }
    };

