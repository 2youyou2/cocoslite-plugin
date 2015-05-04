/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl, cc*/

define(function (require, exports, module) {
    "use strict";

    var Selector         = require("core/Selector"),
        Undo             = require("core/Undo"),
        EventManager     = require("core/EventManager");

    var _pool = [];

    function clear() {
        _pool = [];
    }

    function copy() {
        clear();

        var objs = Selector.getSelectObjects();
        objs.forEach(function(obj) {
            _pool.push(obj.toJSON());
        });
    }

    function cut() {
        clear();
        
        Undo.beginUndoBatch();

        var objs = Selector.getSelectObjects().concat([]);
        objs.forEach(function(obj) {
            _pool.push(obj.toJSON());
            obj.removeFromParent();
        });

        Selector.selectObjects([]);

        Undo.endUndoBatch();
    }

    function pasteTo(parent) {
        var objs = [];
        
        _pool.forEach(function(json) {

            // undo need to disable when deserialize
            Undo.setEnable(false);

            var obj = cl.GameObject.fromJSON(json);

            Undo.setEnable(true);

            parent.addChild(obj);
            objs.push(obj);
        });

        return objs;
    }

    function paste() {
        Undo.beginUndoBatch();

        var currentObjects = Selector.getSelectObjects();

        var objs = [];
        if(currentObjects && currentObjects.length>0){
            for(var i in currentObjects){
                var os = pasteTo(currentObjects[i].parent);
                objs = objs.concat(os);
            }
        } else {
            var scene = cc.director.getRunningScene();
            objs = pasteTo(scene.canvas);
        }

        Selector.selectObjects(objs);
        Undo.endUndoBatch();
    }

    function init() {
        document.body.addEventListener('copy',  copy);
        document.body.addEventListener('cut',   cut);
        document.body.addEventListener('paste', paste);
    }

    EventManager.on(EventManager.SCENE_CLOSED, clear);

    init();
});