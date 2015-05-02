define(function (require, exports, module) {
    "use strict";

    var CommandManager  = brackets.getModule("command/CommandManager");

    var Project         = require("core/Project"),
        EventManager    = require("core/EventManager"),
        Undo            = require("core/Undo"),
        Commands        = require("core/Commands"),
        Selector        = require("core/Selector"),
        Strings         = require("strings");


    !function(Object, getPropertyDescriptor, getPropertyNames){
        if (!(getPropertyDescriptor in Object)) {
            var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
            Object[getPropertyDescriptor] = function getPropertyDescriptor(o, name) {
                var proto = o, descriptor;
                while (proto && !(
                    descriptor = getOwnPropertyDescriptor(proto, name))
                ) proto = proto.__proto__;
                return descriptor;
            };
        }
        if (!(getPropertyNames in Object)) {
            var getOwnPropertyNames = Object.getOwnPropertyNames, ObjectProto = Object.prototype, keys = Object.keys;
            Object[getPropertyNames] = function getPropertyNames(o) {
                var proto = o, unique = {}, names, i;
                while (proto != ObjectProto) {
                    for (names = getOwnPropertyNames(proto), i = 0; i < names.length; i++) {
                        unique[names[i]] = true;
                    }
                    proto = proto.__proto__;
                }
                return keys(unique);
            };
        }
    }(Object, "getPropertyDescriptor", "getPropertyNames");
    

    function injectArray(obj, p) {
        var array = obj[p];

        var originPush   = array.push;
        var originSplice = array.splice;

        array.push = function(item){
            var self = this;

            if(!Undo.undoing()){
                (function(){
                    var index = self.length-1;

                    var undo = function(){
                        self.splice(index, 1);
                    }
                    var redo = function(){
                        self.push(item);
                    }
                    Undo.objectPropertyChanged(undo, redo);
                })();
            }

            originPush.call(self, item);
            EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, self, "");
        }

        array.splice = function(){
            var args = arguments;
            var self = this;

            if(!Undo.undoing()){
                (function(){
                    var index  = args[0];
                    var number = args[1];

                    var oldItems = [];
                    for(var i=index; i<index+number; i++){
                        oldItems.push(self[i]);
                    }
                    var newItems = [];
                    for(var i=2; i<args.length; i++){
                        newItems.push(args[i]);
                    }

                    var undo = function(){
                        self.splice(index, newItems.length);
                        for(var i=0; i<oldItems.length; i++){
                            self.splice(index, 0, oldItems[i]);
                        }
                    }
                    var redo = function(){
                        originSplice.apply(self, args);
                        
                        EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, self, "");
                    }
                    Undo.objectPropertyChanged(undo, redo);
                })();
            }

            originSplice.apply(self, arguments);
            EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, self, "");
        }

        array.set = function(index, value){
            var self = this;

            if(!Undo.undoing()){
                (function(){
                    var oldValue = self[index];
                    var newValue = value;

                    var undo = function(){
                        self.set(index, oldValue);
                    }
                    var redo = function(){
                        self.set(index, newValue);
                    }

                    Undo.objectPropertyChanged(undo, redo);
                })();
            }

            self[index] = value;
            EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, self, index);
        }
    }

    function injectObject(obj){
        obj._originProperties = {};
        for(var i=0; i<obj.properties.length; i++){
            var p = obj.properties[i];
            
            (function(p){
                // if property is array
                if(obj[p] && obj[p].constructor == Array) {
                    injectArray(obj, p);
                    return;
                }

                var dsc = Object.getPropertyDescriptor(obj, p);
                if(!dsc) 
                    return;

                var isObject = typeof obj[p] === 'object';


                if(dsc.set || dsc.get){
                    obj._originProperties[p] = {get: dsc.get, set: dsc.set};
                    cl.defineGetterSetter(obj, p, dsc.get, function(){
                        var oldValue = isObject && this[p]._pGet ? this[p]._pGet() : this[p];

                        var func = this._originProperties[p].set;
                        func.apply(this, arguments);
                        EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, this, p);

                        var newValue = isObject && this[p]._pGet ? this[p]._pGet() : this[p];
                        Undo.objectPropertyChanged(oldValue, newValue, this, p);
                    });
                }else{
                    obj._originProperties[p] = obj[p];
                    cl.defineGetterSetter(obj, p, function(){
                        return this._originProperties[p];
                    }, function(val){
                        var oldValue = isObject && this[p]._pGet ? this[p]._pGet() : this[p];

                        this._originProperties[p] = val;
                        EventManager.trigger(EventManager.OBJECT_PROPERTY_CHANGED, this, p);

                        var newValue = isObject && this[p]._pGet ? this[p]._pGet() : this[p];
                        Undo.objectPropertyChanged(oldValue, newValue, this, p);
                    });

                }
            })(p);
        }
    }

    function hackObjectJsonControl() {

        cc.Scene.prototype.toJSON = function(){
            var json = {};
            json.root = {};
            json.root.res = this.res;
            json.root.physics = this.physics;
            var children = json.root.children = [];

            json.root.canvas = {};
            json.root.canvas.offset = this.canvas.offset;
            json.root.canvas.scale = this.canvas.scale;

            for(var k=0; k<this.canvas.children.length; k++){
                var child = this.canvas.children[k];
                if(child.constructor === cl.GameObject){
                    var cj = child.toJSON();
                    children.push(cj);
                }
            }

            return json;
        };

    }

    function hackGameObject () {

        var originAddChild    = cc.Node.prototype.addChild;
        var originRemoveChild = cc.Node.prototype.removeChild;

        var gp = cl.GameObject.prototype;
        var lp = cc.Layer.prototype;

        // hack addChild method
        gp.addChild = lp.addChild = function(child){
            var self = this;

            originAddChild.apply(self, arguments);

            var args = arguments;
            function undo(){
                self.removeChild(child);
            }
            function redo(){
                self.addChild.apply(self, args);
            }

            if(child.constructor === cl.GameObject) {
                EventManager.trigger(EventManager.OBJECT_ADDED, child);
                
                Undo.objectPropertyChanged(undo, redo);
            }
        }

        // hack removeChild method
        gp.removeChild = lp.removeChild = function(child){
            var self = this;

            if(child.constructor === cl.GameObject) {
                EventManager.trigger(EventManager.OBJECT_REMOVED, child);
            }

            originRemoveChild.apply(self, arguments);

            function undo(){
                self.addChild(child);
            }
            function redo(){
                self.removeChild(child);
            }

            if(child.constructor === cl.GameObject) {
                Undo.objectPropertyChanged(undo, redo);
            }
        }


        var originAddComponent = gp.addComponent;
        var originRemoveComponent = gp.removeComponent;

        gp.addComponent = function() {
            var c;
            
            // if gameobject already add this component then return it.
            // also don't need undo/redo
            if(typeof arguments[0] === 'string') {
                c = this.getComponent(arguments[0]);
                if(c) {
                    return c;
                }
            }

            c = originAddComponent.apply(this, arguments);
            EventManager.trigger(EventManager.COMPONENT_ADDED, c);

            var self = this;
            function undo(){
                self.removeComponent(c);
            }
            function redo(){
                self.addComponent(c);
            }
            Undo.objectPropertyChanged(undo, redo);

            return c;
        }

        gp.removeComponent = function() {
            var c = originRemoveComponent.apply(this, arguments);
            EventManager.trigger(EventManager.COMPONENT_REMOVED, c);

            var self = this;
            function undo(){
                self.addComponent(c);
            }
            function redo(){
                self.removeComponent(c);
            }
            Undo.objectPropertyChanged(undo, redo);

            return c;
        }

        var originCtor = gp.ctor;
        gp.ctor = function() {
            originCtor.apply(this, arguments);

            this.lock = false;
            this.open = false;

            injectObject(this);
        }

        gp.properties = gp.properties.concat(["visible", "lock", "open"]);
    }

    function hackComponent() {

        var cp = cl.Component.prototype;
        var originCtor = cp.ctor;

        cp.ctor = function() {
            originCtor.apply(this, arguments);

            injectObject(this);
        }
    }

    function hackCocos() {
        cc.Sprite.prototype.toJSON = cc.Sprite.prototype._pGet = function() {
            var texture = this.getTexture();
            return texture ? texture.url : "";
        };

        cc.Color.prototype.toJSON = function() {
            return cc.colorToHex(this);
        }
    }

    function handleCocosLoaded() {
        hackObjectJsonControl();
        hackGameObject();
        hackComponent();
        hackCocos();
    }


    function createEmptyChildObject() {
        Undo.beginUndoBatch();
        var currentObjects = Selector.getSelectObjects();

        var objs = [];
        if(currentObjects && currentObjects.length>0){
            for(var i in currentObjects){
                var obj = new cl.GameObject();
                currentObjects[i].addChild(obj);
                objs.push(obj);
            }
        } else {
            var scene = cc.director.getRunningScene();
            var obj = new cl.GameObject();
            scene.canvas.addChild(obj);
            objs.push(obj);
        }

        Selector.selectObjects(objs);
        Undo.endUndoBatch();
    }

    function createEmptyObject() {
        Undo.beginUndoBatch();

        var currentObjects = Selector.getSelectObjects();

        var objs = [];
        if(currentObjects && currentObjects.length>0){
            for(var i in currentObjects){
                var obj = new cl.GameObject();
                currentObjects[i].parent.addChild(obj);
                objs.push(obj);
            }
        } else {
            var scene = cc.director.getRunningScene();
            var obj = new cl.GameObject();
            scene.canvas.addChild(obj);
            objs.push(obj);
        }

        Selector.selectObjects(objs);
        Undo.endUndoBatch();
    }


    CommandManager.register(Strings.NEW_EMPTY,       Commands.CMD_NEW_EMPTY_GAME_OBJECT,       createEmptyObject);
    CommandManager.register(Strings.NEW_EMPTY_CHILD, Commands.CMD_NEW_EMPTY_CHILD_GAME_OBJECT, createEmptyChildObject);

    EventManager.on(EventManager.COCOS_LOADED, handleCocosLoaded);
});
