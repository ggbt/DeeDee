function testable() {
  return 'valid';
}

var app = angular.module('DeeDee', ['ngAnimate']);
app.controller('controller', function($scope, $http) {

  // #####

  window.speechSynthesis.onvoiceschanged = function(e) {
    speechSynthesis.getVoices();
  };

  // #####

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
    for (var filter in $scope.filters) {
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
        return note.title.search(new RegExp($scope.searchText, "i")) !== -1 || 
               note.body.search(new RegExp($scope.searchText, "i")) !== -1;
      }
      return true;
    } else {
      return $scope.filters[note.tag] === true &&
        (note.title.search(new RegExp($scope.searchText, "i")) !== -1 || 
        note.body.search(new RegExp($scope.searchText, "i")) !== -1);
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

  function loadPresentation() {
    if (!localStorage.getItem('firstTime')) {
      $scope.notes = [{"title":"How to use","createdOn":"2015-08-16T10:33:03.404Z","body":"<u>DeeDee</u> is a note taking web-application.<br><br>You can create, edit, delete and tag notes using the buttons above.<br>If you toggle voice mode you can speak the following commands and DeeDee will respond:<br><ol><li><span style=\"background-color: transparent;\">\"new note\"</span><br></li><li><span style=\"background-color: transparent;\">\"delete note\"</span><br></li><li><span style=\"background-color: transparent;\">\"set important\"</span><br></li><li><span style=\"background-color: transparent;\">\"set </span>\n\nlate<span style=\"background-color: transparent;\">\"&nbsp;</span><br></li><li><span style=\"background-color: transparent;\">\"set personal\"&nbsp;</span><br></li><li><span style=\"background-color: transparent;\">\"set todo\"&nbsp;</span><br></li><li><span style=\"background-color: transparent;\">\"set work\"</span><br></li><li><span style=\"background-color: transparent;\">\"thank you\"</span><br></li></ol>If you focus this editable area while in voice mode, DeeDee will write everything you say here.<br><span style=\"background-color: transparent;\"><br>DeeDee annotates your notes. Write your note and wikipedia links will populate the right pane with relevant information from your note.<br><br>Use tags to stay organised and search all your notes with the search funtion.<br></span><br>Notes are saved automatically when you stop typing. Just come back to this page to find your work as you left it.","tag":"work","entities":{"note taking":true,"web-application":true,"create":true,"edit":true,"delete":true,"tag":true,"buttons":true,"voice":true,"mode":true,"speak":true,"respond":true,"note":true,"set":true,"late":true,"personal":true,"todo":true,"work":true,"focus":true,"area":true,"write":true,"annotates":true,"Write":true,"wikipedia":true,"links":true,"populate":true,"pane":true,"relevant":true,"tags":true,"stay":true,"organised":true,"search":true,"saved":true,"typing":true,"find":true,"left":true}},{"title":"A crucial note (sample)","createdOn":"2015-08-16T10:33:02.493Z","body":"\n\n<!--StartFragment-->Notes tagged with a crucial  tag will have a red ribbon on the corner.<!--EndFragment-->\n\n<br>","tag":"crucial","entities":{"tagged":true,"crucial":true,"tag":true,"red ribbon":true,"on the corner":true}},{"title":"A personal note (sample)","createdOn":"2015-08-16T10:33:01.797Z","body":"\n\n<!--StartFragment-->Notes tagged with a personal  tag will have a green ribbon on the corner.<!--EndFragment-->\n\n<br>","tag":"personal","entities":{"tagged":true,"personal":true,"tag":true,"green ribbon":true,"on the corner":true}},{"title":"A todo note (sample)","createdOn":"2015-08-16T10:27:14.622Z","body":"Notes tagged with a todo tag will have a purple ribbon on the corner.","tag":"todo","entities":{}},{"title":"Sample note","createdOn":"2015-08-16T10:27:12.943Z","body":"I am writing a sample note for presentation&nbsp;purposes.<br><br>DeeDee allows you to format your notes:<br><ul><li><span style=\"background-color: transparent;\">You can use </span><b>bold</b><span style=\"background-color: transparent;\">, </span><i>italic </i><span style=\"background-color: transparent;\">and </span><u>underlined</u><span style=\"background-color: transparent;\"> text.</span><br></li><li><span style=\"background-color: transparent;\">You can align your text and create tables as well as lists.</span><br></li></ul><table><tbody><tr><td>&nbsp;No</td><td>&nbsp;color</td><td>&nbsp;score</td><td>&nbsp;human-friendly score&nbsp;</td></tr><tr><td>&nbsp;1</td><td>&nbsp;darkslategray&nbsp;</td><td>&nbsp;245</td><td>&nbsp;Looking good</td></tr><tr><td>&nbsp;2</td><td>&nbsp;brown</td><td>&nbsp;775</td><td>&nbsp;Looking decent</td></tr></tbody></table><br>","tag":"work","entities":{"tagged":true,"todo":true,"tag":true}}];
      $scope.activeNote = $scope.notes[0];
      editor.setValue($scope.activeNote.body);
      $scope.annotations = {"note":{"title":"note","url":"https://en.wikipedia.org/wiki/Note","summary":"Note, notes, or NOTE may refer to:"},". I":{"title":". I","url":"https://en.wikipedia.org/wiki/._I"},"so happy":{"title":"so happy","url":"https://en.wikipedia.org/wiki/So_happy"},"yay":{"title":"yay","url":"https://en.wikipedia.org/wiki/Yay","summary":"Yay or YAY may refer to:"},"Good":{"title":"Good","summary":"Good may refer to:","url":"https://en.wikipedia.org/wiki/Good"},"job":{"title":"job","summary":"A person\'s job is their role in society.","url":"https://en.wikipedia.org/wiki/Job"},"reading":{"title":"reading","summary":"Reading may refer to:","url":"https://en.wikipedia.org/wiki/Reading"},"nigger":{"title":"nigger","summary":"In the English language, nigger is an ethnic slur usually directed at black people.","url":"https://en.wikipedia.org/wiki/Nigger"},"writing":{"title":"writing","url":"https://en.wikipedia.org/wiki/Writing","summary":"Writing is a medium of human communication that represents language and emotion through the inscription or recording of signs and symbols."},"sample":{"title":"sample","url":"https://en.wikipedia.org/wiki/Sample","summary":"Sample or samples may refer to:"},"presentation":{"title":"presentation","summary":"A presentation is the process of presenting a topic to an audience.","url":"https://en.wikipedia.org/wiki/Presentation"},".\n\nIn":{"title":".\n\nIn"},"format":{"title":"format","url":"https://en.wikipedia.org/wiki/Format","summary":"Format may refer to:"},"bold text":{"title":"bold text","url":"https://en.wikipedia.org/wiki/Emphasis_(typography)","summary":"In typography, emphasis is the exaggeration of words in a text with a font in a different style from the rest of the text?to emphasize them."},"bold":{"title":"bold","url":"https://en.wikipedia.org/wiki/Emphasis_(typography)","summary":"In typography, emphasis is the exaggeration of words in a text with a font in a different style from the rest of the text?to emphasize them."},"italic":{"title":"italic","summary":"Italic may refer to:","url":"https://en.wikipedia.org/wiki/Italic"},"underlined":{"title":"underlined","summary":"An underline, also called an underscore, is a more or less horizontal line immediately below a portion of writing.","url":"https://en.wikipedia.org/wiki/Underline"},"text":{"title":"text","summary":"Text may refer to:","url":"https://en.wikipedia.org/wiki/Text"},"align":{"title":"align","summary":"Align may refer to:","url":"https://en.wikipedia.org/wiki/Align"},"create":{"title":"create","url":"https://en.wikipedia.org/wiki/Create","summary":"Create may refer to:"},"tables":{"title":"tables","url":"https://en.wikipedia.org/wiki/Table","summary":"Table may refer to:"},"color":{"title":"color","summary":"Color (American English) or colour (British English; see spelling differences) is the visual perceptual property corresponding in humans to the categories called red, blue, yellow, etc.","url":"https://en.wikipedia.org/wiki/Color"},"score":{"title":"score","url":"https://en.wikipedia.org/wiki/Score","summary":"Score or scorer may refer to:"},"human":{"title":"human","summary":"Modern humans (Homo sapiens, primarily ssp.","url":"https://en.wikipedia.org/wiki/Human"},"friendly":{"title":"friendly","summary":"Friendly may refer to:","url":"https://en.wikipedia.org/wiki/Friendly"},"darkslategray":{"title":"darkslategray","summary":"In computing, on the X Window System, X11 color names are represented in a simple text file, which maps certain strings to RGB color values.","url":"https://en.wikipedia.org/wiki/X11_color_names"},"brown":{"title":"brown","url":"https://en.wikipedia.org/wiki/Brown","summary":"Brown is the color of dark wood or rich soil."},"good":{"title":"good","url":"https://en.wikipedia.org/wiki/Good","summary":"Good may refer to:"},"decent":{"title":"decent","summary":"Morality (from the Latin moralitas \"manner, character, proper behavior\") is the differentiation of intentions, decisions, and actions between those that are distinguished as proper functions and those which involve the omission of proper functions, the disjunction between right and wrong.","url":"https://en.wikipedia.org/wiki/Morality"},"note taking":{"title":"note taking","url":"https://en.wikipedia.org/wiki/Note-taking","summary":"Note-taking (sometimes written as notetaking or note taking) is the practice of recording information captured from another source."},"app":{"title":"app","url":"https://en.wikipedia.org/wiki/App","summary":"App, apps or APP may refer to:"},"edit":{"title":"edit","summary":"Edit may refer to:","url":"https://en.wikipedia.org/wiki/Edit"},"delete":{"title":"delete","url":"https://en.wikipedia.org/wiki/Deletion","summary":"Deletion is the act of deleting or removal by striking out material, such as a word or passage, that has been removed from a body of written or printed matter."},"tag":{"title":"tag","summary":"Tag or tagging could refer to:","url":"https://en.wikipedia.org/wiki/Tag"},"buttons":{"title":"buttons","url":"https://en.wikipedia.org/wiki/Button","summary":"In modern clothing and fashion design, a button is a small fastener, now most commonly made of plastic, but also frequently of metal, wood or seashell, which secures two pieces of fabric together."},"voice":{"title":"voice","summary":"The voice consists of sound made by a human being using the vocal folds for talking, singing, laughing, crying, screaming etc.","url":"https://en.wikipedia.org/wiki/Human_voice"},"mode":{"title":"mode","summary":"Mode (Latin: modus meaning \"manner, tune, measure, due measure, rhythm, melody\") may refer to:","url":"https://en.wikipedia.org/wiki/Mode"},"Create":{"title":"Create","url":"https://en.wikipedia.org/wiki/Create","summary":"Create may refer to:"},"speak":{"title":"speak","summary":"Speak may refer to:","url":"https://en.wikipedia.org/wiki/Speak"},"respond":{"title":"respond","url":"https://en.wikipedia.org/wiki/Respond","summary":"A respond is a half-pier or half-pillar which is bonded into a wall and designed to carry the springer at one end of an arch."},"set":{"title":"set","summary":"Set may refer to:","url":"https://en.wikipedia.org/wiki/Set"},"late":{"title":"late","summary":"Late may refer to:","url":"https://en.wikipedia.org/wiki/Late"},"personal":{"title":"personal","url":"https://en.wikipedia.org/wiki/Personal","summary":"Personal may refer to:"},"todo":{"title":"todo","summary":"Todo may refer to:","url":"https://en.wikipedia.org/wiki/Todo"},"work":{"title":"work","url":"https://en.wikipedia.org/wiki/Work","summary":"\n== Human labour =="},"focus":{"title":"focus","url":"https://en.wikipedia.org/wiki/Focus","summary":"Focus, FOCUS, or foci may refer to:"},"area":{"title":"area","summary":"Area is the quantity that expresses the extent of a two-dimensional figure or shape, or planar lamina, in the plane.","url":"https://en.wikipedia.org/wiki/Area"},"write":{"title":"write","summary":"Writing is a medium of human communication that represents language and emotion through the inscription or recording of signs and symbols.","url":"https://en.wikipedia.org/wiki/Writing"},"application":{"title":"application","summary":"Application may refer to:","url":"https://en.wikipedia.org/wiki/Application"},"web-application":{"title":"web-application","summary":"In computing, a web application or web app is a client-server software application in which the client (or user interface) runs in a web browser.","url":"https://en.wikipedia.org/wiki/Web_application"},"annotates":{"title":"annotates","url":"https://en.wikipedia.org/wiki/Annotation","summary":"An annotation is metadata (e.g."},"Simply":{"title":"Simply","url":"https://en.wikipedia.org/wiki/AOI:_Bionix","summary":"AOI: Bionix is De La Soul\'s sixth full-length album, released in 2001. The album was the second in a planned three-disc installment, which was originally intended to be a three-disc album."},"wikipedia":{"title":"wikipedia","summary":"Wikipedia (/?w?k??pi?di?/ or /?w?ki?pi?di?/ WIK-i-PEE-dee-?) is a free-access, free-content Internet encyclopedia, supported and hosted by the non-profit Wikimedia Foundation.","url":"https://en.wikipedia.org/wiki/Wikipedia"},"links":{"title":"links","summary":"Link usually refers to:","url":"https://en.wikipedia.org/wiki/Link"},"populate":{"title":"populate","url":"https://en.wikipedia.org/wiki/Population","summary":"A population is a summation of all the organisms of the same group or species, which live in a particular geographical area, and have the capability of interbreeding."},"pane":{"title":"pane","url":"https://en.wikipedia.org/wiki/Pane","summary":"Pane may refer to:"},"relevant":{"title":"relevant","url":"https://en.wikipedia.org/wiki/Relevant","summary":"Relevant is something directly related, connected or pertinent to a topic; it may also mean something that is current."},"Just write":{"title":"Just write","url":"https://en.wikipedia.org/wiki/Just_write"},"Write":{"title":"Write","summary":"Writing is a medium of human communication that represents language and emotion through the inscription or recording of signs and symbols.","url":"https://en.wikipedia.org/wiki/Writing"},"tags":{"title":"tags","url":"https://en.wikipedia.org/wiki/Tag","summary":"Tag or tagging could refer to:"},"stay":{"title":"stay","url":"https://en.wikipedia.org/wiki/Stay","summary":"Stay may refer to:"},"organised":{"title":"organised","summary":"An organization or organisation (see spelling differences) is an entity comprising multiple people, such as an institution or an association, that has a collective goal and is linked to an external environment.","url":"https://en.wikipedia.org/wiki/Organization"},"search":{"title":"search","summary":"Searching or search may refer to:","url":"https://en.wikipedia.org/wiki/Searching"},"tagged":{"title":"tagged","summary":"Tagged is a social discovery website based in San Francisco, California, founded in 2004. It allows members to browse the profiles of other members, play games, and share tags and virtual gifts.","url":"https://en.wikipedia.org/wiki/Tagged"},"purple ribbon":{"title":"purple ribbon","url":"https://en.wikipedia.org/wiki/Purple_ribbon","summary":"A purple ribbon is worn to raise awareness for various causes, including:"},"on the corner":{"title":"on the corner","url":"https://en.wikipedia.org/wiki/On_the_Corner","summary":"On the Corner is a studio album by jazz musician Miles Davis, recorded in June and July 1972 and released later that year on Columbia Records."},"green ribbon":{"title":"green ribbon","url":"https://en.wikipedia.org/wiki/Green_ribbon","summary":"The green ribbon is a symbol used to show support and create awareness for those suffering from various illnesses."},"crucial":{"title":"crucial","summary":"Crucial may refer to:","url":"https://en.wikipedia.org/wiki/Crucial"},"red ribbon":{"title":"red ribbon","summary":"The red ribbon, as an awareness ribbon colored red, is used as the symbol for the prevention of drunk driving and also solidarity of people living with HIV/AIDS.","url":"https://en.wikipedia.org/wiki/Red_ribbon"},"saved":{"title":"saved","url":"https://en.wikipedia.org/wiki/Save","summary":"Save or Saved may refer to:"},"typing":{"title":"typing","summary":"Typing is the process of writing or inputting text by pressing keys on a typewriter, computer keyboard, cell phone, or calculator.","url":"https://en.wikipedia.org/wiki/Typing"},"find":{"title":"find","summary":"In Unix-like and some other operating systems, find is a command-line utility that searches through one or more directory trees of a file system, locates files based on some user-specified criteria and applies a user-specified action on each matched file.","url":"https://en.wikipedia.org/wiki/Find"},"left":{"title":"left","summary":"Left may refer to:","url":"https://en.wikipedia.org/wiki/Left"}};

      localStorage.setItem('firstTime', 'No');
      return true;
    }
    return false;
  }

  function loadState() {
    var notes = JSON.parse(localStorage.getItem('notes'));
    if (notes) {
      $scope.notes = notes;

      // set the active note
      $scope.activeNote = $scope.notes[0];
      editor.setValue($scope.activeNote.body);
    } else {
      $scope.newNote();
    }

    var annotations = JSON.parse(localStorage.getItem('annotations'));
    if (annotations) {
      $scope.annotations = annotations;
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

  if (!loadPresentation()) {
    loadState();
  }
  initSpeech();

  window.onbeforeunload = saveState;
  window.onblur = saveState;

});
