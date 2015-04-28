/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager   = require("editor/EditorManager"),
        EventManager    = require("core/EventManager"),
        Undo            = require("core/Undo");


    var inited = false;

    var mousedown = false;
    
    var scene = null;
    var tempScene = null;
    var tempSelectedObjects = [];
    var selectedObjects = [];

    var currentDelegate = null;

    var enable = true;

    function setEnable(e) {
        enable = e;
    }
    

    function clickOnObject(obj, ctrlKeyDown) {
        var objs = obj ? [obj] : [];


        if(obj) {
            var ctrlKey = brackets.platform === 'mac' ? 91 : cc.KEY.ctrl;

            if(ctrlKeyDown || cl.keyManager.matchKeyDown(ctrlKey)) {
                var index = selectedObjects.indexOf(obj);

                if(index === -1) {
                    objs = selectedObjects.concat(objs);
                } else {
                    objs = selectedObjects.filter(function(v, k) {
                        return k !== index;
                    });
                }
            }
        }

        selectObjects(objs);
    }

    function initListener(){
        if(inited) {
            return;
        }
        inited = true;

        cc.eventManager.addListener(cc.EventListener.create({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            onTouchBegan: function (touch, event) {
                
                if(!enable) {
                    return;
                }

                mousedown = true;

                Undo.beginUndoBatch();

                currentDelegate = null;
                var delegates = EditorManager.getOrderedEditors();
                for(var i=0; i<delegates.length; i++){
                    if(delegates[i].onTouchBegan && delegates[i].onTouchBegan(touch)){
                        currentDelegate = delegates[i];
                        return true;
                    }
                }

                var worldPoint = touch.getLocation();

                var hitTest = function(object){
                    if(object.constructor === cl.GameObject){
                        if(!object.lock && object.visible && object.hitTest(worldPoint)) {
                            return object;
                        }
                    }

                    var children = object.children;
                    for(var i=children.length-1; i>=0; i--){
                        var o = hitTest(children[i]);
                        if(o) {
                            return o;
                        }
                    }

                    return null;
                };
                
                var obj = hitTest(scene);
                
                clickOnObject(obj);

                return true;
            },
            onTouchMoved: function(touch, event){

                if(currentDelegate && currentDelegate.onTouchMoved){
                    currentDelegate.onTouchMoved(touch, selectedObjects);
                    return;
                }

                // for(var i in selectedObjects){
                //  var t = selectedObjects[i].getComponent("TransformComponent");
                //     var delta = touch.getDelta();
                //     t.position = cc.pAdd(t.position, delta);
                // }
            },
            onTouchEnded: function(touch, event){
                mousedown = false;

                if(currentDelegate && currentDelegate.onTouchEnded){
                    currentDelegate.onTouchEnded(touch);
                }

                Undo.endUndoBatch();
            }
        }), 10000);


        cc.eventManager.addListener(cc.EventListener.create({
            event: cc.EventListener.MOUSE,
            onMouseMove: function(event){
                var delegates = EditorManager.getOrderedEditors();
                for(var i=0; i<delegates.length; i++){
                    if(delegates[i].onMouseMove){
                        delegates[i].onMouseMove(event);
                    }
                }
            }
        }), 10000);
    }


    function selectObjects(objs) {

        // whether selectedObjects changed
        var selectedObjectsChanged = selectedObjects.length !== objs.length;

        if(!selectedObjectsChanged) {
            for(var i=0; i<selectedObjects.length; i++){
                if(selectedObjects[i] != objs[i]){
                    selectedObjectsChanged = true;
                    break;
                }
            }
        }
        
        if(!selectedObjectsChanged) {
            return;
        }

        // pack undo
        Undo.beginUndoBatch();

        (function(){
            var oldObjs = selectedObjects.slice(0);
            var newObjs = objs.slice(0);

            function undo(){
                selectObjects(oldObjs);
            }
            function redo(){
                selectObjects(newObjs);
            }

            Undo.objectPropertyChanged(undo, redo, false);
        })();

        selectedObjects = objs;
        EventManager.trigger(EventManager.SELECT_OBJECTS, selectedObjects);

        Undo.endUndoBatch();

    }

    function clear() {
        tempSelectedObjects = selectedObjects = [];
        tempScene = scene = null;
    }

    function temp(e, s) {
        tempSelectedObjects = selectedObjects;
        selectedObjects = [];

        tempScene = scene;
        scene = s;
    }

    function recover() {
        selectedObjects = tempSelectedObjects;
        tempSelectedObjects = [];

        scene = tempScene;
        tempScene = null;
    }
    
    function handleSceneLoaded(e, s) {
        scene = s;
    }

    function handleSceneSwitchState(e, state) {
        if(state === 'game') {
            enable = false;
        } else if(state === 'scene') {
            enable = true;
        }
    }

    EventManager.on(EventManager.SCENE_LOADED,        handleSceneLoaded);
    EventManager.on(EventManager.PROJECT_OPEN,        initListener);
    EventManager.on(EventManager.SCENE_SWITCH_STATE,  handleSceneSwitchState);
    EventManager.on(EventManager.SCENE_BEGIN_PLAYING, temp);
    EventManager.on(EventManager.SCENE_END_PLAYING,   recover);
    EventManager.on(EventManager.SCENE_CLOSED,        clear);

    exports.selectObjects = selectObjects;
    exports.clickOnObject = clickOnObject;
    exports.setEnable = setEnable;
    exports.getSelectObjects = function() { return selectedObjects; }
    exports.clear = clear;
});
