/*global angular*/
var app = angular.module('plunker', ['pc035860.scrollRange']);

app.controller('MainCtrl', function($scope) {
  $scope.rangeStart = 0;
  $scope.rangeEnd = -1;
});
