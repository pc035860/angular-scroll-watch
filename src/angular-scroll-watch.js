(function (module) {

  var DIR_STYLE = 'swStyle',
      DIR_CLASS = 'swClass',
      DIR_BROADCAST = 'swBroadcast',
      DIR_STAGE = 'swStage';

  var STAGE_NAME_DEFAULT = 'pc035860';

  var CACHE_ID_STAGE_POOL = 'scrollWatch.stages';

  module

  .factory('scrollWatchStageFactory', function (
    $window, $document, $parse, $log, $rootScope, $animate
  ) {
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

    var $win = angular.element($window);

    /**
     * Stage class
     */
    var Stage = function (name, $elm) {
      this.init(name, $elm);
    };

    var p = Stage.prototype;

    p.name = null;
    p.element = null;
    p.configs = null;
    p._configId = 0;
    p._binded = false;

    p.init = function (name, $elm) {
      this.name = name;
      this.element = $elm || null;

      this.scrollHandler = this._digest.bind(this);
      this._digestDebounced = debounce(this._digest, 50);

      this._digestDebounced();
    };

    p.setElement = function ($elm) {
      this.element = $elm;
      
      if (this.configs !== null && !this._binded) {
        this._bind(this.element);
      }

      this._digestDebounced();
    };

    p.clearElement = function () {
      if (this._binded) {
        this._unbind(this.element);
      }
      this.element = null;
    };

    p.addConfig = function (config) {
      angular.forEach(['target', 'from', 'to'], function (key) {
        if (angular.isUndefined(config[key])) {
          throw new Error('`'+ key +'` should be provided');
        }
      });

      if (this.configs === null) {
        this.configs = {};

        if (this.element !== null) {
          this._bind(this.element);
        }
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
          var pack = {
            event: event
          };

          if (!angular.isString(expr)) {
            pack.always = true;
          }
          else {
            pack.condition = $parse(expr);
            pack.wasActive = null;
          }

          config.brdcstList.push(pack);
        });
      }

      this.configs[this._configId] = config;

      this._digestDebounced();

      return this._configId;
    };

    p.removeConfig = function (configId) {
      if (this.configs && this.configs[configId]) {
        delete this.configs[configId];
        
        if (objectSize(this.configs) === 0) {
          this.configs = null;

          if (this.element !== null) {
            this._unbind(this.element);
          }
        }
      }
    };

    p.digest = function (configId) {
      this._digest(null, configId);
    };

    p.destroy = function () {
      this._unbind(this.element);
      this.configs = null;
      this.element = null;
      this.scrollHandler = null;
      this._digestDebounced = null;
    };

    p.couldDestroy = function () {
      return this.element === null && this.configs === null;
    };

    p._isDefault = function () {
      return this.element[0] === $window;
    };

    p._getElementMetrics = function ($elm) {
      var rect, metrics, scrollTop, elm, stageTop;

      elm = $elm[0];
      rect = elm.getBoundingClientRect();
      scrollTop = this._scrollTop();

      metrics = {
        offsetTop: rect.top + scrollTop
      };

      if (this._isDefault()) {
        stageTop = metrics.offsetTop;
      }
      else {
        stageTop = this._traverseStageTop(elm);
      }

      if (angular.isDefined(stageTop) && stageTop !== null) {
        metrics.stageTop = stageTop;
      }

      return metrics;
    };

    p._traverseStageTop = function (elm) {
      var stageElm = this.element[0],
          top = 0, cursor, progress;

      var updateProgress = function (cursor, progress) {
        if (!progress) {
          progress = {};
        }
        progress.parentNode = cursor.offsetParent;
        progress.offsetTop = cursor.offsetTop;
        progress.hitStage = progress.parentNode === stageElm;
        return progress;
      };

      var c = 0;

      cursor = elm;
      progress = updateProgress(cursor);

      do {
        cursor = cursor.parentNode || cursor;

        if (progress.parentNode === cursor) {
          top += progress.offsetTop;

          if (progress.hitStage) {
            return top;
          }

          progress = updateProgress(cursor, progress);
        }
        else if (cursor === stageElm) {
          return top + progress.offsetTop - stageElm.offsetTop;
        }

        if (++c >= 10) {
          break;
        }
      } while (cursor.tagName !== 'BODY' || elm === cursor);

      return null;
    };

    p._contentHeight = function () {
      if (this._isDefault()) {
        var doc = $document[0].documentElement,
            body = $document[0].body;

        return Math.max(
          body.scrollHeight, doc.scrollHeight,
          body.offsetHeight, doc.offsetHeight,
          doc.clientHeight
        );
      }
      return this.element[0].scrollHeight;
    };

    p._containerHeight = function () {
      if (this._isDefault()) {
        var h1 = $document[0].documentElement.clientHeight,
            h2 = $window.innerHeight;
        if (h1 > h2) {
          return h2;
        }
        return h1;
      }
      return this.element[0].offsetHeight;
    };

    p._scrollTop = function () {
      if (this._isDefault()) {
        return $window.pageYOffset;
      }
      return this.element[0].scrollTop;
    };

    p._digest = (function () {
      var reBpCond = /((?:>|<)?=?)\s*?((?:-(?!p))|(?:p(?!-)))?(\d+)/;

      var _handleStyle,

          _handleClass, _addClasses, _removeClasses, 
          _digestClassCounts, _updateClasses,

          _handleBrdcst, _apply;

      /**
       * Style related functions
       */
      _handleStyle = function (locals, config) {
        config.target.css(config.styleGetter(config.scope, locals));
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
        config.scope.$digest();
      };
      _handleClass = function (locals, config) {
        var newVal = config.classGetter(config.scope, locals),
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
      _apply = function (scope, fn) {
        var phase = scope.$root.$$phase;
        if(phase == '$apply' || phase == '$digest') {
          if(fn && (typeof(fn) === 'function')) {
            fn();
          }
        } else {
          scope.$apply(fn);
        }
      };
      _handleBrdcst = function (locals, config) {
        angular.forEach(config.brdcstList, function (v) {
          var active, funcName;

          funcName = config.brdcstIsEmit ? '$emit' : '$broadcast';

          if (v.always) {
            config.brdcstScope[funcName](v.event, null, locals);
          }
          else if (v.condition) {
            active = v.condition(config.scope, locals);
            if (v.wasActive === null || active !== v.wasActive) {
              _apply(config.brdcstScope, function () {
                config.brdcstScope[funcName](v.event, active, locals);
              });
            }
            v.wasActive = active;
          }
        });
      };

      function _update(configId) {
        var positive, negative, numReverse, processConfig;

        var containerHeight = this._containerHeight(),
            contentHeight = this._contentHeight(),
            maxScrollTop = contentHeight - containerHeight,
            scrollTop = this._scrollTop();

        var self = this;

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
          var from, to, locals, progress, elmMetrics;

          from = config.from < 0 ? positive(config.from) : config.from;
          to = config.to < 0 ? positive(config.to) : config.to;

          /**
           * Create local context
           */
          if (scrollTop < from) {
            progress = 0;
            locals = {
              $positive: from,
              $negative: negative(from)
            };
          }
          else if (scrollTop > to) {
            progress = 1;
            locals = {
              $positive: to,
              $negative: negative(to)
            };
          }
          else if (scrollTop >= from && scrollTop <= to) {
            progress = (scrollTop - from) / (to - from);
            locals = {
              $positive: scrollTop,
              $negative: negative(scrollTop)
            };
          }

          locals.$progress = progress;
          locals.$percentage = progress * 100;

          if (!config._lastProgress || config._lastProgress === progress) {
            locals.$direction = 0;
          }
          else if (config._lastProgress > progress) {
            locals.$direction = -1;
          }
          else if (config._lastProgress < progress) {
            locals.$direction = 1;
          }

          locals.$height = config.target[0].offsetHeight;
          angular.forEach(
            self._getElementMetrics(config.target),
            function (v, k) {
              locals['$' + k] = v;
          });

          /**
           * Applying
           */
          // to style
          if (config.styleGetter) {
            _handleStyle(locals, config);
          }

          // to class
          if (config.classGetter) {
            _handleClass(locals, config);
          }

          // trigger breakpoints
          if (config.brdcstList) {
            _handleBrdcst(locals, config);
          }

          config._lastProgress = progress;
        };

        if (angular.isUndefined(configId)) {
          angular.forEach(this.configs, processConfig);
        }
        else if (this.configs[configId]) {
          processConfig(this.configs[configId]);
        }
      }

      return function ($event, configId) {
        if (this.element === null) {
          return;
        }

        if (this._digesting && angular.isUndefined(configId)) {
          return;
        }

        var self = this;

        this._digesting = true;

        requestAnimFrame(function () {
          _update.call(self, configId);

          self._digesting = false;
        });
      };
    }());

    p._bind = function ($elm) {
      this._binded = true;

      if (this._isDefault()) {
        $win
        .on('scroll', this.scrollHandler)
        .on('resize', this.scrollHandler);
      }
      else {
        $win.on('resize', this.scrollHandler);
        $elm.on('scroll', this.scrollHandler);
      }
    };

    p._unbind = function ($elm) {
      this._binded = false;

      if (this._isDefault()) {
        $win
        .off('scroll', this.scrollHandler)
        .off('resize', this.scrollHandler);
      }
      else {
        $win.off('resize', this.scrollHandler);
        $elm.off('scroll', this.scrollHandler);
      }
    };

    return function scrollWatchStageFactory(name, $elm) {
      return new Stage(name, $elm);
    };
  })

  .service('scrollWatchService', 
  function scrollWatchService(
    scrollWatchStageFactory, $window, $log, $cacheFactory
  ) {
    var defaultStage = scrollWatchStageFactory(
      STAGE_NAME_DEFAULT, 
      angular.element($window)
    );

    this.stages = $cacheFactory(CACHE_ID_STAGE_POOL);

    this.stages.put(STAGE_NAME_DEFAULT, defaultStage);

    this.addStage = function (stageName, $elm) {
      var stage = this.stages.get(stageName);

      if (stage) {
        stage.setElement($elm);
        return;
      }

      stage = scrollWatchStageFactory(stageName, $elm);
      this.stages.put(stageName, stage);
    };

    this.removeStage = function (stageName) {
      var stage = this.stages.get(stageName);

      if (stage) {
        stage.clearElement();
        this._checkStageDestroy(stage);
      }
    };

    this.addConfig = function (config) {
      var stageName = config.stage,
          stage = this.stages.get(stageName);

      if (!stage) {
        // Create a stage without element
        stage = scrollWatchStageFactory(stageName);
        this.stages.put(stageName, stage);
      }

      return [stageName, stage.addConfig(config)];
    };

    this.removeConfig = function (handle) {
      var configId = handle[1],
          stage = this._getStage(handle);

      if (stage) {
        stage.removeConfig(configId);
        this._checkStageDestroy(stage);
      }
    };

    this.digest = function (handle) {
      var configId = handle[1],
          stage = this._getStage(handle);

      if (stage) {
        stage.digest(configId);
      }
    };

    this._checkStageDestroy = function (stage) {
      if (stage.couldDestroy()) {
        stage.destroy();
        this.stages.remove(stage.name);
      }
    };

    this._getStage = function (handle) {
      var stageName = handle[0];
      return this.stages.get(stageName);
    };
  })

  .directive('scrollWatch', function (scrollWatchService, $parse) {
    return {
      restrict: 'A',
      link: function postLink(scope, iElm, iAttrs) {
        var configHandle, deregisterDigestSync;

        if (iAttrs[DIR_STYLE] || iAttrs[DIR_CLASS] || iAttrs[DIR_BROADCAST]) {
          scope.$watch(iAttrs.scrollWatch, scrollWatchChange, true);

          iElm.on('$destroy', function () {
            if (configHandle) {
              scrollWatchService.removeConfig(configHandle);
            }
          });
        }

        function scrollWatchChange(config) {
          if (config && angular.isObject(config)) {
            // Make sure it won't modify the scope variable
            config = angular.copy(config);

            if (configHandle) {
              scrollWatchService.removeConfig(configHandle);
              (deregisterDigestSync || angular.noop)();
            }

            config.target = iElm;
            config.scope = scope;
            config.stage = config.stage || STAGE_NAME_DEFAULT;

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

            if (config.digestSync) {
              deregisterDigestSync = scope.$watch(digestSync);
            }

            configHandle = scrollWatchService.addConfig(config);
          }
        }

        function digestSync () {
          if (configHandle) {
            scrollWatchService.digest(configHandle);
          }
        }
      }
    };
  })

  .directive('swStage', function (scrollWatchService) {
    return {
      restrict: 'A',
      link: function postLink(scope, iElm, iAttrs) {
        var stageName;

        iAttrs.$observe(DIR_STAGE, function (val) {
          if (val) {
            if (stageName) {
              scrollWatchService.removeStage(stageName);
            }

            stageName = val;
            scrollWatchService.addStage(stageName, iElm);
          }
        });

        iElm.on('$destroy', function () {
          if (stageName) {
            scrollWatchService.removeStage(stageName);
          }
        });
      }
    };
  });

  function objectSize(obj) {
    var c = 0;
    angular.forEach(obj, function () {
      c++;
    });
    return c;
  }

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
