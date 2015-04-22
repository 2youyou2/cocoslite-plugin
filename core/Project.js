define(function (require, exports, module) {
    "use strict";

    var ProjectManager     = brackets.getModule("project/ProjectManager"),
        Menus              = brackets.getModule("command/Menus"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        bracketsCommands   = brackets.getModule("command/Commands"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Strings            = brackets.getModule("strings"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        AsyncUtils         = brackets.getModule("utils/Async"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    var CreateProjectTemp  = require("text!html/CreateProject.html"),
        NewSceneContent    = require("text!template/template.scene"),
        MenusManager       = require("core/MenusManager"),
        Commands           = require("core/Commands"),
        Strings            = require("strings"),
        EventManager       = require("core/EventManager");

    var isCocosProject;
    var resFolder, srcFolder;
    var sources;

    function loadFolder(item, container, useFile, filter, cb) {
    	if(filter(item)) {
            var file = useFile ? item : item.fullPath;
            container.push(file);
        }

    	if(item.isDirectory) {
	    	item.getContents(function(err, subItems) {
	    		var i = 0;
	    		subItems.forEach(function(subItem) {
	    			loadFolder(subItem, container, useFile, filter, function() {
	    				if(++i === subItems.length) {
                            cb();
                        }
	    			});
	    		});
	    	});
    	}
    	else{
    		cb();
    	}
    }

    function loadSources() {
        var deferred = new $.Deferred();

    	loadFolder(srcFolder, sources, false,
            function(item) {
                return item.name.endWith(".js");
            }, 
            function() {
                try{
                    require(sources, function() {
                        deferred.resolve();
                    });
                }
                catch(e) {
                    console.err("load source failed : ", e);
                }
            }
        );

        return deferred.promise();
    }

    function getResources(filter) {
        var deferred = new $.Deferred();
        var resources = [];

        loadFolder(resFolder, resources, true, filter, function() {
            deferred.resolve(resources);
        });

        return deferred.promise();
    }

	function reset() {
    	isCocosProject = false;
    	resFolder = srcFolder = null;
    	sources = [];
	}

    ProjectManager.on("projectOpen", function(e, root) {

    	reset();

    	root.getContents(function(err, items) {
    		items.forEach(function(item) {
    			if(item.name === ".cocos-project.json") {
                    isCocosProject = true;
                }
	    		else if(item.name === "res") {
                    resFolder = item;
                }
	    		else if(item.name === "src") {
	    			srcFolder = item;
                }
    		});

	    	if(!isCocosProject) {
	    		reset();
	    		console.err(root.fullPath + " is not a cocos project path.");
	    	} else {
                loadSources().then(function(){
                    EventManager.trigger(EventManager.PROJECT_OPEN);
                });
            }

    	});
    });

    function handleNewProject() {
        var dialog, $projectName, $projectLocation, $browseBtn;

        var errorMessage = "";

        var templateVars = {
            errorMessage : errorMessage,
            Strings      : Strings
        };

        dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(CreateProjectTemp, templateVars));

        dialog.done(function (id) {
            if (id === Dialogs.DIALOG_BTN_OK) {
                cl.cocosDomain.exec("newProject", $projectName.val(), $projectLocation.val())
                    .done(function(){
                        ProjectManager.openProject($projectLocation.val() + "/" + $projectName.val());
                    })
                    .fail(function (err) {
                        console.error("failed to create cocos project.", err);
                    });

                PreferencesManager.setViewState("cocoslite.project.location", $projectLocation.val());
            }
        });

        $projectName = dialog.getElement().find(".name");
        $projectName.value("CocosLiteProject");
        $projectName.focus();
        $projectLocation = dialog.getElement().find(".location");
        $projectLocation.val(PreferencesManager.getViewState("cocoslite.project.location"));
        $browseBtn = dialog.getElement().find(".browse");

        $browseBtn.click(function(){
            FileSystem.showOpenDialog(false, true, Strings.CHOOSE_FOLDER, $projectLocation.val(), null, function (err, files) {
                if (!err) {
                    // If length == 0, user canceled the dialog; length should never be > 1
                    if (files.length > 0) {
                        // Load the new project into the folder tree
                        $projectLocation.val(files[0]);
                    }
                } 
                else {
                    console.log(err);
                }
            });
        });
    }

    function handleNewSceneUntitled() {
        CommandManager.execute(bracketsCommands.FILE_NEW_UNTITLED, 'Untitiled', '.scene', NewSceneContent);
    }

    function handleNewScene() {
        CommandManager.execute(bracketsCommands.FILE_NEW, 'Untitiled', '.scene', function(file) {
            file.write(NewSceneContent);
        });
    }

    function handleProjectSettings() {

    }

    
    function registerMenu() {
        var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        menu.addGameEditorMenuItem(Commands.CMD_NEW_PROJECT, "", Menus.FIRST);
        menu.addGameEditorMenuItem(Commands.CMD_NEW_SCENE_UNTITLED,   "", Menus.AFTER, Commands.CMD_NEW_PROJECT);
        menu.addGameEditorMenuDivider(Menus.AFTER, Commands.CMD_NEW_SCENE);

        menu.addGameEditorMenuDivider(Menus.LAST);
        menu.addGameEditorMenuItem(Commands.CMD_PROJECT_SETTINGS, "", Menus.LAST);

        menu = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU);
        menu.addMenuItem(Commands.CMD_NEW_SCENE, "", Menus.FIRST);
    }


    CommandManager.register(Strings.NEW_PROJECT, Commands.CMD_NEW_PROJECT, handleNewProject);
    CommandManager.register(Strings.NEW_SCENE,   Commands.CMD_NEW_SCENE,   handleNewScene);
    CommandManager.register(Strings.NEW_SCENE,   Commands.CMD_NEW_SCENE_UNTITLED,   handleNewSceneUntitled);
    CommandManager.register(Strings.PROJECT_SETTINGS, Commands.CMD_PROJECT_SETTINGS, handleProjectSettings);

    registerMenu();

    exports.getSources = function() {
        return sources;
    }
    exports.getResources = getResources;

    exports.getResourceFolder = function() {
        return resFolder;
    }

    exports.getSourceFolder = function() {
        return srcFolder;
    }
});
