/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var AppInit        = brackets.getModule("utils/AppInit"),
        ProjectManager = brackets.getModule("project/ProjectManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Dialogs        = brackets.getModule("widgets/Dialogs");

    var EventManager   = require("core/EventManager"),
        Strings        = require("strings"),
        Commands       = require("core/Commands"),
        SimulatorHtml  = require("text!html/SimulatorConfiguration.html"),
        Vue            = require("thirdparty/Vue");

    /**
     * Simulator configuration.
     * @type {object}
     */
    var _configuration = {
        list: [
            {
                name:  "mac",
                title: "Mac OSX",
                path:  "runtime/mac/PrebuiltRuntimeJs.app",
            },
            {
                name:  "win",
                title: "win32",
                path:  "runtime/win32/PrebuiltRuntimeJs.exe",
            },
            {
                name:  "web",
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
        ],
        current: 0
    };


    var _$dialog;

    function configure() {
        var dialog = Dialogs.showModalDialogUsingTemplate(_$dialog);

        dialog.done(function (id) {
            if (id === Dialogs.DIALOG_BTN_OK) {
                
            }
        });
    }

    function runSimulator() {
        var current = _configuration.list[_configuration.current];

        var cmd = "";
        var options = {
            cwd: ProjectManager.getProjectRoot().fullPath
        }

        if(current.name === 'web') {
            cmd = "cocos run -p web";
        } else {
            var path = current.path;

            if(current.name === 'mac') {
                path = cc.path.join(current.path, "Contents/MacOS/PrebuiltRuntimeJs\ Mac");
            }

            cmd =  path;
            options.connectConsole = true;
        } 

        cl.cocosDomain.exec("simulate", cmd, JSON.stringify(options));
    }

    AppInit.appReady(function() {
        var $simulator = $('<span class="simulator"></span>');
        var $content   = $('<span class="simulator-content">Simulator</span>').appendTo($simulator);
        var $configure = $('<span class="simulator-configure fa-cog"></span>').appendTo($simulator);

        $("#play-bar").append($simulator);

        $content.click(runSimulator);
        $configure.click(configure);


        _$dialog = $(SimulatorHtml);

        // 
        _configuration.list.forEach(function(item) {
            item.checked = false;
        });
        _configuration.list[_configuration.current].checked = true;

        new Vue({
            el: _$dialog[0],
            data: _configuration,
            methods: {
                onClick: function(index) {
                    _configuration.list[_configuration.current].checked = false;
                    _configuration.current = index;
                    _configuration.list[_configuration.current].checked = true;
                }
            }
        });
    });

    
    CommandManager.register(Strings.Simulate, Commands.CMD_SIMULATE, runSimulator);
});
