/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager   = brackets.getModule("editor/EditorManager"),
        EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        Project         = require("core/Project"),
        Undo            = require("core/Undo"),
        Inspector       = require("core/Inspector"),
        Selector        = require("core/Selector"),
        Hierarchy       = require("core/Hierarchy"),
        ObjectManager   = require("core/ObjectManager"),
        Cocos           = require("core/Cocos");


    var editor = null;
    var scene = null;
    var $el = null;

    var projectOpened = false;
    var lazyInitEditor = false;

    EventDispatcher.makeEventDispatcher(exports);

    Undo.registerUndoType(".js.scene");


    function setSceneState() {
        cl.fgCanvas.style.display = "";
        Selector.setEnable(true);
    }

    function setGameState() {
        cl.fgCanvas.style.display = "none";
        Selector.setEnable(false);
    }

    var playing = false;
    var paused = false;

    var tempJson = null;

    function beginPlaying() {
        tempJson = scene.toJSON();

        setGameState();
        cl.SceneManager.parseData(tempJson, function(tempScene) {
            cc.director.runScene(tempScene);

            Undo.temp();
            Hierarchy.temp();
            ObjectManager.loadScene(tempScene);
            Selector.temp(tempScene);
            Inspector.temp();

            exports.trigger("beginPlaying", tempScene);
        });
    }

    function endPlaying() {
        setSceneState();
        cc.director.runScene(scene);

        Undo.recover();
        Hierarchy.recover();
        Selector.recover();
        Inspector.recover();

        exports.trigger("endPlaying");
    }

    function play() {
        playing = !playing;
        
        if(playing) {
            beginPlaying();
        }
        else {
            endPlaying();
        }
    }

    function clickPauseBtn() {
        if(this.checked) {
            pause();
        }
        else {
            resume();
        }
    }
    function pause() {
        paused = false;

    }

    function resume() {

    }

    function nextFrame() {
        paused = false;
        cc.director.getScheduler().update(cc.director.getAnimationInterval());
        paused = true;
    }

    function test(scene){
        // var o = new cl.GameObject();
        // o.setPosition(200,200)
        // o.setScale(40)
        // scene.addChild(o);

        // var c = o.addComponent("TerrainComponent");
        // c.terrainMaterial = "cave.tm";
        // c.pixelsPerUnit = 48;
        // c.smoothPath = true;
        // // c.splitCorners = false;

        // var path = o.getComponent("TerrainPathComponent");
        // path.pathVerts = [cl.p(9,2.1), cl.p(5,0), cl.p(0,0), cl.p(0,5), cl.p(7,7)];
        // // path.pathVerts = [cl.p(0,0), cl.p(5,0)];
        // // path.pathVerts = [cl.p(200,200), cl.p(200,0), cl.p(0,0), cl.p(0,200)];
        // path.closed = true;
        

        // var mesh = o.getComponent("MeshComponent");
        // mesh.materials.push("Rocky.png");
        // mesh.materials.push("RockyFill.png");
    }


    function sceneToString() {
        var s = JSON.stringify(scene, null, '\t');
        return s;
    }

    function closeScene() {
        editor = scene = $el = null;
        playing = paused = false;
        cc.director.runScene(new cc.Scene());

        Undo.clear();
        Hierarchy.clear();
        Inspector.clear();
        Selector.clear();

        exports.trigger("sceneClosed");
    }

    function loadScene(s) {
        scene = s;

        cc.director.runScene(s);

        test(s);

        ObjectManager.loadScene(s);
        Selector.loadScene(s);

        exports.trigger("sceneLoaded", s);
    }



    function initEditor(){

        editor.document.getText = sceneToString;

        $el = $("<div>");
        Cocos.initScene($el);

        editor.$el.find(".CodeMirror-scroll").css("display", "none");
        editor.$el.append($el);


        var $gameState    = $('<button id="game-state" style="position:absolute;top:0px;left:10px" >Game </button>');
        var $sceneState   = $('<button id="scene-state" style="position:absolute;top:0px;left:100px">Scene</button>');
        var $playBtn      = $('<button id="play-btn" style="position:absolute;top:0px;left:200px">Play</button>');
        var $pauseBtn     = $('<button id="pause-btn" style="position:absolute;top:0px;left:300px">Pause</button>');
        var $nextFrameBtn = $('<button id="next-frame-btn" style="position:absolute;top:0px;left:400px">NextFrame</button>');

        $el.find(".scene").append($gameState);
        $el.find(".scene").append($sceneState);
        $el.find(".scene").append($playBtn);
        $el.find(".scene").append($pauseBtn);
        $el.find(".scene").append($nextFrameBtn);

        $gameState.click(setGameState);
        $sceneState.click(setSceneState);
        $playBtn.click(play);
        $pauseBtn.click(clickPauseBtn);
        $nextFrameBtn.click(nextFrame);
    }


    function activeEditorChange(event, current, previous) {

        if(previous && previous === editor){
            closeScene();
        }   
        
        editor = null;

        if(!current || !current.document.file.name.endWith(".js.scene")) {
            
            if(Inspector.showing) {
                Inspector.hide();
            }

            return;
        }

        if(!Inspector.showing) {
            Inspector.show();
        }

        editor = current;

        if(projectOpened) {
            initEditor();
        } else {
            lazyInitEditor = true;
        }
    }



    function hackGameObject() {

        var originGameObjectEnter = cl.GameObject.prototype.onEnter;
        cl.GameObject.prototype.onEnter = function() {
            if(!playing) {
                return;
            }
            originGameObjectEnter.call(this);
        }

        var originGameObjectUpdate = cl.GameObject.prototype.update;
        cl.GameObject.prototype.update = function(dt) {
            if(paused) {
                return;
            }
            originGameObjectUpdate.call(this, dt);
        }
    }


    EditorManager.on("activeEditorChange", activeEditorChange);
    Project.on("projectOpen", function() {

        if(lazyInitEditor) {
            initEditor();
            lazyInitEditor = false;
        }

        projectOpened = true;
        hackGameObject();
    });

    Cocos.on("gameStart", function(){
        cc.loader.resPath = ProjectManager.getProjectRoot().fullPath;

        var file = editor.document.file;
        cl.SceneManager.loadScene(file.fullPath, loadScene, true);
    });
});