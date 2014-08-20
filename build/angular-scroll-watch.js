(function (module) {

  var DIR_STYLE = 'swStyle',
      DIR_CLASS = 'swClass',
      DIR_BROADCAST = 'swBroadcast';

  module

  .service('scrollWatchService', 
  ["$window", "$document", "$parse", "$log", "$rootScope", "$animate", function scrollWatchService($window, $document, $parse, $log, $rootScope, $animate) {
    var self = this;

    var $win = angular.element($window);

    // ref: http://davidwalsh.name/function-debounce
    var debounce = function (func, wait, immediate) {
      var timeout;
      return function() {
        var context = this, args = arguments;
        $window.clearTimeout(timeout);
        timeout = $window.setTimeout(function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        }, wait);
        if (immediate && !timeout) func.apply(context, args);
      };
    };

    var requestAnimFrame = (function () {
      return  $window.requestAnimationFrame       ||
              $window.webkitRequestAnimationFrame ||
              $window.mozRequestAnimationFrame    ||
              $window.oRequestAnimationFrame      ||
              $window.msRequestAnimationFrame     ||
              function(/* function */ callback, /* DOMElement */ element){
                $window.setTimeout(callback, 1000 / 60);
              };
    })();

    var objectSize = function (obj) {
      var c = 0;
      angular.forEach(obj, function () {
        c++;
      });
      return c;
    };

    var getDocumentHeight = function () {
      var doc = $document[0].documentElement,
          body = $document[0].body;

      return Math.max(
        body.scrollHeight, doc.scrollHeight,
        body.offsetHeight, doc.offsetHeight,
        doc.clientHeight
      );
    };
    var getWindowHeight = function () {
      var h1 = $document[0].documentElement.clientHeight,
          h2 = $window.innerHeight;
      if (h1 > h2) {
        return h2;
      }
      return h1;
    };
    var getWindowScrollTop = function () {
      return $window.pageYOffset;
    };

    var digest = (function () {
      var anim;

      var reBpCond = /((?:>|<)?=?)\s*?((?:-(?!p))|(?:p(?!-)))?(\d+)/;

      var _handleStyle,

          _handleClass, _addClasses, _removeClasses, 
          _digestClassCounts, _updateClasses,

          _handleBrdcst;

      /**
       * Style related functions
       */
      _handleStyle = function (local, config) {
        config.target.css(config.styleGetter(config.scope, local));
      };

      /**
       * Class related functions
       */
      _addClasses = function (config, classes) {
        var attr = config.attr;
        var newClasses = _digestClassCounts(config, classes, 1);
        attr.$addClass(newClasses);
      };
      _removeClasses = function (config, classes) {
        var attr = config.attr;
        var newClasses = _digestClassCounts(config, classes, -1);
        attr.$removeClass(newClasses);
      };
      _digestClassCounts = function (config, classes, count) {
        var element = config.target;
        var classCounts = element.data('$classCounts') || {};
        var classesToUpdate = [];
        angular.forEach(classes, function (className) {
          if (count > 0 || classCounts[className]) {
            classCounts[className] = (classCounts[className] || 0) + count;
            if (classCounts[className] === +(count > 0)) {
              classesToUpdate.push(className);
            }
          }
        });
        element.data('$classCounts', classCounts);
        return classesToUpdate.join(' ');
      };
      _updateClasses = function (config, oldClasses, newClasses) {
        var element = config.target;
        var toAdd = arrayDifference(newClasses, oldClasses);
        var toRemove = arrayDifference(oldClasses, newClasses);
        toRemove = _digestClassCounts(config, toRemove, -1);
        toAdd = _digestClassCounts(config, toAdd, 1);

        if (toAdd.length === 0) {
          $animate.removeClass(element, toRemove);
        } else if (toRemove.length === 0) {
          $animate.addClass(element, toAdd);
        } else {
          $animate.setClass(element, toAdd, toRemove);
        }
      };
      _handleClass = function (local, config) {
        var newVal = config.classGetter(config.scope, local),
            oldVal = config._oldClassVal;
        var newClasses = arrayClasses(newVal || []);
        if (!oldVal) {
          _addClasses(config, newClasses);
        }
        else if (!angular.equals(newVal, oldVal)) {
          var oldClasses = arrayClasses(oldVal);
          _updateClasses(config, oldClasses, newClasses);
        }
        config._oldClassVal = shallowCopy(newVal);
      };

      /**
       * Broadcast condition -> event
       */
      _handleBrdcst = function (local, config) {
        angular.forEach(config.brdcstList, function (v) {
          var active = v.condition(config.scope, local), funcName;
          if (v.wasActive === null || active !== v.wasActive) {
            funcName = config.brdcstIsEmit ? '$emit' : '$broadcast';
            config.brdcstScope[funcName](v.event, active, local);
          }
          v.wasActive = active;
        });
      };

      function _update(configId) {
        var positive, negative, numReverse, processConfig;

        var w_h = getWindowHeight(),
            d_h = getDocumentHeight(),
            maxScrollTop = d_h - w_h,
            scrollTop = getWindowScrollTop();

        positive = function (negative) {
          return maxScrollTop + negative;
        };
        negative = function (positive) {
          return positive - maxScrollTop;
        };
        numReverse = function (num) {
          return (num > 0) ? negative(num) : positive(num);
        };

        processConfig = function (config) {
          var from, to, localContext, progress;

          from = config.from < 0 ? positive(config.from) : config.from;
          to = config.to < 0 ? positive(config.to) : config.to;

          /**
           * Create local context
           */
          if (scrollTop < from) {
            progress = 0;
            localContext = {
              $positive: from,
              $negative: negative(from)
            };
          }
          else if (scrollTop > to) {
            progress = 1;
            localContext = {
              $positive: to,
              $negative: negative(to)
            };
          }
          else if (scrollTop >= from && scrollTop <= to) {
            progress = (scrollTop - from) / (to - from);
            localContext = {
              $positive: scrollTop,
              $negative: negative(scrollTop)
            };
          }

          localContext.$progress = progress;
          localContext.$percentage = progress * 100;

          if (!config._lastProgress || config._lastProgress === progress) {
            localContext.$direction = 0;
          }
          else if (config._lastProgress > progress) {
            localContext.$direction = -1;
          }
          else if (config._lastProgress < progress) {
            localContext.$direction = 1;
          }

          /**
           * Applying
           */
          // to style
          if (config.styleGetter) {
            _handleStyle(localContext, config);
          }

          // to class
          if (config.classGetter) {
            _handleClass(localContext, config);
          }

          // trigger breakpoints
          if (config.brdcstList) {
            _handleBrdcst(localContext, config);
          }

          config._lastProgress = progress;
        };

        if (angular.isUndefined(configId)) {
          angular.forEach(self.configs, processConfig);
        }
        else if (self.configs[configId]) {
          processConfig(self.configs[configId]);
        }
      }

      anim = false;

      return function ($event, configId) {
        if (anim && angular.isUndefined(configId)) {
          return;
        }

        anim = true;

        requestAnimFrame(function () {
          _update(configId);

          anim = false;
        });
      };
    }());
    var digestDebounced = debounce(digest, 50);

    this._configId = 0;

    this.configs = null;

    this.init = function () {
      this.configs = {};

      $win
      .bind('scroll', digest)
      .bind('resize', digest);
    };

    this.addConfig = function (config) {
      angular.forEach(['target', 'from', 'to'], function (key) {
        if (angular.isUndefined(config[key])) {
          throw new Error('`'+ key +'` should be provided');
        }
      });

      if (this.configs === null) {
        this.init();
      }

      this._configId++;

      if (config.styleExpr) {
        config.styleGetter = $parse(config.styleExpr);
      }
      if (config.classExpr) {
        config.classGetter = $parse(config.classExpr);
      }
      if (config.brdcstExpr) {
        var buf = config.scope.$eval(config.brdcstExpr);

        if (buf.$rootScope) {
          config.brdcstScope = $rootScope;
          delete buf.$rootScope;
        }
        else {
          config.brdcstScope = config.scope;
        }

        if (buf.$emit) {
          config.brdcstIsEmit = true;
          delete buf.$emit;
        }
        else {
          config.brdcstIsEmit = false;
        }

        config.brdcstList = [];
        angular.forEach(buf, function (expr, event) {
          config.brdcstList.push({
            condition: $parse(expr),
            event: event,
            wasActive: null
          });
        });
      }

      this.configs[this._configId] = config;

      digestDebounced();

      return this._configId;
    };

    this.removeConfig = function (index) {
      if (this.configs && this.configs[index]) {
        delete this.configs[index];

        if (objectSize(this.configs) === 0) {
          this.destroy();
        }
      }
    };

    this.digest = function (configId) {
      digest(null, configId);
    };

    this.destroy = function () {
      this.configs = null;

      $win
      .unbind('scroll', digest)
      .unbind('resize', digest);
    };
  }])

  .directive('scrollWatch', ["scrollWatchService", "$parse", function (scrollWatchService, $parse) {
    return {
      restrict: 'A',
      link: function postLink(scope, iElm, iAttrs) {
        var configId, deregisterDigestHook;

        if (iAttrs[DIR_STYLE] || iAttrs[DIR_CLASS] || iAttrs[DIR_BROADCAST]) {
          scope.$watch(iAttrs.scrollWatch, scrollWatchChange, true);

          iElm.on('$destroy', function () {
            if (configId) {
              scrollWatchService.removeConfig(configId);
            }
          });
        }

        function scrollWatchChange(config) {
          if (config && angular.isObject(config)) {
            if (configId) {
              scrollWatchService.removeConfig(configId);
              (deregisterDigestHook || angular.noop)();
            }

            config.target = iElm;
            config.scope = scope;

            if (iAttrs[DIR_STYLE]) {
              config.styleExpr = iAttrs[DIR_STYLE];
            }

            if (iAttrs[DIR_CLASS]) {
              config.classExpr = iAttrs[DIR_CLASS];
              config.attr = iAttrs;
            }

            if (iAttrs[DIR_BROADCAST]) {
              config.brdcstExpr = iAttrs[DIR_BROADCAST];
            }

            if (config.digest) {
              deregisterDigestHook = scope.$watch(digestHook);
            }

            configId = scrollWatchService.addConfig(config);
          }
        }

        function digestHook () {
          if (configId) {
            scrollWatchService.digest(configId);
          }
        }
      }
    };
  }]);

  function arrayDifference(tokens1, tokens2) {
    var values = [];

    outer:
    for(var i = 0; i < tokens1.length; i++) {
      var token = tokens1[i];
      for(var j = 0; j < tokens2.length; j++) {
        if(token == tokens2[j]) continue outer;
      }
      values.push(token);
    }
    return values;
  }

  function arrayClasses (classVal) {
    if (angular.isArray(classVal)) {
      return classVal;
    } else if (angular.isString(classVal)) {
      return classVal.split(' ');
    } else if (angular.isObject(classVal)) {
      var classes = [], i = 0;
      angular.forEach(classVal, function(v, k) {
        if (v) {
          classes = classes.concat(k.split(' '));
        }
      });
      return classes;
    }
    return classVal;
  }

  function shallowCopy(src, dst) {
    if (angular.isArray(src)) {
      dst = dst || [];

      for ( var i = 0; i < src.length; i++) {
        dst[i] = src[i];
      }
    } else if (angular.isObject(src)) {
      dst = dst || {};

      for (var key in src) {
        if (hasOwnProperty.call(src, key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
          dst[key] = src[key];
        }
      }
    }

    return dst || src;
  }

})(angular.module('pc035860.scrollWatch', []));
