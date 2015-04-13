/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager   = brackets.getModule("editor/EditorManager"),
        EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        StatusBar       = brackets.getModule("widgets/StatusBar");

    var Project         = require("core/Project"),
        Undo            = require("core/Undo"),
        Inspector       = require("core/Inspector"),
        Selector        = require("core/Selector"),
        Hierarchy       = require("core/Hierarchy"),
        ObjectManager   = require("core/ObjectManager"),
        Cocos           = require("core/Cocos");


    EventDispatcher.makeEventDispatcher(exports);

    var _editor = null;
    var _scene = null;

    var _projectOpened = false;
    var _lazyInitEditor = false;


    Undo.registerUndoType(".js.scene");


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
            Selector.setEnable(false);

            $gameState.removeClass('disactive');
            $sceneState.addClass('disactive');
        }

        function switchToSceneState() {
            cl.fgCanvas.style.display = "";
            Selector.setEnable(true);

            $gameState.addClass('disactive');
            $sceneState.removeClass('disactive');
        }

        function beginPlaying() {
            var tempJson = _scene.toJSON();

            switchToGameState();
            cl.SceneManager.parseData(tempJson, function(tempScene) {
                cc.director.runScene(tempScene);

                Undo.temp();
                Hierarchy.temp();
                ObjectManager.loadScene(tempScene);
                Selector.temp(tempScene);
                Inspector.temp();

                exports.trigger("beginPlaying", tempScene);
            });

            $playBtn.addClass('checked');
        }

        function endPlaying() {
            switchToSceneState();
            cc.director.runScene(_scene);

            Undo.recover();
            Hierarchy.recover();
            Selector.recover();
            Inspector.recover();

            exports.trigger("endPlaying");

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

        function clickPauseBtn() {
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
        $pauseBtn.click(clickPauseBtn);
        $nextFrameBtn.click(nextFrame);
    }

    
    function initEditor() {

        function sceneToString() {
            var str = JSON.stringify(_scene, null, '\t');
            return str;
        }

        _editor.document.getText = sceneToString;

        var $el = $("<div class='scene-editor'>");
        Cocos.initScene($el);

        _editor.$el.css("display", "none");
        $('.pane-content').append($el);
    }

    function closeScene() {
        _editor = _scene = null;
        _playing = _paused = false;
        cc.director.runScene(new cc.Scene());

        Undo.clear();
        Hierarchy.clear();
        Inspector.clear();
        Selector.clear();

        exports.trigger("sceneClosed");
    }

    function handleSceneLoaded(s) {
        _scene = s;

        cc.director.runScene(_scene);

        ObjectManager.loadScene(_scene);
        Selector.loadScene(_scene);

        exports.trigger("sceneLoaded", _scene);
    }


    function handleActiveEditorChange(event, current, previous) {

        if(previous && previous === _editor){
            closeScene();
        }   
        
        _editor = null;

        if(!current || !current.document.file.name.endWith(".js.scene")) {
            
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

    function handleGameStart() {
        // hack cocos loader path
        // this will make cocos load res from current project path
        cc.loader.resPath = ProjectManager.getProjectRoot().fullPath;

        var fullPath = _editor.document.file.fullPath;
        cl.SceneManager.loadScene(fullPath, handleSceneLoaded, true);
    }


    EditorManager.on("activeEditorChange", handleActiveEditorChange);
    Project.on("projectOpen", handleProjectOpen);
    Cocos.on("gameStart", handleGameStart);
});