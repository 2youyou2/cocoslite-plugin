/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager   = brackets.getModule("editor/EditorManager"),
        EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        StatusBar       = brackets.getModule("widgets/StatusBar"),
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

    function initBackground(scene) {
        var node = new cc.DrawNode();
        scene.addChild(node, -1);

        var g = 30;
        var w = 80;

        for(var i=0; i<g; i++) {
            node.drawSegment(cl.p(0,i*w), cl.p(w*g, i*w), 1, cc.color(150, 150, 150, 170));
            node.drawSegment(cl.p(i*w,0), cl.p(i*w, w*g), 1, cc.color(150, 150, 150, 170));
        }
    }

    function createCanvas(scene, data) {
        var canvas = new cc.Layer();
        scene.addChild(canvas);
        scene.canvas = canvas;

        var width = 480;
        var height = 360;

        if(data && !playing) {
            canvas.x = data.x;
            canvas.y = data.y;
            canvas.scale = data.scale;    
        } else {
            var offset = Inspector.width();
            canvas.x = cc._canvas.width/2 - width/2 - offset/2;
            canvas.y = cc._canvas.height/2 - height/2;
        }

        var node = new cc.DrawNode();
        canvas.addChild(node);

        node.drawRect(cl.p(0,0), cl.p(width,height), cc.color(0, 0, 0, 0), 2, cc.color(100, 100, 100, 200));

        initBackground(scene);

        return canvas;
    }

    function initEditor(){

        editor.document.getText = sceneToString;

        $el = $("<div>");
        Cocos.initScene($el);

        editor.$el.css("display", "none");
        $('.pane-content').append($el);


        var $gameState    = $('<button id="game-state" >Game </button>');
        var $sceneState   = $('<button id="scene-state" >Scene</button>');
        var $playBtn      = $('<button id="play-btn" >Play</button>');
        var $pauseBtn     = $('<button id="pause-btn" >Pause</button>');
        var $nextFrameBtn = $('<button id="next-frame-btn" >NextFrame</button>');

        var $playBar = $('<div id="play-bar" style="position:absolute;top:0px;width:100%;height:5%"/>');

        $playBar.append($gameState);
        $playBar.append($sceneState);
        $playBar.append($playBtn);
        $playBar.append($pauseBtn);
        $playBar.append($nextFrameBtn);

        $playBar.insertBefore($el.find(".scene"));

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
            StatusBar.show();

            return;
        }

        if(!Inspector.showing) {
            Inspector.show();
        }
        StatusBar.hide();

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
        cl.createCanvas = createCanvas;

        $('#main-toolbar').css({display:'none'});
    });

    Cocos.on("gameStart", function(){
        cc.loader.resPath = ProjectManager.getProjectRoot().fullPath;

        var file = editor.document.file;
        cl.SceneManager.loadScene(file.fullPath, loadScene, true);
    });
});