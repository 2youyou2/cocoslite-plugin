/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define*/

define(function (require, exports, module) {
    "use strict";

    var Menus                = brackets.getModule("command/Menus"),
        bracketsCommands     = brackets.getModule("command/Commands"),
        AppInit              = brackets.getModule("utils/AppInit");

    var EditorType           = brackets.EditorType;

    var EventManager         = require("core/EventManager"),
        Commands             = require("core/Commands"),
        Strings              = require("strings");

    var _gameEditorMenus = {};
    var _persistentMenus = {};

    var _currentFocusWindow = EditorType.GameEditor;

    function registerEditorMenus(type, menuIDs, commands) {
        var menus = [];

        function pushCommands(menuID, commands) {
            if(!Array.isArray(commands)) {
                commands = [commands]
            } 

            commands.forEach(function(command) {
                menus.push({menuID:menuID, command:command});
            });
        }

        if(Array.isArray(menuIDs)) {
            menuIDs.forEach(function (pairs) {
                pushCommands(pairs[0], pairs[1]);
            })
        }
        else if(Array.isArray(commands)) {
            pushCommands(menuIDs, commands);
        }
        else {
            menus.push({menuID:menuIDs, command:commands});
        } 


        for(var i in menus) {
            var menuID  = menus[i].menuID;
            var command = menus[i].command;

            var menu = getMenu(type, menuID);

            if(command && menu.indexOf(command) === -1) {
                menu.push(command);
            }
        }
    }

    function getMenus(type) {
        var menus = {};

        if(type === EditorType.GameEditor) {
            menus = _gameEditorMenus;
        } else if(type === EditorType.All) {
            menus = _persistentMenus;
        }

        return menus;
    }

    function getMenu(type, id) {
        var menus = getMenus(type);

        if(!menus[id]) {
            if(type === EditorType.All || type === brackets.editorType) {
                menus[id] = [];
            } 

            if(brackets.platform ==='mac') {
                setMenuHidden(id, type !== _currentFocusWindow);
            }
        }
        return menus[id];
    }

    function setMenuHidden(id, hidden) {

        brackets.app.setMenuHidden(id, hidden, function (err) {
            if (err) {
                console.error("setMenuHidden() -- id not found: " + id + " (error: " + err + ")");
            }
        }); 
    }

    function setAllMenuHidden(hidden) {

        // hide all menu
        var menuMap = Menus.getAllMenus();
        for(var id in menuMap) {

            var menu = menuMap[id];
            var menuItems = menu.menuItems;

            for(var menuItemID in menuItems) {
                var item = menuItems[menuItemID];
                var commandId;

                if(item.isDivider) {
                    commandId = item.dividerId;
                }
                else {
                    var command = item.getCommand();
                    if(!command) { 
                        continue; 
                    }
                    commandId = command.getID();
                }

                setMenuHidden(commandId, hidden);
            }

            setMenuHidden(id, hidden);
        }
    }

    function setGameEditorMenusHidden(hidden) {
        setEditorMenusHidden(EditorType.GameEditor, hidden);
    }

    function setPersistentEditorMenusHidden(hidden) {
        setEditorMenusHidden(EditorType.All, hidden);
    }

    function setEditorMenusHidden(type, hidden) {
        var menus = getMenus(type);

        for(var menuID in menus) {

            var menuMap = Menus.getAllMenus();
            var menu = menuMap[menuID];

            var realMenuItemIDs = menu.menuItems;
            var menuItemIDs = menus[menuID];

            menuItemIDs.forEach(function(item) {
                setMenuHidden(item, hidden);
            });

            if(Object.keys(realMenuItemIDs).length === Object.keys(menuItemIDs).length || hidden === false) {
                setMenuHidden(menuID, hidden);
            }
        }
    }

    function handleIDEFocus() {
        _currentFocusWindow = EditorType.IDE;

        setAllMenuHidden(false);
        setGameEditorMenusHidden(true);
        setPersistentEditorMenusHidden(false);
    }

    function handleGameEditorFocus() {
        _currentFocusWindow = EditorType.GameEditor;

        setAllMenuHidden(true);
        setGameEditorMenusHidden(false);
        setPersistentEditorMenusHidden(false);
    }

    function hackMenus() {

        var originGetMenu = Menus.getMenu;
        Menus.getMenu = function(id) {
            var menu = originGetMenu(id);
            if(!menu) {
                menu = new Menus.Menu();
            }
            return menu;
        }

        var originRemoveMenu = Menus.removeMenu;
        Menus.removeMenu = function(id) {
            originRemoveMenu.apply(this, arguments);

            delete _gameEditorMenus[id];
        };


        Menus.Menu.prototype.addGameEditorMenuDivider = function (position, relativeID) {
            return this.addGameEditorMenuItem(Menus.DIVIDER, "", position, relativeID);
        };

        var originAddMenuItem = Menus.Menu.prototype.addMenuItem;
        Menus.Menu.prototype.addMenuItem = function(command, keyBindings, position, relativeID) {
            var item = null;

            if(this.constructor === Menus.Menu && _currentFocusWindow === EditorType.GameEditor) {
                if(brackets.platform === 'mac') {
                    item = originAddMenuItem.apply(this, arguments);
                    if(item.isDivider) {
                        command = item.dividerId;
                    }
                    else if(typeof command === 'object') {
                        command = command.getID();
                    }
                    setMenuHidden(command, true);
                }
            } else {
                item = originAddMenuItem.apply(this, arguments);
            }

            return item;
        };

        Menus.Menu.prototype.addGameEditorMenuItem = function(command, keyBindings, position, relativeID) {
            var item = null;

            if(brackets.editorType === EditorType.GameEditor) {
                item = originAddMenuItem.apply(this, arguments);

                var menu = getMenu(EditorType.GameEditor, this.id);
                if(item.isDivider) {
                    command = item.dividerId;
                }
                menu.push(command);

                if(brackets.platform === 'mac') {
                    setMenuHidden(command, _currentFocusWindow !== EditorType.GameEditor);
                }
            }

            return item;
        };

        var originRemoveMenuItem = Menus.Menu.prototype.removeMenuItem;
        Menus.Menu.prototype.removeMenuItem = function(command) {
            originRemoveMenuItem.apply(this, arguments);

            if(this.constructor === Menus.ContextMenu) {
                return;
            }
            
            for(var type in EditorType) {
                var menu = getMenu(type, this.id);
                if(menu) {
                    var index = menu.indexOf(command);
                    if(index !== -1) {
                        menu.slice(index, 1);
                    }
                }
            }
        };
    }

    function isMenusContains(menuId, command) {
        var menu = _gameEditorMenus[menuId];
        if(menu && menu.indexOf(command) !== -1) {
            return true;
        }

        menu = _persistentMenus[menuId];
        if(menu && menu.indexOf(command) !== -1) {
            return true;
        }

        return false;
    }

    function removeUnnecessaryMenus() {
        // hide all menu
        var menuMap = Menus.getAllMenus();
        for(var id in menuMap) {

            var menu = menuMap[id];
            var menuItems = menu.menuItems;

            for(var menuItemID in menuItems) {
                var item = menuItems[menuItemID];
                var commandId;

                if(item.isDivider) {
                    commandId = item.id;
                }
                else {
                    var command = item.getCommand();
                    if(!command) { 
                        continue; 
                    }
                    commandId = command.getID();
                }

                if(!isMenusContains(id, commandId)) {
                    if(item.isDivider) {
                        menu.removeMenuDivider(commandId);
                    } else {
                        menu.removeMenuItem(commandId);
                    }
                }
            }

            if(Object.keys(menuItems).length === 0) {
                Menus.removeMenu(id);
            }
        }
    }

    function initMenus() {
        var menus = [
            [Menus.AppMenuBar.FILE_MENU, [
                bracketsCommands.FILE_OPEN,
                bracketsCommands.FILE_CLOSE,
                bracketsCommands.FILE_CLOSE_ALL,
                bracketsCommands.FILE_SAVE,
                bracketsCommands.FILE_SAVE_ALL,
                bracketsCommands.FILE_SAVE_AS
            ]],
            [Menus.AppMenuBar.EDIT_MENU, [
                bracketsCommands.EDIT_UNDO,
                bracketsCommands.EDIT_REDO,
                bracketsCommands.EDIT_CUT,
                bracketsCommands.EDIT_COPY,
                bracketsCommands.EDIT_PASTE,
                bracketsCommands.EDIT_SELECT_ALL
            ]],
            [Menus.AppMenuBar.VIEW_MENU, [
                bracketsCommands.CMD_THEMES_OPEN_SETTINGS,
                bracketsCommands.VIEW_HIDE_SIDEBAR
            ]],
            ["debug-menu", [
                "debug.switchLanguage",
                "debug.showDeveloperTools"
            ]]
        ];

        registerEditorMenus(EditorType.All, menus);

        // file menu
        var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        menu.addGameEditorMenuDivider(Menus.AFTER, bracketsCommands.FILE_CLOSE_ALL);

        menu.addGameEditorMenuItem(Commands.CMD_NEW_PROJECT, "", Menus.FIRST);
        menu.addGameEditorMenuItem(Commands.CMD_NEW_SCENE_UNTITLED,   "", Menus.AFTER, Commands.CMD_NEW_PROJECT);
        menu.addGameEditorMenuDivider(Menus.AFTER, Commands.CMD_NEW_SCENE_UNTITLED);
        menu.addGameEditorMenuDivider(Menus.LAST);
        menu.addGameEditorMenuItem(Commands.CMD_PROJECT_SETTINGS, "", Menus.LAST);

        // edit menu
        menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
        menu.addGameEditorMenuDivider(Menus.AFTER, bracketsCommands.EDIT_REDO);
        menu.addGameEditorMenuDivider(Menus.AFTER, bracketsCommands.EDIT_PASTE);

        // view menu
        menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addGameEditorMenuDivider(Menus.BEFORE, bracketsCommands.VIEW_HIDE_SIDEBAR);
        
        menu.addGameEditorMenuItem(Commands.CMD_OPEN_IDE);
        menu.addGameEditorMenuDivider(Menus.BEFORE, Commands.CMD_OPEN_IDE);

        // GameObject menu
        var menu = Menus.addMenu(Strings.GAME_OBJECT, Commands.CMD_GAME_OBJECT);
        menu.addGameEditorMenuItem(Commands.CMD_NEW_EMPTY_GAME_OBJECT);
        menu.addGameEditorMenuItem(Commands.CMD_NEW_EMPTY_CHILD_GAME_OBJECT);

        // project context menu
        menu = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU);
        menu.removeMenuItem(bracketsCommands.FILE_NEW);
        menu.addMenuItem(Commands.CMD_NEW_SCENE, "", Menus.AFTER, bracketsCommands.FILE_NEW_FOLDER);
        menu.addMenuItem(Commands.CMD_NEW_COMPONENT_IN_PROJECT, "", Menus.AFTER, Commands.CMD_NEW_SCENE);
        menu.addMenuDivider(Menus.AFTER, Commands.CMD_NEW_COMPONENT_IN_PROJECT);
    }

    function init() {
        
        // hack Menu functions
        hackMenus();

        // init menus
        initMenus();

        // mac apps only have one menu bar, so mac platform need change menu's hidden when focus changes.
        // other platforms only need remove unnecessary menus when init app.
        if(brackets.platform === 'mac') {

            // refresh menus
            handleGameEditorFocus();

            window.addEventListener('focus', handleGameEditorFocus);
            EventManager.on(EventManager.IDE_FOCUS,    handleIDEFocus);
        } else {
            removeUnnecessaryMenus();
        }
    }

    AppInit.appReady(init);

});
