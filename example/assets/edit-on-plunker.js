(function (module) {

var DEFAULT_CACHE_KEY = 'pc035860';

var getCache = function ($cacheFactory) {
  var ID = 'to-plunker';
  return $cacheFactory.get(ID) || $cacheFactory(ID);
};

module

.directive('toPlunker', function ($cacheFactory) {
  return {
    link: function postLink(scope, iElm, iAttrs) {
      var scriptPathsCache, cache, cacheKey;

      if (iElm[0].tagName === 'SCRIPT' && angular.isDefined(iAttrs.toPlunker)) {
        scriptPathsCache = getCache($cacheFactory);
        cacheKey = iAttrs.toPlunker || DEFAULT_CACHE_KEY;

        cache = scriptPathsCache.get(cacheKey);
        if (!cache) {
          cache = [];
        }
        cache.push(iAttrs.src);

        scriptPathsCache.put(cacheKey, cache);
      }
    }
  };
})

.directive('editOnPlunker', function (openPlunker, $document, $q, $http, $cacheFactory) {
  return {
    restrict: 'EA',
    template: '<button class="btn btn-default" style="position:fixed; z-index: 65535; top: 8px; left: 50%; margin-left: -61px;" ng-click="edit()">Edit on Plunker</button>',
    replace: true,
    scope: {
      id: '@',
      getFiles: '&files',
      description: '@',
      getTags: '&tags'
    },
    link: function postLink(scope, iElm, iAttrs) {
      var preparePromise = prepareFiles();

      scope.edit = function () {
        var description = scope.description || $document[0].title,
            tags = (scope.getTags || angular.noop)() || [];

        preparePromise.then(function (fileObjs) {
          openPlunker(fileObjs, description, tags);
        });
      };

      function prepareFiles () {
        var scriptPathsCache = getCache($cacheFactory),
            cacheKey = scope.id || DEFAULT_CACHE_KEY,
            scripts = scriptPathsCache.get(cacheKey),
            files = scope.getFiles(),
            promises = [];

        if (scripts && angular.isArray(scripts)) {
          files = files.concat(scripts);
        }

        angular.forEach(files, function (path) {
          var promise = $http.get(path, {transformResponse: transformResponse})
            .then(function (res) {
              var content = res.data,
                  filename = getFilename(path);

              if (filename === 'index.html') {
                angular.forEach(scripts, function (scriptPath) {
                  content = content.replace(scriptPath, getFilename(scriptPath));
                });
              }

              return {
                filename: filename,
                content: content
              };
            });
          promises.push(promise);
        });

        return $q.all(promises);
      }

      function transformResponse(data, headerGetter) {
        return data;
      }

      function getFilename(path) {
        return path.substring(path.lastIndexOf('/') + 1);
      }
    }
  };
})

.factory('formPostData', function ($document) {
  return function(url, fields) {
    var form = angular.element('<form style="display: none;" method="post" action="' + url + '" target="_blank"></form>');
    angular.forEach(fields, function(field) {
      var name = field.name,
          value = field.value;

      var input = angular.element('<input type="hidden" name="' +  name + '">');
      input.attr('value', value);
      form.append(input);
    });
    $document.find('body').append(form);
    form[0].submit();
    form.remove();
  };
})

.factory('openPlunker', function (formPostData) {
  return function (files, description, tags) {
    var postData = [];

    description = description || '';
    tags = tags || [];

    angular.forEach(files, function (file) {
      postData.push({
        name: 'files[' + file.filename + ']',
        value: file.content
      });
    });

    angular.forEach(tags, function (tag) {
      postData.push({
        name: 'tags[]',
        value: tag
      });
    });

    postData.push({
      name: 'private',
      value: true
    });
    postData.push({
      name: 'description',
      value: description
    });

    formPostData('http://plnkr.co/edit/?p=preview', postData);
  };
});


})(angular.module('app.edit-on-plunker', []));
