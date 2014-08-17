angular.module('app.digest-count', [])

.directive('digestCount', function ($rootScope) {
  return {
    restrict: 'EA',
    template: '<div style="position: fixed; top: 0; left: 0; z-index: 65535; color: rgb(111, 111, 255); text-shadow: 0 0 1px rgba(255, 255, 255, 0.6); line-height: 1.6; font-size: 24px; padding: 6px 12px;" title="digest count">digest: <span></span></div>',
    link: function (scope, iElm, iAttrs) {
      var count = 0, dereg;

      dereg = $rootScope.$watch(function () {
        iElm.find('span').text(++count);
      });

      iElm.bind('$destroy', function () {
        if (dereg) {
          dereg();
        }
      });
    }
  };
});
