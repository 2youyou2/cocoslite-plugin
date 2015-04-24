/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager"),
        FileSystem     = brackets.getModule("filesystem/FileSystem"),
        Menus          = brackets.getModule("command/Menus");

    var Strings        = require("strings"),
        Commands       = require("core/Commands"),
        Selector       = require("core/Selector"),
    	Undo           = require("core/Undo"),
        Project        = require("core/Project"),
        EventManager   = require("core/EventManager"),
        ObjectManager  = require("core/ObjectManager"),
        ScriptTemplate = require("text!template/NewScript.js");


    function createEmptyObject() {
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

    function createEmptyComponent(name) {
        var script = ScriptTemplate.replace(/NewScript/g, name);

        name += '.js';

        var folder = Project.getSourceFolder();
        var file = FileSystem.getFileForPath(cc.path.join(folder.fullPath, name));
        file.write(script);
    }

    function registerCommand() {
    	CommandManager.register(Strings.CREATE_EMPTY, Commands.CMD_CREATE_EMPTY_GAME_OBJECT, createEmptyObject);
        CommandManager.register(Strings.CREATE_EMPTY, Commands.CMD_CREATE_EMPTY_COMPONENT,   createEmptyComponent);

        var cs = cl.ComponentManager.getAllClasses();
        var cmds = [];

    	for(var k in cs){

    		var id = Commands.CMD_COMPONENT + '.' + k;
    		cmds.push(id);

    		(function(k){
    			CommandManager.register(k, id, function(){
                    Undo.beginUndoBatch();

                    var currentObjects = Selector.getSelectObjects();

					for(var i in currentObjects){
						currentObjects[i].addComponent(k);
					}

                    Undo.endUndoBatch();
	    		});
    		})(k);
    	}

        return cmds;
    }

    function registerMenus(cmds) {

    	var menu = Menus.addMenu(Strings.GAME_OBJECT, Commands.CMD_GAME_OBJECT);
    	menu.addGameEditorMenuItem(Commands.CMD_CREATE_EMPTY_GAME_OBJECT);

        // menu = Menus.addMenu(Strings.COMPONENT, Commands.CMD_COMPONENT);
        // menu.addGameEditorMenuItem(Commands.CMD_CREATE_EMPTY_COMPONENT);

		for(var i in cmds){
			menu.addGameEditorMenuItem(cmds[i]);
		}
    }

    function updateComponentMenus() {
        var menu = Menus.getMenu(Commands.CMD_COMPONENT);
        var currentObjects = Selector.getSelectObjects();

        var items = menu.menuItems;
        for(var key in items) {
            var item = items[key];

            var enable = currentObjects && currentObjects.length > 0;
            item.getCommand().setEnabled(enable);
        }
    }

    EventManager.on(EventManager.PROJECT_OPEN, function() {
	    var cmds = registerCommand();
	    registerMenus(cmds);
        updateComponentMenus();
    });

    EventManager.on(EventManager.SELECT_OBJECTS, function(event, objs) {
        updateComponentMenus();
	});

});