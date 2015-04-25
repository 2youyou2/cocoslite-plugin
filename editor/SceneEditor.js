/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var AppInit                 = brackets.getModule("utils/AppInit"),
        WorkspaceManager        = brackets.getModule("view/WorkspaceManager"),
        Menus                   = brackets.getModule("command/Menus"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        StatusBar               = brackets.getModule("widgets/StatusBar");

    var Project                 = require("core/Project"),
        Commands                = require("core/Commands"),
        Strings                 = require("strings"),
        EventManager            = require("core/EventManager"),
        Undo                    = require("core/Undo"),
        Inspector               = require("core/Inspector"),
        ObjectManager           = require("core/ObjectManager"),
        Cocos                   = require("core/Cocos");


    var _editor = null;
    var _scene = null;

    var _projectOpened = false;
    var _lazyInitEditor = false;


    Undo.registerUndoType(".scene");


    var _playing = false;
    var _paused = false;

    function initPlayBar() {

        // game state html
        var $state        = $('<span id="state-container" ></span>');
        var $sceneState   = $('<span id="scene-state"class="state" title="Switch to Scene Editor Mode">Scene</span>');
        var $gameState    = $('<span id="game-state" class="state disactive" title="Switch to Game Mode">Game</span>');

        $state.append($sceneState);
        $state.append($gameState);

        // game controller html
        var $controller   = $('<span id="controller-container" ></span>');
        var $playBtn      = $('<span id="play-btn" class="fa-play game-control-btn" title="Play game"></span>');
        var $pauseBtn     = $('<span id="pause-btn" class="fa-pause game-control-btn" title="Pause game"></span>');
        var $nextFrameBtn = $('<span id="next-frame-btn" class="fa-step-forward game-control-btn" title="Go to next frame"></span>');

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

            $playBtn.addClass('checked');
        }

        function endPlaying() {
            switchToSceneState();
            cc.director.runScene(_scene);

            EventManager.trigger(EventManager.SCENE_END_PLAYING);

            $playBtn.removeClass('checked');
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
                $pauseBtn.addClass('checked');
            } else {
                $pauseBtn.removeClass('checked');
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

        var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
        menu.addGameEditorMenuDivider();
        menu.addGameEditorMenuItem(Commands.CMD_PLAY);
        menu.addGameEditorMenuItem(Commands.CMD_PAUSE);
        menu.addGameEditorMenuItem(Commands.CMD_STEP);
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
        var $scene = Cocos.getSceneHtml();
        $el.append($scene);

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

    function handlePojectOpen() {

        function createCanvas(scene, data) {
            var canvas = new cc.Layer();
            scene.addChild(canvas);
            scene.canvas = canvas;

            var width = 480;
            var height = 360;

            if(data && !_playing) {
                canvas.x = data.x;
                canvas.y = data.y;
                canvas.scale = data.scale;    
            } else {
                canvas.x = cc._canvas.width/2 - width/2;
                canvas.y = cc._canvas.height/2 - height/2;
            }

            // draw a black background canvas
            var node = new cc.DrawNode();
            canvas.addChild(node);

            node.drawRect(cl.p(0,0), cl.p(width,height), cc.color(0, 0, 0, 255), 0, cc.color(100, 100, 100, 200));

            return canvas;
        }

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
        cl.createCanvas = createCanvas;

        hackGameObject();
        initPlayBar();
    }

    function loadScene() {
        // hack cocos loader path
        // this will make cocos load res from current project path
        cc.loader.resPath = ProjectManager.getProjectRoot().fullPath;

        var content = _editor.document.getText();
        cl.SceneManager.loadSceneWithContent(content, handleSceneLoaded, true);
    }


    EditorManager.on("activeEditorChange", handleActiveEditorChange);

    EventManager.on(EventManager.PROJECT_OPEN, handlePojectOpen);
    EventManager.on(EventManager.GAME_START,   loadScene);
});
