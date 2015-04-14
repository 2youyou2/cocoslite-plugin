define(function (require, exports, module) {
    "use strict";

    var ProjectManager     = brackets.getModule("project/ProjectManager"),
        Menus              = brackets.getModule("command/Menus"),
        Commands           = brackets.getModule("command/Commands"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Strings            = brackets.getModule("strings"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        AsyncUtils         = brackets.getModule("utils/Async"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
    	EventDispatcher    = brackets.getModule("utils/EventDispatcher");

    var CreateProjectTemp  = require("text!html/CreateProject.html");

    var isCocosProject;
    var resFolder, srcFolder;
    var sources;

    EventDispatcher.makeEventDispatcher(exports);

    function readSource(item, cb) {
    	if(item.name.endWith(".js")) {
            sources.push(item.fullPath);
        }

    	if(item.isDirectory) {
	    	item.getContents(function(err, subItems) {
	    		var i = 0;
	    		subItems.forEach(function(subItem) {
	    			readSource(subItem, function() {
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

    function readSources() {
        var deferred = new $.Deferred();

    	readSource(srcFolder, function() {
	    	require(sources, function() {
                deferred.resolve();
	    	});
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
                readSources().then(function(){
                    exports.trigger("projectOpen");
                });
            }
    	});
    });


    function handleCreateProject() {
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

    
    function registerMenu() {
        var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(Commands.CMD_CREATE_COCOS_PROJECT);
    }


    CommandManager.register("Create Project", Commands.CMD_CREATE_COCOS_PROJECT, handleCreateProject);

    registerMenu();

    exports.getSources = function() {
        return sources;
    }
});
