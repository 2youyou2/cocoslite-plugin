define(function (require, exports, module) {
    "use strict";

	var Resizer 	   = brackets.getModule("utils/Resizer");

    var html  		   = require("text!html/Hierarchy.html"),
	    Selector       = require("core/Selector"),
	    ObjectManager  = require("core/ObjectManager"),
	    Undo           = require("core/Undo"),
	    Vue   		   = require("thirdparty/vue");

    var $sidebar = $("#sidebar");
    var $content = $("<div id='hierarchy-content' class='hierarchy-content quiet-scrollbars' />");
    $content.insertAfter($sidebar.find(".horz-resizer"));


    var root     = null;
    var tempRoot = null;
    var	objMap   = {};

    function createContent(){
    	$content.empty();
    	$content.append($(html));

    	function select(obj, e){

			// if(self.keyManager.keyDown("cmd") || self.keyManager.keyDown("ctrl")){

			// } 
			// else {
                if(root.currentObjects) {
                	root.currentObjects.forEach(function(item){
                        item.selected = false;
                    });
                }
				
				root.currentObjects = [];
			// }

			if(obj) {
				obj.selected = true;
				root.currentObjects.push(obj);
			}

			var selectedObjs = [];
            
            root.currentObjects.forEach(function(item){
                selectedObjs.push(objMap[item.id]);
            });
			
			Selector.selectObjects(selectedObjs);

			if(e) {
                e.stopPropagation();
            }
		}

		function getObject(data) {
			var id = data.id;
			var obj = objMap[id];
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
				onVisibleChanged: function() {
					this.visible = !this.visible;
					var obj = getObject(this.$data);
					obj.visible = this.visible;
				},
				onLockChanged: function() {
					this.lock = !this.lock;
					var obj = getObject(this.$data);
					obj.lock = this.lock;
				}
			}
		});

		var tree = new Vue({
			el: '#hierarchy',
			data: {
				children: root.children,
				currentObjects: []
			}
		});

    	Resizer.makeResizable($content[0], Resizer.DIRECTION_VERTICAL, Resizer.POSITION_BOTTOM, 10, false, undefined);

		$content.click(function(){
			select(null);
		});
    }

	function addObject(e, obj){

		var data = {name: obj.name, 
					id: obj.__instanceId, 
					children:[],
					visible:true,
					lock:false,
			        open: false,
			        selected: false};

		obj._innerData = data;
		objMap[data.id] = obj;

		var parent = obj.getParent();
		if(parent && parent._innerData) {
            parent._innerData.children.push(data);
        }
		else {
            root = data;
        }
	}

	function removeObject(e, obj){
		var parent = obj.getParent();
		if(parent && parent._innerData){
			var data = parent._innerData;
			for(var i=0; i<data.children.length; i++){
				if(data.children[i] === obj._innerData){
					data.children.splice(i,1);
					return;
				}
			}
		}
	}

	function selectedObjects(e, objs){
        if(root.currentObjects) {
        	root.currentObjects.forEach(function(item){
	            item.selected = false;
	        });
        }

		root.currentObjects = [];

        objs.forEach(function(item){
            var data = item._innerData;
			data.selected = true;
			
			expandToPath(data);

			root.currentObjects.push(data);
        });
	}

	function expandToPath(data) {
		var obj = objMap[data.id];
		var parent = obj.getParent();
		if(parent && parent._innerData) {
			parent._innerData.open = true;
			expandToPath(parent._innerData);
		}
	}

	function clear() {
		$content.find("#hierarchy").empty();
		tempRoot = root = null;
		objMap = {};
	}

	function temp() {
		tempRoot = root;
		root = null;
	}

	function recover() {
		root = tempRoot;
		tempRoot = null;
		createContent();
	}

	ObjectManager.on("addObject", addObject);
	ObjectManager.on("removeObject", removeObject);
	ObjectManager.on("sceneInjected", createContent);
	Selector.on("selectedObjects", selectedObjects);

	exports.clear = clear;
	exports.temp = temp;
	exports.recover = recover;
});