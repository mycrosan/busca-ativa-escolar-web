(function() {

	angular.module('BuscaAtivaEscolar').directive('lastMonthTimeline', function (moment, Platform, Reports, Charts) {

		var timelineData = {};
		var timelineChart = {};
		var timelineReady = false;

		function fetchTimelineData() {
			var lastMonth = moment().subtract(30, 'days').format('YYYY-MM-DD');
			var today = moment().format('YYYY-MM-DD');

			return Reports.query({
				view: 'time_series',
				entity: 'children',
				dimension: 'child_status',
				filters: {
					date: {from: lastMonth, to: today},
					case_status: ['in_progress', 'completed', 'interrupted'],
					alert_status: ['accepted']
				}
			}, function (data) {
				timelineData = data;
				timelineChart = getTimelineChart();
				timelineReady = true;
			});
		}

		function getTimelineChart() {
			var report = timelineData.response.report;
			var chartName = 'Evolução do status dos casos nos últimos 30 dias';
			var labels = timelineData.labels ? timelineData.labels : {};

			return Charts.generateTimelineChart(report, chartName, labels);

		}

		function getTimelineConfig() {
			if(!timelineReady) return;
			return timelineChart;
		}

		function init(scope, element, attrs) {
			scope.getTimelineConfig = getTimelineConfig;
		}

		Platform.whenReady(function () {
			fetchTimelineData();
		});

		return {
			link: init,
			replace: true,
			templateUrl: '/views/components/last_month_timeline.html'
		};
	});

})();