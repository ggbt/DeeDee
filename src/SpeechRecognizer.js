var SpeechRecognizer = (function () {
  var Recognition = window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition ||
    window.oSpeechRecognition ||
    null;

  if (!Recognition) {
    return null;
  }

  // Public API
  var SpeechRecognizer = {
    /**
     * Starts listening for sound.
     * Make sure to set the <code>onResult</code> and <code>onIntermedResult</code>
     * listeners if you want to do anything with the result.
     * */
    start: function () {
      this.listening = true;
      recognition.start();
    },

    stop: function () {
      this.listening = false;
      recognition.stop();
    },

    onResult: function (callback) {
      gotFinalResult = callback;
    },

    onIntermedResult: function (callback) {
      gotIntermediaryResult = callback;
    },

    onNotAllowed: function (callback) {
      notAllowed = callback;
    },

    setCommandMode: function (mode) {
      commandMode = mode;

      waitUntilFinalResult = !mode;
    },

    setCommands: function (listeners) {
      commandListeners = listeners;
    },

    listening: false
  };

  var commandListeners;
  var commandMode = true;
  var waitUntilFinalResult = false;

  // callback functions
  var gotFinalResult;
  var gotIntermediaryResult;
  var notAllowed;

  var recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  // recognition.lang = 'ro-ro';

  recognition.onresult = function (event) {

    var finalResult = '';
    var intermediaryResult = '';

    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalResult += event.results[i][0].transcript;
      } else {
        intermediaryResult += event.results[i][0].transcript;
      }
    }

    if (commandMode) {
      // Call the listener only if we are not waiting for the finalResult
      // wouldn't want to call an action 10 times when the user has spoken only once
      if (intermediaryResult !== '' && !waitUntilFinalResult) {
        var command = intermediaryResult.trim().toLowerCase();

        if (commandListeners[command]) {
          waitUntilFinalResult = true;
          commandListeners[command]();
        }
      }

      // Got the finalResult, we can start listening for commands again
      if (finalResult !== '') {
        waitUntilFinalResult = false;
      }
    } else {
      if (intermediaryResult !== '') {
        waitUntilFinalResult = false;

        if (gotIntermediaryResult) {
          gotIntermediaryResult(intermediaryResult);
        }
      }

      // If waitUntilFinalResult is true this finalResult is
      // a command and we shouldn't return it
      if (gotFinalResult && finalResult !== '' && !waitUntilFinalResult) {
        gotFinalResult(finalResult);
      }
    }
  };

  var noSpeechError = false;

  recognition.onstart = function () {
    noSpeechError = false;
  };

  recognition.onerror = function (event) {
    if (event.error == 'no-speech') {
      console.log('no-speech');
      noSpeechError = true;
      recognition.stop();
    }
    if (event.error == 'audio-capture') {
      console.log('audio-capture');
    }
    if (event.error == 'not-allowed') {
      console.log('not-allowed');
      if (typeof notAllowed !== 'undefined') {
        notAllowed();
      }
    }
  };

  recognition.onend = function () {
    // The recognition stops automatically if a no-speech error occurs
    // that's why we'll restart it in case of such an error
    if (noSpeechError) {
      recognition.start();
    }

    // TODO: notify the user?
  };

  return SpeechRecognizer;
})();