(function (module) {

  var DIR_STYLE = 'srStyle',
      DIR_WATCH = 'srWatch',
      DIR_CLASS = 'srClass',
      DIR_ON = 'srOn';

  module

  .controller('ScrollRangeCtrl', ["$window", "$document", "$parse", "$log", "$rootScope", function ($window, $document, $parse, $log, $rootScope) {
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

      var _updateStyle, _updateClass, _addClass, _removeClass,
          _breakpointTrigger;

      _updateStyle = function (local, config) {
        config.target.css(config.styleGetter(config.scope, local));
      };
      _addClass = function ($elm, val) {
        var buf;
        if (angular.isObject(val) && !angular.isArray(val)) {
          buf = [];
          angular.forEach(val, function (v, k) {
            if (v) {
              buf.push(k);
            }
          });
          val = buf;
        }
        if (val) {
          $elm.addClass(angular.isArray(val) ? val.join(' ') : val);
        }
      };
      _removeClass = function ($elm, val) {
        var buf;
        if (angular.isObject(val) && !angular.isArray(val)) {
          buf = [];
          angular.forEach(val, function (v, k) {
            if (v) {
              buf.push(k);
            }
          });
          val = buf;
        }
        $elm.removeClass(angular.isArray(val) ? val.join(' ') : val);
      };
      _updateClass = function (local, config) {
        var classVal = config.classGetter(config.scope, local);
        if (config._oldClassVal && !angular.equals(classVal, config._oldClassVal)) {
          _removeClass(config.target, config._oldClassVal);
        }
        _addClass(config.target, classVal);
        config._oldClassVal = classVal;
      };
      _breakpointTrigger = function (local, config) {
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
            _updateStyle(localContext, config);
          }

          // to class
          if (config.classGetter) {
            _updateClass(localContext, config);
          }

          // trigger breakpoints
          if (config.onGetterList) {
            _breakpointTrigger(localContext, config);
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

})(angular.module('pc035860.scrollRange', []));
