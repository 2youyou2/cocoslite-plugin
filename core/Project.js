define(function (require, exports, module) {
    "use strict";

    var ProjectManager     = brackets.getModule("project/ProjectManager"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        bracketsCommands   = brackets.getModule("command/Commands"),
        bracketsStrings    = brackets.getModule("strings"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    var CreateProjectTemp  = require("text!html/CreateProject.html"),
        ComponentManager   = require("core/ComponentManager"),
        NewSceneContent    = require("text!template/template.scene"),
        Commands           = require("core/Commands"),
        Strings            = require("strings"),
        EventManager       = require("core/EventManager");

    var isCocosProject;
    var resFolder, srcFolder;
    var projectClosePromise;

    function loadFolder(item, container, useFile, filter) {
        var deferred = new $.Deferred();

        if(filter(item)) {
            var file = useFile ? item : item.fullPath;
            container.push(file);
        }

        if(item.isDirectory) {
            item.getContents(function(err, subItems) {

                if(subItems.length === 0) {
                    deferred.resolve();
                } else {
                    var i = 0;
                    subItems.forEach(function(subItem) {
                        loadFolder(subItem, container, useFile, filter).then(function(){ 
                            if(++i === subItems.length) {
                                deferred.resolve();
                            }
                        });
                    });
                }
                    
            });
        }
        else{
            deferred.resolve();
        }

        return deferred.promise();
    }

    function loadSources(folder, unload) {
        var deferred = new $.Deferred();
        var sources  = [];

        folder = folder ? folder : srcFolder;

        loadFolder(folder, sources, false,
            function(item) {
                return item.name.endWith(".js");
            }
        ).then(function() {
            try{
                if(unload) {
                    
                    sources.forEach(function(item) {
                        var component = require(item);
                        if(component && component.Constructor) {
                            ComponentManager.unregisterComponent(component);
                        }

                        require.undef(item);
                    });
                    deferred.resolve(sources);

                } else {
                    require(sources, function() {
                        deferred.resolve(sources);
                    });
                }
                
            }
            catch(e) {
                console.err("load source failed : ", e);
            }
        });

        return deferred.promise();
    }


    function unloadSources(folder) {
        return loadSources(folder, true);
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
    }

    function handleProjectOpen(e, root) {

        function load() {
            loadSources().then(function(){
                EventManager.trigger(EventManager.PROJECT_OPEN);
            });
        }

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


                if(projectClosePromise) {
                    projectClosePromise.then(load);
                    projectClosePromise = null;
                } else {
                    load();
                }
                
            }

        });
    };

    function handleProjectClose() {
        EventManager.trigger(EventManager.PROJECT_CLOSE);
    }

    function handleBeforeProjectClose() {
        projectClosePromise = unloadSources();
    }

    function handleNewProject() {
        var dialog, $projectName, $projectLocation, $browseBtn;

        var errorMessage = "";

        var templateVars = {
            errorMessage : errorMessage,
            Strings      : bracketsStrings
        };

        dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(CreateProjectTemp, templateVars));

        $projectName = dialog.getElement().find(".name");
        $projectName.val("CocosLiteProject");
        $projectName.focus();
        $projectLocation = dialog.getElement().find(".location");
        $projectLocation.val(PreferencesManager.getViewState("cocoslite.project.location"));
        $browseBtn = dialog.getElement().find(".browse");

        dialog.done(function (id) {
            if (id === Dialogs.DIALOG_BTN_OK) {

                var projectName = $projectName.val();
                var dest = $projectLocation.val();

                var cmd = "cocos new " + projectName + " -l js -t runtime -d " + dest;

                cl.cocosDomain.exec("runCommand", cmd, "").then(function() {

                    var zip = cc.path.join(cl.clDir, "template/node_modules.zip");
                    var unzipDir = cc.path.join(dest, projectName);

                    return cl.cocosDomain.exec("unzip", zip, unzipDir);

                }).done(function(){
                        ProjectManager.openProject($projectLocation.val() + "/" + $projectName.val());
                    })
                    .fail(function (err) {
                        console.error("failed to create cocos project.", err);
                    });

                PreferencesManager.setViewState("cocoslite.project.location", $projectLocation.val());
            }
        });


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


    CommandManager.register(Strings.NEW_PROJECT,      Commands.CMD_NEW_PROJECT,          handleNewProject);
    CommandManager.register(Strings.NEW_SCENE,        Commands.CMD_NEW_SCENE,            handleNewScene);
    CommandManager.register(Strings.NEW_SCENE,        Commands.CMD_NEW_SCENE_UNTITLED,   handleNewSceneUntitled);
    CommandManager.register(Strings.PROJECT_SETTINGS, Commands.CMD_PROJECT_SETTINGS,     handleProjectSettings);

    ProjectManager.on("beforeProjectClose",  handleBeforeProjectClose);
    ProjectManager.on("projectClose",        handleProjectClose);
    ProjectManager.on("projectOpen",         handleProjectOpen);

    exports.getResources = getResources;

    exports.getResourceFolder = function() {
        return resFolder;
    }

    exports.getSourceFolder = function() {
        return srcFolder;
    }
});
