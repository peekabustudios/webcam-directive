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
  .directive('webcam', function () {
    return {
      template: '<div class="webcam" ng-transclude></div>',
      restrict: 'E',
      replace: true,
      transclude: true,
      scope:
      {
        onError: '&',
        onStream: '&',
        onStreaming: '&',
        placeholder: '=',
        videoHeight: '=',
        videoWidth: '='
      },
      link: function postLink($scope, element) {
        var videoElem, videoStream;

        var availableCameras, frontCameraId = -1, backCameraId = -1;

        var onDestroy = function onDestroy() {
          if (!!videoStream && typeof videoStream.stop === 'function') {
            videoStream.stop();
          }
          if (!!videoElem) {
            delete videoElem.src;            
          }
        };

        // called when camera stream is loaded
        var onSuccess = function onSuccess(stream) {
          videoStream = stream;

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
          if ($scope.onStream) {
            $scope.onStream({stream: stream, video: videoElem});
          }
        };

        // called when any error happens
        var removeLoader = function removeLoader() {
          if (placeholder) {
            angular.element(placeholder).remove();
          }
        };
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

        //camera tag can be 'front' or 'back' or just id
        var setCamera = function setCamera( cameraTag ){

          cameraTag = (typeof cameraTag !== 'undefined' ? cameraTag : 0);

          if(cameraTag === 'front'){
            cameraTag = frontCameraId;
          }else if(cameraTag === 'back'){
            cameraTag = backCameraId;
          }

          //validate camera tag
          if(cameraTag < 0 || cameraTag > availableCameras.length-1){
            cameraTag = 0;
          }

          var cameraSpec = {};
          console.log('cameras : ', availableCameras , 'using id : ' , cameraTag);
          if(cameraTag === -1){
            cameraTag = 0;
          }
          if (navigator.getUserMedia){
            cameraSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
          }else if (navigator.oGetUserMedia){
            cameraSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
          }else if (navigator.mozGetUserMedia){
            cameraSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
          }else if (navigator.webkitGetUserMedia){
            cameraSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}};
          }else if (navigator.msGetUserMedia){
            cameraSpec = {video: {optional: [{sourceId: availableCameras[cameraTag].id}]}, audio:false};
          }

          console.log('camera spec' , cameraSpec);

          triggerStream(cameraSpec);
        };

        var startWebcam = function startWebcam() {
          videoElem = document.createElement('video');
          videoElem.setAttribute('class', 'webcam-live');
          videoElem.setAttribute('autoplay', '');
          element.append(videoElem);

          if ($scope.placeholder) {
            var placeholder = document.createElement('img');
            placeholder.setAttribute('class', 'webcam-loader');
            placeholder.src = $scope.placeholder;
            element.append(placeholder);
          }

          var detectCameras = function detectCameras( onDetectedCameras ){

            //isFront = (typeof isFront !== 'undefined' ? isFront : true);

            //helper functions
            //parse all sources and cast out audio providers
            function gotSources(sourceInfos) {
              availableCameras = [];
              for (var i = 0; i < sourceInfos.length; i++) {
                if(sourceInfos[i].kind !== 'audio')
                {
                  alert(sourceInfos[i].facing);
                  if(sourceInfos[i].facing === 'user'){
                    frontCameraId = i;
                  }else if(sourceInfos[i].facing === 'environment'){
                    backCameraId = i;
                  }
                  availableCameras.push( sourceInfos[i] );
                }
              }
            }

            //get webrtc version
            var webrtcDetectedVersion = '';
            if (navigator.webkitGetUserMedia){
              webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
            }
            if (navigator.mozGetUserMedia){
              webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
            }

            // webrtc version check
            if (webrtcDetectedVersion >= 30) {
              MediaStreamTrack.getSources(gotSources);
            }

            onDetectedCameras();
          };

          // // Default variables
          // var isStreaming = false,
          //   width = element.width = $scope.videoWidth || 320,
          //   height = element.height = 0;

          // // Check the availability of getUserMedia across supported browsers
          // if (!window.hasUserMedia()) {
          //   onFailure({code:-1, msg: 'Browser does not support getUserMedia.'});
          //   return;
          // }

          // detectCameras();

          // setCamera( 0 );
        };

        var triggerStream = function triggerStream( streamInfo ){
          navigator.getMedia(streamInfo, onSuccess, onFailure);

          /* Start streaming the webcam data when the video element can play
           * It will do it only once
           */
          videoElem.addEventListener('canplay', function() {
            if (!isStreaming) {
              var scale = width / videoElem.videoWidth;
              height = (videoElem.videoHeight * scale) || $scope.videoHeight;
              videoElem.setAttribute('width', width);
              videoElem.setAttribute('height', height);
              isStreaming = true;
              // console.log('Started streaming');

              removeLoader();

              /* Call custom callback */
              if ($scope.onStreaming) {
                $scope.onStreaming({video:videoElem});
              }
            }
          }, false);

        };

        var stopWebcam = function stopWebcam() {
          onDestroy();
          videoElem.remove();
        };

        $scope.$on('$destroy', onDestroy);
        $scope.$on('START_WEBCAM', startWebcam);
        $scope.$on('STOP_WEBCAM', stopWebcam);

        startWebcam();

      }
    };
  });
