/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

/** Simple extension that adds a "File > Hello World" menu item */
define(function (require, exports, module) {
    "use strict";

    require("thirdparty/vue");

    require(["cocos2d-js/frameworks/cocos2d-html5/CCBoot",
            "core/Cocos",
            "core/ObjectInjector",
            "core/Hierarchy",
            "core/Inspector",
            "core/Undo",
            "core/ComponentManager",
            "core/Selector",
            "core/Project",

            "editor/SceneEditor",
            "editor/MeshEditor",
            "editor/Control2D"]);
});