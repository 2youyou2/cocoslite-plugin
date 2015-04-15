/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager"),
        Menus          = brackets.getModule("command/Menus");

    var Selector       = require("core/Selector"),
    	Undo           = require("core/Undo"),
        Project        = require("core/Project"),
        EventManager   = require("core/EventManager"),
        ObjectManager  = require("core/ObjectManager");


    var currentObjects = null;

    var cmds = [];
    var objectMenu = null;
    var componentMenu = null;

    function createEmptyObject() {
    	Undo.beginUndoBatch();

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

    function registerCommand() {
    	CommandManager.register("Create Empty", "cl.GameObject.CreateEmpty", createEmptyObject);

        var cs = cl.ComponentManager.getAllClasses();
    	for(var k in cs){
    		// _$content.append($("<div>"+  k + " : " + cs[k].editorDir +"</div>"))

    		var id = "cl.Component."+k;
    		cmds.push(id);

    		(function(k){
    			CommandManager.register(k, id, function(){
					if(!currentObjects) {
                        return;
                    }

					for(var i in currentObjects){
						currentObjects[i].addComponent(k);
					}
	    		});
    		})(k);
    	}
    }

    function registerMenus() {
    	objectMenu = Menus.addMenu("GameObject", "cl.GameObject");
    	objectMenu.addMenuItem("cl.GameObject.CreateEmpty");

		componentMenu = Menus.addMenu("Component", "cl.Component");

		for(var i in cmds){
			componentMenu.addMenuItem(cmds[i]);
		}
    }

    EventManager.on(EventManager.PROJECT_OPEN, function() {
	    registerCommand();
	    registerMenus();
    });

    EventManager.on(EventManager.SELECT_OBJECTS, function(event, objs) {
    	currentObjects = objs;
	});

});