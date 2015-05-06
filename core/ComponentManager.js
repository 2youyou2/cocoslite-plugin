/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var CommandManager          = brackets.getModule("command/CommandManager"),
        bracketsCommands        = brackets.getModule("command/Commands"),
        FileSystem              = brackets.getModule("filesystem/FileSystem"),
        Menus                   = brackets.getModule("command/Menus");

    var Strings                 = require("strings"),
        Commands                = require("core/Commands"),
        Selector                = require("core/Selector"),
        Undo                    = require("core/Undo"),
        Project                 = require("core/Project"),
        EventManager            = require("core/EventManager"),
        ObjectManager           = require("core/ObjectManager"),
        ScriptTemplate          = require("text!template/NewScript.js");



    function createIDForComponent(className) {
        return Commands.CMD_COMPONENT + '.' + className;
    }

    function scriptLoaded(className, addToObjects) {
        var id = createIDForComponent(className);

        registerCommand(className, id);

        EventManager.trigger(EventManager.NEW_EMPTY_COMPONENT, className);

        if(addToObjects) {
            addComponentToObjects(className);
        }
    }


    function createEmptyComponent(className, path, addToObjects) {
        var script = ScriptTemplate.replace(/NewScript/g, className);

        if(!path) {
            var folder = Project.getSourceFolder();
            path = folder.fullPath;
        }

        try {
            var file = FileSystem.getFileForPath(cc.path.join(path, className + '.js'));
            file.write(script, undefined, function() {
                require([file.fullPath], function() {
                    scriptLoaded(className, addToObjects);
                });
            });

            
        }
        catch(err) {
            console.log("ComponentManager.createEmptyComponent failed : ", err);
        }

    }

    function createEmptyComponentInProject() {

        CommandManager.execute(bracketsCommands.FILE_NEW, 'Untitiled', '.js', function(file) {
            var className = file.name;
            className = className.slice(0, className.lastIndexOf('.'));
            var script = ScriptTemplate.replace(/NewScript/g, className);

            file.write(script, undefined, function() {
                require([file.fullPath], function() {
                    scriptLoaded(className);
                });
            });
        });
    }

    function addComponentToObjects(className) {
        Undo.beginUndoBatch();

        var currentObjects = Selector.getSelectObjects();

        for(var i in currentObjects){
            currentObjects[i].addComponent(className);
        }

        Undo.endUndoBatch();
    }

    function registerCommand(className, id) {
        if(CommandManager.get(id)) {
            return;
        }
        
        CommandManager.register(className, id, function(){
           addComponentToObjects(className); 
        });
    }

    function registerCommands() {

        var cs = cl.ComponentManager.getAllClasses();
        var cmds = [];

        for(var k in cs){
            var c = cs[k];
            if(c._show_ && !c._show_()) {
                continue;
            }

            var id = createIDForComponent(k);
            cmds.push(id);

            registerCommand(k, id);
        }

        return cmds;
    }

    function registerMenus(cmds) {
        var menu = Menus.addMenu(Strings.COMPONENT, Commands.CMD_COMPONENT);
        // menu.addGameEditorMenuItem(Commands.CMD_NEW_EMPTY_COMPONENT);

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

    function handleProjectOpen() {
        var cmds = registerCommands();
        registerMenus(cmds);
        updateComponentMenus();
    }

    function handleProjectClose() {
        var menu = Menus.getMenu(Commands.CMD_COMPONENT);
        if(menu) {
            Menus.removeMenu(Commands.CMD_COMPONENT);
        }
    }

    function unregisterComponent(component) {
        cl.ComponentManager.unregister(component.Constructor.className);
    }

    function handleSelectObjects() {
        updateComponentMenus();
    }

    EventManager.on(EventManager.PROJECT_OPEN,   handleProjectOpen);
    EventManager.on(EventManager.PROJECT_CLOSE,  handleProjectClose);
    EventManager.on(EventManager.SELECT_OBJECTS, handleSelectObjects);

    CommandManager.register(Strings.NEW_EMPTY,        Commands.CMD_NEW_EMPTY_COMPONENT,        createEmptyComponent);
    CommandManager.register(Strings.NEW_EMPTY_SCRIPT, Commands.CMD_NEW_COMPONENT_IN_PROJECT,   createEmptyComponentInProject);

    exports.unregisterComponent = unregisterComponent;
});
