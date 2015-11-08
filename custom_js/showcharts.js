/**
 * Created by fnokeke on 11/7/15.
 */
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

$(function () {
    window.chart = new Highcharts.Chart({
        chart: {
            renderTo: 'graph',
            defaultSeriesType: 'bar'
        },
        xAxis: {
            categories: ['Total'],
            labels: {
                enabled: false
            }
        },
        plotOptions: {
            series: {
                allowPointSelect: true,
                stacking: 'normal'
            }
        },
        series: [{
            id: 'positive',
            name: 'Positive',
            data: [29.9],
            color: 'blue',
            stack: 'total',
            states: {
                select: {
                    color: 'green'
                }
            }
        }, {
            id: 'negative',
            name: 'Negative',
            data: [-130.4],
            color: 'blue',
            stack: 'total',
            states: {
                select: {
                    color: 'red'
                }
            }
        }]
    });



});