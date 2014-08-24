# angular-scroll-watch

Scroll-aware AngularJS with ease.

#### Features

- **style** and **class** directives with scrolling locals
- Supports multiple **stages**
- Triggers scope digest only when needed

#### Examples

Scroll them to see the effects!

- [How much angular do you want? (`sw-class` with `ng-repeat`)](http://pc035860.github.io/angular-scroll-watch/example/sw-class-with-ng-repeat/)
- [Lovely slides (`sw-broadcast`)](http://pc035860.github.io/angular-scroll-watch/example/sw-broadcast/)
- [Two controls on the shield (`sw-stage`)](http://pc035860.github.com/angular-scroll-watch/example/sw-stage/)

Check out the [example directory](example/) for a full list of examples.

## Getting started

Include the `angular-scroll-watch` module with AngularJS script in your page.

```html
<script src="//ajax.googleapis.com/ajax/libs/angularjs/1.2.22/angular.min.js"></script>
<script src="http://pc035860.github.io/angular-scroll-watch/build/angular-scroll-watch.min.js"></script>
```

Add `pc035860.scrollWatch` to your app module's dependency.

```js
angular.module('myApp', ['pc035860.scrollWatch']);
```

### Install with Bower

```sh
bower install angular-scroll-watch
```

## Usage

Coming soon.

## Development

Thie module uses [gulp.js](http://gulpjs.com/) for development tasks.

### Setup

Install all the required node packages.

```sh
# Install node packages
npm install
```

### Gulp tasks

```sh
# Lint the source file
gulp lint

# Build
gulp build

# Watch the source file for auto-build
gulp watch


# Serve the example at http://localhost:9000
# Gulp will also watch for source/example changes
gulp example
```
