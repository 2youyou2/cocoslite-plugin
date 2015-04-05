/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

/** Simple extension that adds a "File > Hello World" menu item */
define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain     = brackets.getModule("utils/NodeDomain");

    function initNodeDomain() {
        window.cocosDomain = new NodeDomain("cocos", ExtensionUtils.getModulePath(module, "node/CocosDomain"));
    }

    var modules;

    if(brackets.editorType === "GameEditor") {
        modules = ["thirdparty/vue",
                "cocos2d-js/frameworks/cocos2d-html5/CCBoot",
                "core/Cocos",
                "core/ObjectManager",
                "core/Hierarchy",
                "core/Inspector",
                "core/Undo",
                "core/ComponentManager",
                "core/Selector",
                "core/Project",

                "editor/SceneEditor",
                "editor/MeshEditor",
                "editor/Control2D",
                "ide/server"];

        initNodeDomain();
    }
    else if(brackets.editorType === "IDE") {
        modules = ["ide/ide",
                   "ide/ChromeConnect"];
    }

    require(modules);
});
