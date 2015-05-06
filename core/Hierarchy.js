define(function (require, exports, module) {
    "use strict";

    var Resizer        = brackets.getModule("utils/Resizer"),
        AppInit        = brackets.getModule("utils/AppInit");

    var html           = require("text!html/Hierarchy.html"),
        Selector       = require("core/Selector"),
        Undo           = require("core/Undo"),
        EventManager   = require("core/EventManager"),
        Vue            = require("thirdparty/vue");

    var _$content;
    var _keyManager;

    var _root     = {children:[]};
    var _tempRoot = null;
    var _objMap   = {};

    function createContent(){
        _$content.empty();
        _$content.append($(html));

        function select(item, e){

            var obj = item ? _objMap[item.id] : null;

            var ctrlKey = brackets.platform === 'mac' ? 91 : cc.KEY.ctrl;
            var ctrlKeyDown = _keyManager.matchKeyDown(ctrlKey);

            Selector.clickOnObject(obj, ctrlKeyDown);

            if(e) {
                e.stopPropagation();
            }
        }

        function getObject(data) {
            var id = data.id;
            var obj = _objMap[id];
            if(!obj) {
                console.error("object with id [%s] can't find.", id);
            }
            return obj;
        }

        Vue.component('hierarchy-folder', {
            template: '#hierarchy-folder-template',
            data: function() {
                return {};
            },
            methods:{
                select: select,
                changeValue: function(key) {
                    Undo.beginUndoBatch();
                    
                    var obj = getObject(this.$data);
                    obj[key] = !this[key];

                    Undo.endUndoBatch();
                },
                onVisibleChanged: function() {
                    this.changeValue('visible');
                },
                onLockChanged: function() {
                    this.changeValue('lock');
                },
                onCollipseChanged: function() {
                    this.changeValue('open');
                }
            }
        });

        var tree = new Vue({
            el: '#hierarchy',
            data: {
                children: _root.children,
                currentObjects: []
            }
        });

        Resizer.makeResizable(_$content[0], Resizer.DIRECTION_VERTICAL, Resizer.POSITION_BOTTOM, 10, false, undefined, undefined, undefined, true);

        _$content.click(function(){
            select(null);
        });
    }

    function createData (obj) {
        var data = {
            children:[],
            selected: false
        };

        if(obj) {
            data.id = obj.__instanceId;

            obj.properties.forEach(function(p){
                data[p] = obj[p];
            });
        }

        return data;
    }

    function addObject(e, obj){

        var data = createData(obj);

        obj._innerData = data;
        _objMap[data.id] = obj;

        var parent = obj.getParent();
        var parentData = parent._innerData;

        if(!parentData) {
            parent._innerData = _root;
            parentData = _root;
        }

        parentData.children.push(data);
    }

    function removeObject(e, obj){
        var parent = obj.getParent();
        var parentData = parent._innerData;

        var index = parentData.children.indexOf(obj._innerData);
        if(index !== -1) {
            parentData.children.splice(index,1);
        }
    }

    function selectedObjects(e, objs){
        if(_root.currentObjects) {
            _root.currentObjects.forEach(function(item){
                item.selected = false;
            });
        }

        _root.currentObjects = [];

        objs.forEach(function(item){
            var data = item._innerData;
            data.selected = true;
            
            expandToPath(data);

            _root.currentObjects.push(data);
        });
    }

    function expandToPath(data) {
        var obj = _objMap[data.id];

        if(obj) {
            var parent = obj.getParent();

            if(parent) {
                parent._innerData.open = true;
                expandToPath(parent._innerData);
            }
        }
    }

    function clear() {
        _$content.find("#hierarchy").empty();
        _root = {children:[]};
        _tempRoot = null;
        _objMap = {};
    }

    function temp(e, tempScene) {
        _tempRoot = _root;
        _root = {children:[]};
    }

    function recover() {
        _root = _tempRoot;
        _tempRoot = null;
        createContent();
    }

    AppInit.htmlReady(function() {
        // Hierarchy content
        _$content = $("<div id='hierarchy-content' class='hierarchy-content quiet-scrollbars' />");
        _$content.attr("tabindex", 99);
        _$content.insertAfter($("#sidebar").find(".horz-resizer"));

        // Hierarchy title
        $('<div class="hierarchy-header panel-header" style="display: block;">' +
            '<span class="hierarchy-header-title">Hierarchy</span>' +
        '</div>').insertBefore(_$content);
    });

    EventManager.on(EventManager.OBJECT_PROPERTY_CHANGED, function(e, object, property) {
        var properties = object.properties;
        if(properties && properties.indexOf(property) === -1) {
            return;
        }

        var data = object._innerData;
        if(data) {
            data[property] = object[property];
        }
    });

    EventManager.on(EventManager.PROJECT_OPEN, function() {
        _keyManager = new cl.KeyManager(_$content[0]);
    })

    EventManager.on(EventManager.OBJECT_ADDED,         addObject);
    EventManager.on(EventManager.OBJECT_REMOVED,       removeObject);
    
    EventManager.on(EventManager.SCENE_LOADED,         createContent);
    EventManager.on(EventManager.SCENE_CLOSED,         clear);
    EventManager.on(EventManager.SELECT_OBJECTS,       selectedObjects);
    EventManager.on(EventManager.SCENE_BEFORE_PLAYING, temp);
    EventManager.on(EventManager.SCENE_BEGIN_PLAYING,  createContent);
    EventManager.on(EventManager.SCENE_END_PLAYING,    recover);

    exports.clear = clear;
});
