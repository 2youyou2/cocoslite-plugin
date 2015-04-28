/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var AppInit        = brackets.getModule("utils/AppInit"),
        ProjectManager = brackets.getModule("project/ProjectManager");

    var EventManager   = require("core/EventManager");

    AppInit.appReady(function() {
        var $Simulator = $("<button>Simulator</button>");

        $("#play-bar").append($Simulator);


        $Simulator.click(function() {
            var dir = ProjectManager.getProjectRoot().fullPath;
            cl.cocosDomain.exec("simulate", dir, 'mac');
        });
    });

});
