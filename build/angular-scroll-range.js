(function (module) {

  var DIR_STYLE = 'srStyle',
      DIR_WATCH = 'srWatch',
      DIR_CLASS = 'srClass',
      DIR_ON = 'srOn';

  module

  .controller('ScrollRangeCtrl', 
  ["$window", "$document", "$parse", "$log", "$rootScope", "$animate", function ScrollRangeCtrl($window, $document, $parse, $log, $rootScope, $animate) {
    var self = this;

    var $win = angular.element($window);

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

    var updatePoint = (function () {
      var anim;

      var reBpCond = /((?:>|<)?=?)\s*?((?:-(?!p))|(?:p(?!-)))?(\d+)/;

      var _handleStyle,

          _handleClass, _addClasses, _removeClasses, 
          _digestClassCounts, _updateClasses,

          _handleBreakpoint;

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
       * Breakpoint related functions
       */
      _handleBreakpoint = function (local, config) {
        var matchCondition = function (condition) {
          var m, op, mod, number, thresholdKey,
              eq, lt, gt, le, ge;

          if ((m = condition.match(reBpCond)) === null) {
            $log.warn('condition syntax error', condition);
            return false;
          }

          /**
           * Perl operator like functions
           */
          eq = function (a, b) {
            return a == b;
          };
          lt = function (a, b) {
            return a < b;
          };
          gt = function (a, b) {
            return a > b;
          };
          le = function (a, b) {
            return a <= b;
          };
          ge = function (a, b) {
            return a >= b;
          };

          op = {
            '=': eq, '<': lt, '>': gt, '<=': le, '>=': ge
          }[m[1]];
          mod = m[2] || null;
          number = Number(m[3]);

          thresholdKey = '$positive';
          if (mod === 'p') {
            thresholdKey = '$progress';
          }
          else if (mod === '-') {
            thresholdKey = '$negative';
            number = -number;
          }

          return op(local[thresholdKey], number);
        };

        angular.forEach(config.onGetterList, function (v) {
          var match = matchCondition(v.condition);
          if (match && match !== v.lastMatch) {
            v.getter(config.scope, local);
            (config.localDigest ? config.scope : $rootScope).$digest();
          }
          v.lastMatch = match;
        });
      };

      function _update () {
        var positive, negative, numReverse;

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

        angular.forEach(self.configs, function (config) {
          var lower, upper, localContext, progress;

          lower = config.lower < 0 ? positive(config.lower) : config.lower;
          upper = config.upper < 0 ? positive(config.upper) : config.upper;

          /**
           * Create local context
           */
          if (scrollTop < lower) {
            progress = 0;
            localContext = {
              $positive: lower,
              $negative: negative(lower)
            };
          }
          else if (scrollTop > upper) {
            progress = 1;
            localContext = {
              $positive: upper,
              $negative: negative(upper)
            };
          }
          else if (scrollTop >= lower && scrollTop <= upper) {
            progress = (scrollTop - lower) / (upper - lower);
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
          if (config.onGetterList) {
            _handleBreakpoint(localContext, config);
          }

          config._lastProgress = progress;

        });
      }

      anim = false;

      return function () {
        if (anim) {
          return;
        }

        anim = true;

        requestAnimFrame(function () {
          _update();

          anim = false;
        });
      };
    }());

    this._configId = 0;

    this.configs = null;

    this.init = function () {
      this.configs = {};

      $win
      .bind('scroll', updatePoint)
      .bind('resize', updatePoint);

      updatePoint();
    };

    this.addConfig = function (config) {
      angular.forEach(['target', 'lower', 'upper'], function (key) {
        if (angular.isUndefined(config[key])) {
          throw new Error('`'+ key +'` should be provided');
        }
      });

      this._configId++;

      if (config.styleExpr) {
        config.styleGetter = $parse(config.styleExpr);
      }
      if (config.classExpr) {
        config.classGetter = $parse(config.classExpr);
      }
      if (config.onExpr) {
        config.localDigest = !!config.localDigest;

        config.onGetterList = [];
        angular.forEach($parse(config.onExpr)({}), function (v, k) {
          config.onGetterList.push({
            condition: k,
            getter: $parse(v),
            lastMatch: false
          });
        });
      }

      this.configs[this._configId] = config;
    };

    this.removeConfig = function (index) {
      if (this.configs && this.configs[index]) {
        delete this.configs[index];
      }
    };

    this.destroy = function () {
      this.configs = null;

      $win
      .unbind('scroll', updatePoint)
      .unbind('resize', updatePoint);
    };
  }])

  .directive('scrollRange', function () {
    return {
      restrict: 'A',
      controller: 'ScrollRangeCtrl',
      link: {
        pre: function preLink(scope, iElm, iAttrs, ctrl) {
          ctrl.init();

          var configId;

          if (iAttrs[DIR_WATCH] &&
            (iAttrs[DIR_STYLE] || iAttrs[DIR_CLASS] || iAttrs[DIR_ON])) {

            scope.$watch(iAttrs[DIR_WATCH], function (config) {
              if (config && angular.isObject(config)) {
                if (configId) {
                  ctrl.removeConfig(configId);
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

                if (iAttrs[DIR_ON]) {
                  config.onExpr = iAttrs[DIR_ON];
                }

                configId = ctrl.addConfig(config);
              }
            }, true);

            iElm.on('$destroy', function () {
              if (configId) {
                ctrl.removeConfig(configId);
              }
            });
          }

          iElm.on('$destroy', function () {
            ctrl.destroy();
          });
        }
      }
    };
  })

  .directive(DIR_WATCH, function () {
    return {
      require: '?^scrollRange',
      restrict: 'A',
      link: function postLink(scope, iElm, iAttrs, ctrl) {
        if (angular.isDefined(iAttrs.scrollRange)) {
          return;
        }

        var configId;

        if (iAttrs[DIR_STYLE] || iAttrs[DIR_CLASS] || iAttrs[DIR_ON]) {
          scope.$watch(iAttrs[DIR_WATCH], function (config) {
            if (config && angular.isObject(config)) {
              if (configId) {
                ctrl.removeConfig(configId);
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

              if (iAttrs[DIR_ON]) {
                config.onExpr = iAttrs[DIR_ON];
              }

              configId = ctrl.addConfig(config);
            }
          }, true);

          iElm.on('$destroy', function () {
            if (configId) {
              ctrl.removeConfig(configId);
            }
          });
        }
      }
    };
  });

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

})(angular.module('pc035860.scrollRange', []));
