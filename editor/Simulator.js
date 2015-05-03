/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var AppInit                 = brackets.getModule("utils/AppInit"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        FileSystem              = brackets.getModule("filesystem/FileSystem"),
        PreferencesManager      = brackets.getModule("preferences/PreferencesManager");

    var EventManager            = require("core/EventManager"),
        Strings                 = require("strings"),
        Commands                = require("core/Commands"),
        SimulatorHtml           = require("text!html/SimulatorConfiguration.html"),
        Vue                     = require("thirdparty/Vue");

    /**
     * Simulator configuration.
     * @type {object}
     */
    var _configuration = {
        configs: {
            mac: {
                title: "Mac OSX",
                path:  "runtime/mac/PrebuiltRuntimeJs.app",
            },
            win: {
                title: "win32",
                path:  "runtime/win32/PrebuiltRuntimeJs.exe",
            },
            web: {
                title: "Web"
            },
            // {
            //     name:  "ios",
            //     title: "ios Simulator",
            //     path:  "runtime/ios/PrebuiltRuntimeJs.app",
            // },
            // {
            //     name:  "android",
            //     title: "Android",
            //     path:  "runtime/android/PrebuiltRuntimeJs.apk",
            // },
            // {
            //     name:  "remote",
            //     title: "Remote Debugging",
            //     ip: "127.0.0.1",
            // }
        },
        current: brackets.platform
    };


    var _$dialog;

    function initConfigurationFromPreferences() {
        var state = PreferencesManager.getViewState("cocoslite.simulator.configuration");
        _configuration.current = state.current;
        
        for(var k in _configuration.configs) {
            _configuration.configs[k] = state.configs[k];
        }
    }

    function configure() {
        var dialog = Dialogs.showModalDialogUsingTemplate(_$dialog);

        dialog.done(function (id) {
            if (id === Dialogs.DIALOG_BTN_OK) {
                PreferencesManager.setViewState("cocoslite.simulator.configuration", _configuration);
            } else if (id === Dialogs.DIALOG_BTN_CANCEL){
                initConfigurationFromPreferences();
            }
        });
    }

    function runSimulator() {
        var current = _configuration.configs[_configuration.current];
        var name = _configuration.current;
        var projectDir = ProjectManager.getProjectRoot().fullPath;

        var cmd = "";
        var options = {
            cwd: projectDir
        }

        if(name === 'mac') {
            options.connectConsole = true;

            var path = cc.path.join(current.path, "Contents/MacOS");

            if(!FileSystem.isAbsolutePath(path)) {
                path = cc.path.join(projectDir, path);
            }
            var dir = FileSystem.getDirectoryForPath(path);
            dir.getContents(function(err, files) {
                cmd = files[0].fullPath;
                if(cmd) {
                    cl.cocosDomain.exec("simulate", cmd, JSON.stringify(options));
                }
            });
            
        } else {
            if(name === 'web') {
                cmd = "cocos run -p web";
            } else {
                var path = current.path;

                if(!FileSystem.isAbsolutePath(path)) {
                    path = cc.path.join(projectDir, path);
                }

                cmd =  path;
                options.connectConsole = true;
            } 

            cl.cocosDomain.exec("simulate", cmd, JSON.stringify(options));
        }
    }

    AppInit.appReady(function() {

        // read configuration from preferences cache
        var state = PreferencesManager.getViewState("cocoslite.simulator.configuration");
        if(state) {
            initConfigurationFromPreferences();
        } else {
            PreferencesManager.setViewState("cocoslite.simulator.configuration", _configuration);
        }


        var $simulator = $('<span class="simulator"></span>');
        var $content   = $('<span class="simulator-content">Simulator</span>').appendTo($simulator);
        var $configure = $('<span class="simulator-configure fa-cog"></span>').appendTo($simulator);

        $("#play-bar").append($simulator);

        $content.click(runSimulator);
        $configure.click(configure);


        _$dialog = $(SimulatorHtml);

        var configs = _configuration.configs;
        for(var k in configs) {
            configs[k].checked = false;
        }
        configs[_configuration.current].checked = true;

        new Vue({
            el: _$dialog[0],
            data: _configuration,
            methods: {
                onClickTitle: function(key) {
                    configs[_configuration.current].checked = false;
                    _configuration.current = key;
                    configs[_configuration.current].checked = true;
                },

                onClickBrowse: function(item) {
                    FileSystem.showOpenDialog(false, false, Strings.CHOOSE_RUNTIME_PATH, null, null, function (err, files) {
                        if (!err) {
                            // If length == 0, user canceled the dialog; length should never be > 1
                            if (files.length > 0) {
                                // Load the new project into the folder tree
                                item.path = files[0];
                            }
                        } 
                        else {
                            console.log(err);
                        }
                    });
                }
            }
        });
    });

    
    CommandManager.register(Strings.Simulate, Commands.CMD_SIMULATE, runSimulator);
});
