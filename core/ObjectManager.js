define(function (require, exports, module) {
    "use strict";

    var Project         = require("core/Project"),
        EventManager    = require("core/EventManager"),
    	Undo 		    = require("core/Undo");


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
            var children = json.root.children = [];

            json.root.canvas = {};
            json.root.canvas.x = this.canvas.x;
            json.root.canvas.y = this.canvas.y;
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


        cl.GameObject.prototype.toJSON = function(){
            var json = {};

            var components = json.components = [];

            var cs = this.components;
            for(var i in cs) {
                components.push(cs[i].toJSON());
            }

            for(var k=0; k<this.children.length; k++){
                var child = this.children[k];
                if(child.constructor === cl.GameObject){
                    
                    if(!json.children) {
                        json.children = [];
                    }

                    var cj = child.toJSON();
                    json.children.push(cj);
                }
            }

            var self = this;
            this.properties.forEach(function(p) {
				json[p] = self[p];
			});

            return json;
        };

        cl.Component.prototype.toJSON = function(){
            var json = {};
            json.class = this.classname;

            for(var i=0; i<this.properties.length; i++){
                var k = this.properties[i];

                var value = this[k];

                if(this["toJSON"+k]) {
                    json[k] = this["toJSON"+k]();
                }
                else if(value !== null || value !== undefined){
                    json[k] = value.toJSON ? value.toJSON() : value;
                }
            }
            return json;
        };



        // hack parse json to GameObject.
        // crate inner data for GameObject.
        // inner data is used for editor data storage
		var originParseGameObject = cl.SceneManager.parseGameObject;
		cl.SceneManager.parseGameObject = function(parent, data) {
			var o = originParseGameObject.apply(this, arguments);
			
			o.properties.forEach(function(p) {
				o[p] = data[p] === undefined ? o[p] : data[p];
			});

			return 0;
		}
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

			if(child.constructor === cl.GameObject) {
				EventManager.trigger(EventManager.OBJECT_ADDED, child);
			}

			var args = arguments;
			function undo(){
				self.removeChild(child);
			}
			function redo(){
				self.addChild.apply(self, args);
			}
			Undo.objectPropertyChanged(undo, redo);
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
			Undo.objectPropertyChanged(undo, redo);
		}


		var originAddComponent = gp.addComponent;
		var originRemoveComponent = gp.removeComponent;

		gp.addComponent = function() {
			var c = originAddComponent.apply(this, arguments);
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

			this.properties = ["visible", "lock", "open", "name"];
			injectObject(this);
		}
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

    EventManager.on(EventManager.COCOS_LOADED, handleCocosLoaded);
});