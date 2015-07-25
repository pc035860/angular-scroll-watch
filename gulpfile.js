/*global require*/
var gulp = require('gulp'),
    gutil = require('gulp-util');

var connect = require('gulp-connect'),
    livereload = require('gulp-livereload'),
    uglify = require('gulp-uglify'),
    jshint = require('gulp-jshint'),
    changed = require('gulp-changed'),
    cache = require('gulp-cached'),
    rename = require('gulp-rename'),
    annotate = require('gulp-ng-annotate'),
    header = require('gulp-header'),
    less = require('gulp-less');

var pkg = require('./package.json');

var getTodayStr = function () {
  var date = new Date(),
      y = date.getFullYear(),
      m = date.getMonth() + 1,
      d = date.getDate();

  return y + '-' + m + '-' + d;
};

var config = {
  appRoot: '',
  src: 'src/angular-scroll-watch.js',
  buildDir: 'build',
  banner: '/*! <%= pkg.name %>\n' +
    'version: <%= pkg.version %>\n' +
    'build date: <%= today %>\n' +
    'author: <%= pkg.author %>\n' +
    '<%= pkg.repository.url %> */\n'
};

gulp.task('build', ['lint'], function () {
  return gulp.src(config.src)
    .pipe(annotate())
    .pipe(header(config.banner, {pkg: pkg, today: getTodayStr()}))
    .pipe(gulp.dest(config.buildDir))
    .pipe(uglify())
    .pipe(rename({extname: '.min.js'}))
    .pipe(header(config.banner, {pkg: pkg, today: getTodayStr()}))
    .pipe(gulp.dest(config.buildDir));
});
gulp.task('lint', function () {
  return gulp.src(config.src)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});
gulp.task('watch', function () {
  gulp.watch(config.src, ['build']);
});


gulp.task('server', function () {
  connect.server({
    root: config.appRoot,
    port: 9000
  });
});
gulp.task('watch:example', function () {
  livereload.listen();

  var paths = [
    config.src,
    'example/{,**/}*.{js,html,css}',
    'example/*/*.less'
  ];
  gulp.watch(paths, ['lint:example', 'less:example'])
    .on('change', livereload.changed);
});
gulp.task('lint:example', function () {
  return gulp.src('example/{,**/}*.{html,js}', {base: './'})
    .pipe(cache('lint-example'))
    .pipe(jshint.extract('auto'))
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});
gulp.task('less:example', function () {
  return gulp.src('example/*/style.less', {base: './'})
    .pipe(changed('./', {extension: '.css'}))
    .pipe(less())
    .pipe(gulp.dest('./'));
});

gulp.task('default', ['build']);
gulp.task('example', ['server', 'watch', 'watch:example']);
