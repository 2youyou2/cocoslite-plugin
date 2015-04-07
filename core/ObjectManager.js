define(function (require, exports, module) {
    "use strict";

    var EventDispatcher = brackets.getModule("utils/EventDispatcher"),
    	Project         = require("core/Project"),
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
	

    function addObject(obj){
    	if(obj.constructor !== cl.GameObject && obj.constructor !== cc.Scene && obj.constructor !== cc.Layer) {
    		return;
    	}

		exports.trigger("addObject",obj);

		if(obj._injected) return;
		obj._injected = true;

		obj._originAddChildFunc = obj.addChild;
		obj.addChild = function(child){
			obj._originAddChildFunc.apply(obj, arguments);
			addObject(child);

			var args = arguments;
			function undo(){
				obj.removeChild(child);
			}
			function redo(){
				obj.addChild.apply(obj, args);
			}
			Undo.objectPropertyChanged(undo, redo);
		}

		obj._originRemoveChildFunc = obj.removeChild;
		obj.removeChild = function(child){
			removeObject(child);
			obj._originRemoveChildFunc.apply(obj, arguments);

			function undo(){
				obj.addChild(child);
			}
			function redo(){
				obj.removeChild(child);
			}
			Undo.objectPropertyChanged(undo, redo);
		}


    	var children = obj.children;
		for(var i=0; i<children.length; i++){
			var c = children[i];
			addObject(c);
		}

		if(obj.components){
			for(var k in obj.components){
				var c = obj.components[k];

				injectObject(c);
				exports.trigger("addComponent", c);
			}

			obj._originAddComponentFunc = obj.addComponent;
			obj.addComponent = function(){
				var c = obj._originAddComponentFunc.apply(obj, arguments);
				injectObject(c);
				exports.trigger("addComponent", c);

				return c;
			}

			obj._originRemoveComponentFunc = obj.removeComponent;
			obj.removeComponent = function(){
				var c = obj._originRemoveComponentFunc.apply(obj, arguments);
				exports.trigger("removeComponent", c);

				return c;
			}
		}
	};

	function removeObject(obj){
		exports.trigger("removeObject", obj);
	};

	function injectObject(obj){
		obj._originProperties = {};
		for(var i=0; i<obj.properties.length; i++){
			var p = obj.properties[i];
			
			(function(p){
				// if property is array
				if(obj[p] && obj[p].constructor == Array){
					var array = obj[p];

					array._originPush = array.push;
					array.push = function(item){

						if(!Undo.undoing()){
							(function(){
								var index = array.length-1;

								var undo = function(){
									array.splice(index, 1);
								}
								var redo = function(){
									array.push(item);
								}
								Undo.objectPropertyChanged(undo, redo);
							})();
						}

						array._originPush.apply(array, item);
						exports.trigger("objectPropertyChanged", array, "");
					}

					array._originSplice = array.splice;
					array.splice = function(){
						// var item = array[index];
						var args = arguments;

						if(!Undo.undoing()){
							(function(){
								var index  = args[0];
								var number = args[1];

								var oldItems = [];
								for(var i=index; i<index+number; i++){
									oldItems.push(array[i]);
								}
								var newItems = [];
								for(var i=2; i<args.length; i++){
									newItems.push(args[i]);
								}

								var undo = function(){
									array.splice(index, newItems.length);
									for(var i=0; i<oldItems.length; i++){
										array.splice(index, 0, oldItems[i]);
									}
								}
								var redo = function(){
									array._originSplice.apply(array, args);
									
									exports.trigger("objectPropertyChanged", array, "");
								}
								Undo.objectPropertyChanged(undo, redo);
							})();
						}

						array._originSplice.apply(array, arguments);
						exports.trigger("objectPropertyChanged", array, "");
					}

					array.set = function(index, value){

						if(!Undo.undoing()){
							(function(){
								var oldValue = array[index];
								var newValue = value;

								var undo = function(){
									array.set(index, oldValue);
								}
								var redo = function(){
									array.set(index, newValue);
								}

								Undo.objectPropertyChanged(undo, redo);
							})();
						}

						array[index] = value;
						exports.trigger("objectPropertyChanged", array, index);
					}
				}

				var dsc = Object.getPropertyDescriptor(obj, p);
				if(!dsc) 
					return;

				if(dsc.set || dsc.get){
					obj._originProperties[p] = {get: dsc.get, set: dsc.set};
					cl.defineGetterSetter(obj, p, dsc.get, function(){
						var oldValue = this[p];

						var func = this._originProperties[p].set;
						func.apply(this, arguments);
						exports.trigger("objectPropertyChanged", this, p);

						var newValue = this[p];
						Undo.objectPropertyChanged(oldValue, newValue, this, p);
					});
				}else{
					obj._originProperties[p] = obj[p];
					cl.defineGetterSetter(obj, p, function(){
						return this._originProperties[p];
					}, function(val){
						var oldValue = this[p];

						this._originProperties[p] = val;
						exports.trigger("objectPropertyChanged", this, p);

						var newValue = this[p];
						Undo.objectPropertyChanged(oldValue, newValue, this, p);
					});

				}
			})(p);
		}
	}

	function inject(scene) {
		addObject(scene.canvas);
	}

	function loadScene(scene) {
		inject(scene);
		exports.trigger("sceneInjected")
	}



    function hackObjectToJson() {

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

            return json;
        };

        cl.Component.prototype.toJSON = function(){
            var json = {};
            json.class = this.classname;

            for(var i=0; i<this.properties.length; i++){
                var k = this.properties[i];

                if(this["toJSON"+k]) {
                    json[k] = this["toJSON"+k]();
                }
                else {
                    json[k] = this[k];
                }
            }
            return json;
        };
    }

    EventDispatcher.makeEventDispatcher(exports);

    Project.on("projectOpen", hackObjectToJson);

	exports.loadScene = loadScene;
	exports.inject = inject;
});