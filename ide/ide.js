/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define*/

define(function (require, exports, module) {
    "use strict";

    var ChromeConnect  = require("ide/ChromeConnect"),
        ProjectManager = brackets.getModule("project/ProjectManager"),
        EventDispatcher= brackets.getModule("utils/EventDispatcher"),
        Commands       = brackets.getModule("command/Commands"),
        CommandManager = brackets.getModule("command/CommandManager"),
        ProjectModel   = brackets.getModule("project/ProjectModel");

    function _shouldShowName(name) {
        return name.indexOf(".") == -1 || name.endWith(".js");
    }

    function openFile(file) {
        CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath:file});
    }

    function handleProjectOpen() {
        if(window.initIDE) {
            window.initIDE(exports);
            window.initIDE = null;
        }
    }

    function handleBeforeScriptChanged() {
        exports.trigger("beforeScriptChanged");
    }

    function handleScriptChanged(e, fullPath, scriptErr) {
        exports.trigger("scriptChanged", fullPath, scriptErr);
    }

    EventDispatcher.makeEventDispatcher(exports);

    ProjectManager.on("projectOpen", handleProjectOpen);
    ChromeConnect.on("beforeScriptChanged", handleBeforeScriptChanged);
    ChromeConnect.on("scriptChanged", handleScriptChanged);

    exports.openFile = openFile;
    exports.close = function() {
        window.close();
    }
    // ProjectModel._shouldShowName = _shouldShowName;
});