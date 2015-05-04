define(function (require, exports, module) {
    "use strict";

    var ProjectManager     = brackets.getModule("project/ProjectManager"),
        CommandManager     = brackets.getModule("command/CommandManager"),
        bracketsCommands   = brackets.getModule("command/Commands"),
        bracketsStrings    = brackets.getModule("strings"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        FileUtils          = brackets.getModule("file/FileUtils"),
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

        loadFolder(resFolder, resources, true, filter).then(function() {
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

                // hack cocos loader path
                // this will make cocos load res from current project path
                cc.loader.resPath = root.fullPath;

                cl.readConfig();

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

    function setValueToProjectJson(projectDir, key, value) {
        var deferred = new $.Deferred();

        var path = cc.path.join(projectDir, 'project.json');
        var file = FileSystem.getFileForPath(path);

        FileUtils.readAsText(file).done(function(data) {
            var json = JSON.parse(data);
            json[key] = value;

            FileUtils.writeText(file, JSON.stringify(json, null, '\t'), true).done(function() {
                deferred.resolve();
            });
        })

        return deferred.promise();
    }

    function handleNewProject() {
        var dialog, 
            $projectName, 
            $projectLocation, 
            $browseBtn, 
            $onlyCocos;

        var errorMessage = "";

        var templateVars = {
            errorMessage : errorMessage,
            Strings      : bracketsStrings
        };

        dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(CreateProjectTemp, templateVars));

        var $el = dialog.getElement();

        $projectName = $el.find(".name");
        $projectName.val("CocosLiteProject");
        $projectName.focus();
        $projectLocation = $el.find(".location").val(PreferencesManager.getViewState("cocoslite.project.location"));
        $browseBtn = $el.find(".browse");
        
        var checked = PreferencesManager.getViewState("cocoslite.project.onlyCocosLite");
        checked = checked === undefined ? true : checked;
        $onlyCocos = $el.find(".cocoslite").attr('checked', checked);
        
        var physics = PreferencesManager.getViewState("cocoslite.project.physics");
        physics = physics === undefined ? 'None' : physics;
        $el.find("#"+physics).attr('checked', true);

        dialog.done(function (id) {
            if (id === Dialogs.DIALOG_BTN_OK) {

                var projectName = $projectName.val();
                var dest        = $projectLocation.val();
                var onlyCocos   = $onlyCocos[0].checked;
                physics         = $el.find("input[name='physics']:checked").attr('id');

                var promise = null;
                var projectDir = cc.path.join(dest, projectName);

                if(onlyCocos) {
                    var templateDir  = cc.path.join(cl.templatesDir, "js-template-cocoslite");
                    var projectClDir = cc.path.join(projectDir,      "frameworks/cocos2d-html5/cocoslite");

                    promise  = cl.cocosDomain.exec("copyDir", templateDir, projectDir).then(function() {
                        return cl.cocosDomain.exec("copyDir", cl.clEngineDir, projectClDir);
                    });

                } else {

                    var cmd = "cocos new " + projectName + " -l js -t runtime -d " + dest;
                    promise = cl.cocosDomain.exec("runCommand", cmd, "");

                }

                promise.then(function() {

                    var zip = cc.path.join(cl.clDir, "template/node_modules.zip");
                    return cl.cocosDomain.exec("unzip", zip, projectDir);

                })
                .then(function(){
                    return setValueToProjectJson(projectDir, 'physics', physics);
                })
                .done(function(){
                    ProjectManager.openProject($projectLocation.val() + "/" + $projectName.val());
                })
                .fail(function (err) {
                    console.error("failed to create cocos project.", err);
                });

                PreferencesManager.setViewState("cocoslite.project.location",      dest);
                PreferencesManager.setViewState("cocoslite.project.onlyCocosLite", onlyCocos);
                PreferencesManager.setViewState("cocoslite.project.physics",       physics);
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
