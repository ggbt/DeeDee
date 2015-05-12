var app = angular.module('DeeDee', ['ngAnimate']);
app.controller('controller', function($scope, $http) {
  $scope.searchText = '';

  $scope.filters = {
    crucial: false,
    todo: false,
    work: false,
    personal: false,
    later: false
  };

  $scope.anyTagFilter = true;
  $scope.tagListIsVisible = false;
  $scope.tagFiltersVisible = false;

  $scope.newNote = function (title) {
    if (typeof title === 'undefined') {
      title = 'New note';
    }

    var newNote = {
      title: title,
      createdOn: new Date(),
      tag: '',
      body: '',
      entities: {}
    };

    $scope.notes.unshift(newNote);
    $scope.activeNote = newNote;
    editor.setValue(newNote.body);

    noteTitle.focus();

    saveState();
  };

  $scope.deleteNote = function () {
    if (!$scope.activeNote) {
      return;
    }

    var noteIndex = indexOfObject($scope.notes, $scope.activeNote);
    $scope.notes.splice(noteIndex, 1);

    // Make sure the noteIndex doesn't go out of bounds
    if ($scope.notes.length < noteIndex + 1) {
      noteIndex = $scope.notes.length - 1;
    }

    // Make sure there is at least one note in the list
    if ($scope.notes.length === 0) {
      // Toast: notify the user that at least one note should exist?
      $scope.newNote();
    } else {
      $scope.activeNote = $scope.notes[noteIndex];
      editor.setValue($scope.activeNote.body);

      saveState();
    }
  };

  var noteTitle = document.getElementById('note_title');

  $scope.switchNote = function (note) {

    delay.clear();
    $scope.searchText = '';

    $scope.activeNote = note;
    editor.setValue(note.body);
    editor.focus();
  };

  $scope.focusEditor = function () {
    if (SpeechRecognizer) {
      SpeechRecognizer.setCommandMode(false);
    }
  };

  // Called to update the model with the value from the editor (view)
  $scope.blurEditor = function () {
    if (SpeechRecognizer) {
      SpeechRecognizer.setCommandMode(true);
    }
    $scope.activeNote.body = editor.getValue();
    saveState();
  };

  $scope.filterHasChanged = function () {
    for (filter in $scope.filters) {
      if ($scope.filters.hasOwnProperty(filter)) {
        if ($scope.filters[filter] === true) {
          $scope.anyTagFilter = false;
          return;
        }
      }
    }

    $scope.anyTagFilter = true;
  };

  $scope.setTag = function (tag) {
    if ($scope.activeNote.tag === tag) {
      $scope.activeNote.tag = '';
    } else {
      $scope.activeNote.tag = tag;
    }

    // hide the tag list
    $scope.tagListIsVisible = false;
  };

  $scope.searchFilter = function (note) {
    if ($scope.anyTagFilter) {
      if ($scope.searchText !== '') {
        return note.title.search(new RegExp($scope.searchText, "i")) !== -1
          || note.body.search(new RegExp($scope.searchText, "i")) !== -1;
      }
      return true;
    } else {
      return $scope.filters[note.tag] === true &&
        (note.title.search(new RegExp($scope.searchText, "i")) !== -1
        || note.body.search(new RegExp($scope.searchText, "i")) !== -1);
    }
  };

  $scope.toggleSpeechRecognizer = function () {
    if (SpeechRecognizer) {
      if (SpeechRecognizer.listening) {
        $scope.recording = false;
        removeIntermedSpan();
        SpeechRecognizer.stop();
      } else {
        $scope.recording = true;
        SpeechRecognizer.start();
      }
    }
  };

  $scope.keyUpEditor = function (event) {
    delay(spotEntities, 1800);
  };

  function spotEntities () {

    var query = editorElement.innerText;

    if (query !== '') {
      $http.get('http://spotlight.dbpedia.org/rest/spot?text=' + encodeURIComponent(query))
        .success(function (data) {
          var entities = data.annotation.surfaceForm;

          if (entities && entities instanceof Array) {
            $scope.activeNote.entities = {};
            entities.forEach(function (entity) {
              var entityName = entity['@name'];
              $scope.activeNote.entities[entityName] = true;
            });
          } else if (entities) {
            var entityName = entities['@name'];
            $scope.activeNote.entities = {};
            $scope.activeNote.entities[entityName] = true;
          }

          getWikiAnnotations();
        });
    } else {
      $scope.activeNote.entities = {};
      $scope.$apply();
    }
  }

  var delay = (function(){
    var timeout;

    var delayer = function(callback, ms){
      clearTimeout(timeout);
      timeout = setTimeout(callback, ms);
    };

    delayer.clear = function () {
      clearTimeout(timeout);
    };

    return delayer;
  })();

  var wikiGetExtractQuery = 'http://en.wikipedia.org/w/api.php?callback=JSON_CALLBACK&format=json&redirects&prop=extracts&exsentences=1&action=query&explaintext=&titles=';
  var wikiGetURLQuery = 'http://en.wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=query&format=json&redirects&prop=info&inprop=url&titles=';

  function getWikiAnnotations() {
    Object.keys($scope.activeNote.entities).forEach(function (entity) {
      if (!$scope.annotations[entity]) {

        $scope.annotations[entity] = {
          title: entity
        };

        $http.jsonp(wikiGetExtractQuery + encodeURIComponent(entity))
          .success(function (data) {

            var pages = data.query.pages;
            var summary = '';

            for (var page in pages) {
              summary = pages[page].extract;
              break;
            }

            $scope.annotations[entity].summary = summary;
          });

        $http.jsonp(wikiGetURLQuery + encodeURIComponent(entity))
          .success(function (data) {
            console.dir(data);
            var pages = data.query.pages; // 3213213.extract
            var url = '';

            for (var page in pages) {
              url = pages[page].fullurl;
              break;
            }

            $scope.annotations[entity].url = url;
          });
      }
    });
  }

  var intermedSpan;

  function placeIntermedSpan(text) {
    if (!intermedSpan) {
      editor.composer.commands.exec('insertHTML', '<span id="intermedSpan"></span>');
      intermedSpan = document.getElementById('intermedSpan');
    }
    intermedSpan.innerHTML = text;
  }

  function removeIntermedSpan() {
    if (intermedSpan && intermedSpan.parentNode) {
      intermedSpan.parentNode.removeChild(intermedSpan);
    }
    intermedSpan = null;
  }

  function initSpeech() {
    if (SpeechRecognizer) {

      var soundElement = document.getElementById('acknowledged_audio');

      $scope.speechAvailable = true;
      $scope.recording = false;

      SpeechRecognizer.setCommands({
        'new note': function () {
          soundElement.play();

          $scope.newNote();
          $scope.$apply();
        },
        'delete note': function () {
          soundElement.play();

          $scope.deleteNote();
          $scope.$apply();
        },
        'set crucial': function () {
          soundElement.play();

          $scope.setTag('crucial');
          $scope.$apply();
        },
        'set later': function () {
          soundElement.play();

          $scope.setTag('later');
          $scope.$apply();
        },
        'set personal': function () {
          soundElement.play();

          $scope.setTag('personal');
          $scope.$apply();
        },
        'set to do': function () {
          soundElement.play();

          $scope.setTag('todo');
          $scope.$apply();
        },
        'set work': function () {
          soundElement.play();

          $scope.setTag('work');
          $scope.$apply();
        },
        'thank you': function () {
          soundElement.play();
        },
        'stop recording': function () {
          soundElement.play();

          $scope.toggleSpeechRecognizer();
          $scope.$apply();
        }
      });

      SpeechRecognizer.setCommandMode(true);

      SpeechRecognizer.onResult(function (text) {
        removeIntermedSpan();
        editor.composer.commands.exec('insertHTML', text);
        spotEntities();
      });

      SpeechRecognizer.onIntermedResult(function (text) {
        editor.focus();
        placeIntermedSpan(text);
      });

      SpeechRecognizer.onNotAllowed(function () {
        $scope.recording = false;
        $scope.$apply();
      });
    }
  }

  function saveState() {
    // add the latest changes from the editor to the active note
    // to make the changes available in local storage as well
    $scope.activeNote.body = editor.getValue();

    // I am building a new array of notes because $scope.notes has
    // some extra properties injected by angular which I don't need.
    var notes = [];

    for (var i = 0; i < $scope.notes.length; ++i) {
      notes.push({
        title: $scope.notes[i].title,
        createdOn: $scope.notes[i].createdOn,
        body: $scope.notes[i].body,
        tag: $scope.notes[i].tag,
        entities: $scope.notes[i].entities
      });
    }
    localStorage.setItem('notes', JSON.stringify(notes));

    var annotations = {};
    Object.keys($scope.annotations).forEach(function (annotation) {
      annotations[annotation] = $scope.annotations[annotation];
    });

    localStorage.setItem('annotations', JSON.stringify(annotations));
  }

  function loadState() {

    var annotations = JSON.parse(localStorage.getItem('annotations'));
    if (annotations) {
      $scope.annotations = annotations
    }

    var notes = JSON.parse(localStorage.getItem('notes'));
    if (notes) {
      $scope.notes = notes;

      // set the active note
      $scope.activeNote = $scope.notes[0];
      editor.setValue($scope.activeNote.body);
    } else {
      $scope.newNote();
    }
  }

  function indexOfObject(arr, obj){
    for(var i = 0; i < arr.length; ++i){
      if(angular.equals(arr[i], obj)){
        return i;
      }
    }
    return -1;
  }

  // start

  var editor = new wysihtml5.Editor('editor', {
    toolbar: 'toolbar',
    parserRules: wysihtml5ParserRules
  });

  var editorElement = document.getElementById('editor');

  $scope.notes = [];
  $scope.annotations = {};

  loadState();
  initSpeech();

  window.onbeforeunload = saveState;
  window.onblur = saveState;

});
