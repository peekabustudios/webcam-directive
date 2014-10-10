'use strict';

(function() {
	// GetUserMedia is not yet supported by all browsers
	// Until then, we need to handle the vendor prefixes
	navigator.getMedia = ( navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia);

	// Checks if getUserMedia is available on the client browser
	window.hasUserMedia = function hasUserMedia() {
		return navigator.getMedia ? true : false;
	};
})();

angular.module('webcam', [])
.directive('webcam',['$window', function ($window) {
	return {
		template: '<div class="webcam"></div>',
		restrict: 'E',
		replace: true,
		transclude: true,
		scope:
		{
			onError: '&',
			onStarted: '&',
			onStreaming: '&',
			//=========
			// dependent on each other
			onGotBytearray : '=',
			getBytearray: '=',
			//=========
			placeholder: '=',
			streamWidth: '=',
			streamHeight: '=',
			elementWidth: '=',
			elementHeight: '=',
			facing: '=',
			fps: '='
		},
		link: function postLink($scope, element) {
				// static vars
				var FLASH_FILE_PATH = 'jscam_canvas_only.swf';
				var CAMERA_SWITCH_IMAGE_URL = 'https://raw.githubusercontent.com/coryalder/Interface-Elements/master/camera_switch.png';
				var CAMERA_SWITCH_OFFSET = 10;
				// intervals
				var	canvasUpdateInterval = null;
				//DOM elements
				var 	videoElem       = null,
						canvasElem      = null,
						backCanvasElem  = null,
						placeholder     = null,
						switchCameraImg = null;

				// element information (canvas/drawing part)
				// 	with default values
				var elementInfo = {
					hasWebRTC : true,
					hasPlaceholder : false,
					hasSwitchCamera : false,
					fps : 30,
					dims: {
						width   : 320,
						height  : 240
					}
				};
				// camera infromation (facing, dimensions of feed, current data)
				// 	with default values
				var cameraInfo = {
					isStreaming : false,
					availableCameras : [],
					facing : {
						id : {
							front : -1,
							back : -1
						},
						default : 'back',
						hasFacing : function(){
							return !(this.id.front == -1 && this.id.back == -1);
						}
					},
					current : {
						id : 0,
						stream : null,
						streamSpecs : {}
					},
					dims : {
						width       : 320,
						height      : 240
					}
				};
				// drawing information (required if feed has different aspect ratio than element)
				// 	with defaults
				var drawInfo = {
					aspectRatioElem : 1,
					aspectRatioFeed : 1,
					renderRect : null
				};

				//==========================
				//start camera
				var startWebcam = function startWebcam() {

					//parse overriding attributes
					parseAttributes();

					//check user media support and version
					if(!webrtcValid()){
						//load flash
						elementInfo.hasWebRTC = false;
						loadFlashFallback();
						return;
					}
					
					//prepare DOM elements
					loadDOMElements();

					//setup placeholder
					if ($scope.placeholder) {
						var placeholder = document.createElement('img');
						placeholder.setAttribute('class', 'webcam-loader');
						placeholder.src = $scope.placeholder;
						element.append(placeholder);
					}

					//detect cameras
					var onCamerasDetected = function onCamerasDetected(){
						if( cameraInfo.facing.hasFacing() ){
							cameraInfo.current.id = cameraInfo.facing.id[cameraInfo.facing.default];
						}
						setCamera( cameraInfo.current.id );
					}
					detectCameras( onCamerasDetected );
				};
				//==========================
				
				//==========================
				//stop camera
				var stopWebcam = function stopWebcam() {
					onDestroy();
					videoElem.remove();
				};
				var onDestroy = function onDestroy() {
					if (!!cameraInfo.current.stream && typeof cameraInfo.current.stream.stop === 'function') {
						cameraInfo.current.stream.stop();
					}
					if (!!canvasUpdateInterval){
						window.clearInterval(canvasUpdateInterval);
					}
				};
				//==========================
				
				//==========================
				//swap camera
				/**
				 * swap Camera    iterates through cameras
				 */
				var swapCameras = function swapCameras(){
					var currentCameraId = cameraInfo.current.id;
					var availableCameras = cameraInfo.availableCameras;
					currentCameraId++;
					if( currentCameraId >= availableCameras.length){
						currentCameraId = 0;
					}
					setCamera( currentCameraId );
				}
				//==========================
				
				//==========================
				//get bytearray
				$scope.getBytearray = function(){
					//if running flash
					if( !elementInfo.hasWebRTC ){
						webcam.capture();
						return;
					}
					//put pixels onto backCanvas
					var ctx = backCanvasElem.getContext('2d');
					ctx.drawImage(videoElem,0,0,backCanvasElem.width, backCanvasElem.height);
					// get data from back canvas
					var imgdata = ctx.getImageData(0,0, backCanvasElem.width, backCanvasElem.height).data;
					//return parseBytearrayRGB2GREY(imgdata);
					$scope.onGotBytearray(parseBytearrayRGB2GREY(imgdata));
				}
				//==========================
				
				//==========================
				//get grey bytearray
				var parseBytearrayRGB2GREY = function parseBytearrayRGB2GREY( data ){
					var greyScale = new Uint8Array(data.length/4);
					for (var i = 0; i < data.length; i += 4) {
						greyScale[i >>2] = Math.floor(data[i]*0.2126 + data[i + 1]*0.7152 + data[i + 2]*0.0722);
					}
					return greyScale;
				}
				//==========================
				
				//==========================
				// flash fallback
				var flashObj = null;
				var loadFlashFallback = function loadFlashFallback(){
					flashObj = {
	                row_counter : 0,
	                frame : "",
	                reset : function(){
	                    this.row_counter = 0;
	                    this.frame = "";
	                }
	            };

	            //call the jquery.webcam function
	            //	that sets up flash element inside elem
					element.webcam({
                    width: 320,
                    height: 240,
                    mode: "callback",
                    swffile: FLASH_FILE_PATH,
                    onTick: function(a,b) {},
                    onSave: function(a) {
                        flashObj.frame += a;
                        flashObj.row_counter++;
                        if(flashObj.row_counter >= 240) onGotFrame();
                    },
                    onCapture: function(a,b) {
                        webcam.save();
                    },
                    debug: function(a,b) {
                        if(b == "Camera started"){
                        	if ($scope.onStarted) {
										$scope.onStarted();
									}
                        }
                        else if( b == "Flash movie not yet registered!" || b == "No camera was detected."){
                           if ($scope.onError) {
										$scope.onError({err:'no camera available'});
									}
                        }
                    },
                    onLoad: function() { }
               });
					//helper functions
					function onGotFrame(){
						//parse data
                  var frame_array = flashObj.frame.split(";");
                  var final_array = new Uint8Array(76800)
                  //transform to grey array
                  for(var i = 1 ; i < frame_array.length ; i ++){
                     var rgb = hexToRgb(decimalToHex(frame_array[i]));
                     final_array[i] = rgb2greyscale(rgb);
                  }
                  //call callback function
                 	if($scope.onGotBytearray){
                 		console.log('calling on Success ' , webcam.onSuccess , final_array );
                 		$scope.onGotBytearray( final_array );
                 	}
                 	flashObj.reset();
               };
               function decimalToHex(d) {
                  var hex = Number(d).toString(16);
                  hex = "000000".substr(0, 6 - hex.length) + hex;
                  return hex;
               }
               function hexToRgb(hex) {
                  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result ? {
                  	r: parseInt(result[1], 16),
                     g: parseInt(result[2], 16),
                  	b: parseInt(result[3], 16)
                  } : null;
                }
                function rgb2greyscale(v){
                    return Math.floor(v.r*0.2126 +v.g*0.7152 + v.b*0.0722);
                }
				}

				/**
				 * parseAttributes 
				 * 	currently supported attributes:
				 * 		* streamWidth
				 * 		* streamHeight
				 * 		* elementWidth
				 * 		* elementHeight
				 * 		* facing //'front' or 'back'
				 */
				var parseAttributes = function parseAttributes(){
					if($scope.streamWidth){
						cameraInfo.dims.width = $scope.streamWidth;
					}
					if($scope.streamHeight){
						cameraInfo.dims.height = $scope.streamHeight;
					}
					if($scope.elementWidth){
						elementInfo.dims.width = $scope.elementWidth;
					}
					if($scope.elementHeight){
						elementInfo.dims.height = $scope.elementHeight;
					}
					if($scope.facing &&
						($scope.facing === 'front' || $scope.facing === 'back')){
						cameraInfo.facing.default = $scope.facing;
					}
					if($scope.fps){
						elementInfo.fps = $scope.fps;
					}
					//set element aspect ratio
					aspectRatioElem = elementInfo.dims.width/elementInfo.dims.height;
				};

				/**
				 * [loadDOMElements 
				 * 		creates videoStream, backCanvas and canvas.
				 * 		adds canvas to the element]
				 */
				var loadDOMElements = function loadDOMElements(){
					//create video element
					videoElem = document.createElement('video');
					videoElem.setAttribute('class', 'webcam-live');
					videoElem.setAttribute('autoplay', '');
					//create back canvas element
					backCanvasElem = document.createElement('canvas');
					backCanvasElem.setAttribute('width', cameraInfo.dims.width );
					backCanvasElem.setAttribute('height', cameraInfo.dims.height );
					//create main canvas element
					canvasElem = document.createElement('canvas');
					canvasElem.setAttribute('width', elementInfo.dims.width );
					canvasElem.setAttribute('height', elementInfo.dims.height );
					canvasElem.onmousedown = canvasClick;
					//add to core element
					element.append(canvasElem);
					//add switch camera button if required
					if(elementInfo.hasSwitchCamera){
						switchCameraImg = document.createElement('img');
						switchCameraImg.src = CAMERA_SWITCH_IMAGE_URL;
					}
				};

				/**
				 * webRTCValid checks if webrtc supported 
				 * 							and if modern enough 
				 * 							for camera enumeration
				 * @return true or false
				 */
				var webrtcValid = function webrtcValid(){
					//check user media support
					if (!window.hasUserMedia()) {
						return false;
					}

					//get webrtc version
					var webrtcDetectedVersion = '';
					var found = false;
					if (navigator.webkitGetUserMedia){
						webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
						found = true;
					}
					if (navigator.mozGetUserMedia){
						webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
						found = true;
					}
					// webrtc version check
					if (webrtcDetectedVersion >= 30 && found == true) {
						return true;
					}
					return false;
				};

				/**
				 * detectCameras
				 * @param  {function} onDetectedCameras callback when cameras
				 *                                      got enumerated
				 */
				var detectCameras = function detectCameras( onDetectedCameras ){
					//parse all sources and cast out audio providers
					function gotSources( streams ) {
						//clear available cameras
						cameraInfo.availableCameras = [];
						for (var i = 0; i <  streams.length; i++) {
							if( streams[i].kind !== 'audio')
							{
								//check for facing parameter
								if( streams[i].facing === 'user'){
									//alert( 'setting front camera' + cameraInfo.availableCameras.length );
									cameraInfo.facing.id.front = cameraInfo.availableCameras.length;
								}else if( streams[i].facing === 'environment'){
									//alert( 'setting back camera' + cameraInfo.availableCameras.length );
									cameraInfo.facing.id.back = cameraInfo.availableCameras.length;
								}
								cameraInfo.availableCameras.push(  streams[i] );
							}
						}
						if(cameraInfo.availableCameras.length > 1){
							elementInfo.hasSwitchCamera = true;
						}
						//we detected cameras -> callback
						onDetectedCameras();
					}
					MediaStreamTrack.getSources(gotSources);
				};
				//===========================
				
				//===========================
				// SETTING CAMERA
				
				/**
				 * setCamera    setting camera by Id or defaults 
				 * 					to first available camera
				 * @param {camera tag} cameraTag id of camera to be set
				 */
				var setCamera = function setCamera( cameraTag ){
					var availableCameras = cameraInfo.availableCameras;

					//validate camera tag
					cameraTag = (typeof cameraTag !== 'undefined' ? cameraTag : 0);
					if(cameraTag < 0 || cameraTag >= availableCameras.length){
						cameraTag = 0;
					}

					//set stream specification object
					var streamSpec = {};
					if (navigator.getUserMedia){
						streamSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
					}else if (navigator.oGetUserMedia){
						streamSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
					}else if (navigator.mozGetUserMedia){
						streamSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
					}else if (navigator.webkitGetUserMedia){
						streamSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
					}else if (navigator.msGetUserMedia){
						streamSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}, audio:false};
					}
					//set global vars
					cameraInfo.current.streamSpec = streamSpec;
					cameraInfo.current.id = cameraTag;
					//trigger stream with specification
					triggerStream( streamSpec );
				};

				/**
				 * triggerStream     launches the stream to video element 
				 * 						using provided specs
				 */
				var triggerStream = function triggerStream( streamInfo ){
					//onStarted success function
					// called when camera stream is loaded
					var onSuccess = function onSuccess(stream) {
						cameraInfo.current.stream = stream;

						// Firefox supports a src object
						if (navigator.mozGetUserMedia) {
							videoElem.mozSrcObject = stream;
						} else {
							var vendorURL = window.URL || window.webkitURL;
							videoElem.src = vendorURL.createObjectURL(stream);
						}

						/* Start playing the video to show the stream from the webcam */
						videoElem.play();

						/* Call custom callback */
						if ($scope.onStarted) {
							$scope.onStarted({stream: stream, video: videoElem});
						}
						// set canvas update interval
						canvasUpdateInterval = setInterval(canvasRedraw,1000/elementInfo.fps);
					};
					//called on failure
					var onFailure = function onFailure(err) {
						removeLoader();
						if (console && console.log) {
							console.log('The following error occured: ', err);
						}
						/* Call custom callback */
						if ($scope.onError) {
							$scope.onError({err:err});
						}
						return;
					};
					//check if previous stream is running
					if(cameraInfo.current.stream){
						onDestroy();
					}
					//get Media for the stream
					navigator.getMedia(streamInfo, onSuccess, onFailure);

					/* Start streaming the webcam data when the video element can play
					 * It will do it only once
					 */
					videoElem.addEventListener('canplay', function() {
						// check if it's not streaming already
						if (!cameraInfo.isStreaming) {
							//update drawInfo
							//	if necessary
							drawInfo.aspectRatioFeed = videoElem.videoWidth/videoElem.videoHeight;
							if(drawInfo.aspectRatioFeed != drawInfo.aspectRatioElem){
								updateRenderRect();
							}
							//camera is streaming
							cameraInfo.isStreaming = true;
							//remove placeholder
							removeLoader();
							/* Call custom callback */
							if ($scope.onStreaming) {
								$scope.onStreaming({video:videoElem});
							}
						}
					}, false);
				};

				/**
				 * canvasRedraw   drop pixels from the feed onto the canvas
				 */
				var oldVideoWidth = 0;
				var canvasRedraw = function canvasRedraw(){
					if(cameraInfo.isStreaming){
						//watch for feed dimension change
						if(videoElem.videoWidth != oldVideoWidth) {
							updateRenderRect();
							oldVideoWidth = videoElem.videoWidth;
						}
						// draw feed to canvas
						var ctx = canvasElem.getContext('2d');
						var drawRect = ( drawInfo.renderRect ? drawInfo.renderRect : {x:0,y:0,width:canvasElem.width,height:canvasElem.height});
						ctx.drawImage(videoElem,drawRect.x,drawRect.y,drawRect.width, drawRect.height);
						if(elementInfo.hasSwitchCamera){
							ctx.drawImage(switchCameraImg, canvasElem.width - CAMERA_SWITCH_OFFSET- switchCameraImg.width, CAMERA_SWITCH_OFFSET);
						}
					}
				}
				/**
				 * updateRenderRect
				 * 		compares feed and element aspect ratio
				 * 		and crops the feed so it fits nicely
				 * 		inside the element
				 */
				var updateRenderRect = function updateRenderRect(){
					//get new aspect ratio
					drawInfo.aspectRatioFeed = videoElem.videoWidth/videoElem.videoHeight;
					//if too 'vertical'
					if(drawInfo.aspectRatioFeed < drawInfo.aspectRatioElem){
						var scale = elementInfo.dims.width/videoElem.videoWidth;
						var newHeight = videoElem.videoHeight*scale;
						var newY = -(newHeight-elementInfo.dims.height)/2;
						//setup render rect with new values
						drawInfo.renderRect = {
							x: 0,
							y: newY,
							width : elementInfo.dims.width,
							height : newHeight
						}
					}
					//if too 'horizontal'
					else if(drawInfo.aspectRatioFeed > drawInfo.aspectRatioElem){
						var scale = elementInfo.dims.height/videoElem.videoHeight;
						var newWidth = videoElem.videoWidth*scale;
						var newX = -(newWidth-elementInfo.dims.width)/2;
						//setup render rect with new values
						drawInfo.renderRect = {
							x: newX,
							y: 0,
							width : newWidth,
							height : elementInfo.dims.height
						}
					}
				}
				/**
				 * canvasClick
				 * 	detect swap camera button click
				 */
				var canvasClick = function canvasClick(e){
					if(elementInfo.hasSwitchCamera){
						var minX = canvasElem.width - CAMERA_SWITCH_OFFSET- switchCameraImg.width;
						var maxX = minX + switchCameraImg.width;
						var minY = CAMERA_SWITCH_OFFSET;
						var maxY = minY + switchCameraImg.height;
						if(e.layerX > minX && e.layerX < maxX &&
							e.layerY > minY && e.layerY < maxY){
							swapCameras();
						}
					} 
				}

				// called when any error happens
				var removeLoader = function removeLoader() {
					if (placeholder) {
						angular.element(placeholder).remove();
					}
				};

				 $scope.$on('$destroy', onDestroy);
				 $scope.$on('START_WEBCAM', startWebcam);
				 $scope.$on('STOP_WEBCAM', stopWebcam);

				 startWebcam();
			 }
		 };
	 }]);
