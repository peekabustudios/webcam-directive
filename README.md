# Webcam access for web and mobile chrome with flash fallback

This is an [AngularJS][] directive that can be added to your own app.

Supports Chrome, Firefox, Safari, IE >= 9, Chrome Mobile.
Provides functionality to swap cameras if more than two detected.
Allows to get pixels from the camera feed.

__For flash support to work make sure to copy 'jscam_canvas_only.swf' from git://github.com/infusion/jQuery-webcam.git to the root website directory__


## Use

#### Using [Bower](http://bower.io/)
```
$ bower install https://github.com/peekabustudios/webcam-directive.git#develop
```

#### You can also find the current version inside the dist/ folder
	Ex.: dist/<version_number>/webcam.min.js

## Installation

#### Use the new element
```
<webcam></webcam>
```

add 'webcam' as an Angular dependency:
```
angular.module('myApp', [
    'ngAnimate',
    'ngCookies',
    'ngRoute',
    'ngTouch',
    'webcam'
  ])
```

#### Callbacks
```js
<webcam on-started="onStarted(stream,video)"
	        on-error="onError(err)"
	        on-streaming="onSuccess(video)"
	        get-bytearray="getBytearray"
	        on-got-bytearray="onData(data)">
		</webcam>
```

#### Custom placeholder to be shown while loading the webcam
```js
<webcam placeholder="'img/ajax-loader.gif'">
```

## Technologies used in this project

- [AngularJS][]
- [Yeoman](http://yeoman.io/)
- [getUserMedia](https://developer.mozilla.org/en-US/docs/WebRTC/navigator.getUserMedia)
- [canvas](https://developer.mozilla.org/en-US/docs/HTML/Canvas)
- [video](https://developer.mozilla.org/en-US/docs/HTML/Element/video)

[angularjs]:http://angularjs.org
