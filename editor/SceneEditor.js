/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var AppInit                 = brackets.getModule("utils/AppInit"),
        WorkspaceManager        = brackets.getModule("view/WorkspaceManager"),
        Menus                   = brackets.getModule("command/Menus"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        bracketsEditorManager   = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        StatusBar               = brackets.getModule("widgets/StatusBar");

    var Project                 = require("core/Project"),
        Commands                = require("core/Commands"),
        Strings                 = require("strings"),
        EventManager            = require("core/EventManager"),
        Undo                    = require("core/Undo"),
        Selector                = require("core/Selector"),
        Inspector               = require("core/Inspector"),
        ObjectManager           = require("core/ObjectManager"),
        Cocos                   = require("core/Cocos"),
        EditorManager           = require("editor/EditorManager"),
        Scene                   = require("text!html/Scene.html");


    var _editor = null;
    var _scene = null;

    var _projectOpened = false;
    var _lazyInitEditor = false;

    var _playing = false;
    var _paused = false;

    var _$scene = $(Scene);

    function initCanvas(){

        cl.$fgCanvas = _$scene.find("#fgCanvas");
        cl.$fgCanvas.attr("tabindex", 99);

        cl.fgCanvas = cl.$fgCanvas[0];

        var ctx = cl.fgCanvas.getContext('2d');
        
        var render = function(){
            if(!cc._canvas || (cc.director && cc.director.isPaused())) {
                return;
            }

            var selectedObjects = Selector.getSelectObjects();
            var editors = EditorManager.getEditors();

            var maxW = cc._canvas.width ;
            var maxH = cc._canvas.height;
     
            ctx.clearRect(0,0,maxW,maxH);

            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -maxH);
            
            for(var i in editors){
                var editor = editors[i];
                if(!editor.renderScene) { continue; }

                ctx.save();
                editor.renderScene(ctx, selectedObjects);
                ctx.restore();
            }
            
            ctx.restore();
        };
        
        setInterval(render, 100);
    }


    function initTopBar() {
        var $topBar = $('<div id="top-bar">');
        $topBar.insertBefore($('.main-view'));
    }

    function initPlayBar() {

        // game state html
        var $state        = $('<span id="state-container" ></span>');
        var $sceneState   = $('<span id="scene-state"class="state" title="Switch to Scene Editor Mode">Scene</span>');
        var $gameState    = $('<span id="game-state" class="state disactive" title="Switch to Game Mode">Game</span>');

        $state.append($sceneState);
        $state.append($gameState);

        // game controller html
        var $controller   = $('<span id="controller-container" ></span>');
        var $playBtn      = $('<span id="play-btn"       class="fa-play         cl-icon-button" title="Play game"></span>');
        var $pauseBtn     = $('<span id="pause-btn"      class="fa-pause        cl-icon-button" title="Pause game"></span>');
        var $nextFrameBtn = $('<span id="next-frame-btn" class="fa-step-forward cl-icon-button" title="Go to next frame"></span>');

        $controller.append($playBtn);
        $controller.append($pauseBtn);
        $controller.append($nextFrameBtn);

        // play bar html
        var $playBar = $('<div id="play-bar"/>');

        $playBar.append($state);
        $playBar.append($controller);

        $('#top-bar').append($playBar);

        function switchToGameState() {
            cl.fgCanvas.style.display = "none";
            EventManager.trigger(EventManager.SCENE_SWITCH_STATE, "game");

            $gameState.removeClass('disactive');
            $sceneState.addClass('disactive');
        }

        function switchToSceneState() {
            cl.fgCanvas.style.display = "";
            EventManager.trigger(EventManager.SCENE_SWITCH_STATE, "scene");

            $gameState.addClass('disactive');
            $sceneState.removeClass('disactive');
        }

        function beginPlaying() {
            var tempJson = sceneToString();

            switchToGameState();
            EventManager.trigger(EventManager.SCENE_BEFORE_PLAYING);

            cl.SceneManager.loadSceneWithContent(tempJson, function(tempScene) {
                cc.director.runScene(tempScene);

                EventManager.trigger(EventManager.SCENE_BEGIN_PLAYING, tempScene);
            }, true);

            $playBtn.addClass('active');
        }

        function endPlaying() {
            switchToSceneState();
            cc.director.runScene(_scene);

            EventManager.trigger(EventManager.SCENE_END_PLAYING, _scene);

            $playBtn.removeClass('active');
        }

        function switchPlayState() {
            _playing = !_playing;
            
            if(_playing) {
                beginPlaying();
            }
            else {
                endPlaying();
            }
        }

        function switchPauseState() {
            _paused = !_paused;

            if(_paused) {
                $pauseBtn.addClass('active');
            } else {
                $pauseBtn.removeClass('active');
            }
        }

        function nextFrame() {
            _paused = false;
            cc.director.getScheduler().update(cc.director.getAnimationInterval());
            _paused = true;
        }

        // button click event
        $gameState.click(switchToGameState);
        $sceneState.click(switchToSceneState);
        $playBtn.click(switchPlayState);
        $pauseBtn.click(switchPauseState);
        $nextFrameBtn.click(nextFrame);


        CommandManager.register(Strings.PLAY,  Commands.CMD_PLAY,  switchPlayState);
        CommandManager.register(Strings.PAUSE, Commands.CMD_PAUSE, switchPauseState);
        CommandManager.register(Strings.STEP,  Commands.CMD_STEP,  nextFrame);
    }

    function sceneToString() {
        return JSON.stringify(_scene, null, '\t');
    }

    function initEditor() {

        var originGetText = _editor.document.getText;
        _editor.document.getText = function() {
            var text = "";
            
            if(_scene) {
                text = sceneToString();
            } else {
                text = originGetText.apply(this, arguments);
            }

            return text;
        };

        var resFolder = Project.getResourceFolder();
        _editor.document.saveAsDefaultPath = resFolder ? resFolder.fullPath : null;

        var $el = $("<div class='scene-editor'>");
        $el.append(_$scene);

        _editor.$el.css("display", "none");
        $('.pane-content').append($el);

        cc.game.run("gameCanvas");
    }

    function closeScene() {
        _editor = _scene = null;
        _playing = _paused = false;
        cc.director.runScene(new cc.Scene());

        EventManager.trigger(EventManager.SCENE_CLOSED);
    }

    function handleSceneLoaded(scene) {
        _scene = scene;

        cc.director.runScene(_scene);

        EventManager.trigger(EventManager.SCENE_LOADED, _scene);

        // fixed focus gameCanvas may break main-view layout
        // todo: find a better way to solve this problem
        WorkspaceManager.recomputeLayout();

        // _scene.update = function(){};
    }


    function handleActiveEditorChange(event, current, previous) {

        if(previous && previous === _editor){
            closeScene();
        }   
        
        _editor = null;

        if(!current || !current.document.file.name.endWith(".scene")) {
            
            if(Inspector.showing) {
                Inspector.hide();
            }
            StatusBar.show();

            return;
        }

        if(!Inspector.showing) {
            Inspector.show();
        }
        StatusBar.hide();

        _editor = current;

        if(_projectOpened) {
            initEditor();
        } else {
            _lazyInitEditor = true;
        }
    }

    function handleProjectOpen() {

        function hackGameObject() {

            var originGameObjectEnter = cl.GameObject.prototype.onEnter;
            cl.GameObject.prototype.onEnter = function() {
                if(!_playing) {
                    return;
                }
                originGameObjectEnter.call(this);
            };

            var originGameObjectUpdate = cl.GameObject.prototype.update;
            cl.GameObject.prototype.update = function(dt) {
                if(_paused) {
                    return;
                }
                originGameObjectUpdate.call(this, dt);
            };
        }

        if(_lazyInitEditor) {
            initEditor();
            _lazyInitEditor = false;
        }

        _projectOpened = true;

        hackGameObject();
    }

    function handleProjectClose() {
        _projectOpened = false;
    }

    function loadScene() {
        // hack cocos loader path
        // this will make cocos load res from current project path
        cc.loader.resPath = ProjectManager.getProjectRoot().fullPath;

        var content = _editor.document.getText();
        cl.SceneManager.loadSceneWithContent(content, handleSceneLoaded, true);
    }



    function createCanvas(scene, data) {
        
        var width = 960;
        var height = 640;

        var canvas = new cc.LayerColor(cc.color(0,0,0,255), width, height);
        scene.addChild(canvas);
        scene.canvas = canvas;

        canvas.offset = cl.p();

        if(data && !_playing) {
            canvas.offset = cl.p(data.offset);
            canvas.scale = data.scale;
        }

        canvas.recalculatePosition = function() {
            this.x = cc._canvas.width/2 - this.width/2 + this.offset.x;
            this.y = cc._canvas.height/2 - this.height/2 + this.offset.y;
        };

        canvas.recalculatePosition();

        return canvas;
    }
    cl.createCanvas = createCanvas;


    initCanvas();
    initTopBar();
    initPlayBar();

    Undo.registerUndoType(".scene");

    bracketsEditorManager.on("activeEditorChange", handleActiveEditorChange);

    EventManager.on(EventManager.PROJECT_OPEN,  handleProjectOpen);
    EventManager.on(EventManager.PROJECT_CLOSE, handleProjectClose);
    EventManager.on(EventManager.GAME_START,    loadScene);

    exports.isPlaying = function() {
        return _playing;
    }
});
