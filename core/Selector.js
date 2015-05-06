/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager   = require("editor/EditorManager"),
        EventManager    = require("core/EventManager"),
        Undo            = require("core/Undo");


    var _inited = false;

    var _mousedown = false;
    
    var _tempSelectedObjects = [];
    var _selectedObjects = [];

    var _currentDelegate = null;

    var _enable = true;

    function setEnable(e) {
        _enable = e;
    }
    

    function clickOnObject(obj, ctrlKeyDown) {
        var objs = obj ? [obj] : [];


        if(obj) {
            var ctrlKey = brackets.platform === 'mac' ? 91 : cc.KEY.ctrl;

            if(ctrlKeyDown || cl.keyManager.matchKeyDown(ctrlKey)) {
                var index = _selectedObjects.indexOf(obj);

                if(index === -1) {
                    objs = _selectedObjects.concat(objs);
                } else {
                    objs = _selectedObjects.filter(function(v, k) {
                        return k !== index;
                    });
                }
            }
        }

        selectObjects(objs);
    }

    function initListener() {
        if(_inited) {
            return;
        }
        _inited = true;

        cc.eventManager.addListener(cc.EventListener.create({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            onTouchBegan: function (touch, event) {
                
                if(!_enable) {
                    return;
                }

                _mousedown = true;

                Undo.beginUndoBatch();

                _currentDelegate = null;
                var delegates = EditorManager.getOrderedEditors();
                for(var i=0; i<delegates.length; i++){
                    if(delegates[i].onTouchBegan && delegates[i].onTouchBegan(touch)){
                        _currentDelegate = delegates[i];
                        return true;
                    }
                }

                var worldPoint = touch.getLocation();

                var hitTest = function(object) {

                    var children = object.children;
                    for(var i=children.length-1; i>=0; i--){
                        var o = hitTest(children[i]);
                        if(o) {
                            return o;
                        }
                    }
                    
                    if(object.constructor === cl.GameObject){
                        if(!object.lock && object.visible && object.hitTest(worldPoint)) {
                            return object;
                        }
                    }

                    return null;
                };
                
                var scene = cc.director.getRunningScene();
                var obj = hitTest(scene);
                
                clickOnObject(obj);

                return true;
            },
            onTouchMoved: function(touch, event){

                if(_currentDelegate && _currentDelegate.onTouchMoved){
                    _currentDelegate.onTouchMoved(touch, _selectedObjects);
                    return;
                }

            },
            onTouchEnded: function(touch, event){
                _mousedown = false;

                if(_currentDelegate && _currentDelegate.onTouchEnded){
                    _currentDelegate.onTouchEnded(touch);
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

        // whether _selectedObjects changed
        var selectedObjectsChanged = _selectedObjects.length !== objs.length;

        if(!selectedObjectsChanged) {
            for(var i=0; i<_selectedObjects.length; i++){
                if(_selectedObjects[i] != objs[i]){
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
            var oldObjs = _selectedObjects.slice(0);
            var newObjs = objs.slice(0);

            function undo(){
                selectObjects(oldObjs);
            }
            function redo(){
                selectObjects(newObjs);
            }

            Undo.objectPropertyChanged(undo, redo, false);
        })();

        _selectedObjects = objs;
        EventManager.trigger(EventManager.SELECT_OBJECTS, _selectedObjects);

        Undo.endUndoBatch();

    }

    function clear() {
        _tempSelectedObjects = _selectedObjects = [];
    }

    function handleBeginPlaying(e, s) {
        _tempSelectedObjects = _selectedObjects;
        _selectedObjects = [];

        Undo.setEnable(false);
        EventManager.trigger(EventManager.SELECT_OBJECTS, _selectedObjects);
        Undo.setEnable(true);
    }

    function handleEndPlaying() {
        _selectedObjects = _tempSelectedObjects;
        _tempSelectedObjects = [];

        Undo.setEnable(false);
        EventManager.trigger(EventManager.SELECT_OBJECTS, _selectedObjects);
        Undo.setEnable(true);
    }

    function handleSceneSwitchState(e, state) {
        if(state === 'game') {
            _enable = false;
        } else if(state === 'scene') {
            _enable = true;
        }
    }

    EventManager.on(EventManager.PROJECT_OPEN,        initListener);
    EventManager.on(EventManager.SCENE_SWITCH_STATE,  handleSceneSwitchState);
    EventManager.on(EventManager.SCENE_BEGIN_PLAYING, handleBeginPlaying);
    EventManager.on(EventManager.SCENE_END_PLAYING,   handleEndPlaying);
    EventManager.on(EventManager.SCENE_CLOSED,        clear);

    exports.selectObjects = selectObjects;
    exports.clickOnObject = clickOnObject;
    exports.setEnable = setEnable;
    exports.getSelectObjects = function() { return _selectedObjects; }
    exports.clear = clear;
});
