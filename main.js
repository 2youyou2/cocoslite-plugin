/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

require.config({
    paths: {
        "text" : "lib/text",
        "i18n" : "lib/i18n"
    },
    locale: brackets.getLocale()
});


define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        UrlParams      = brackets.getModule("utils/UrlParams").UrlParams,
        NodeDomain     = brackets.getModule("utils/NodeDomain");

    brackets.EditorType = {
        GameEditor : "GameEditor",
        IDE : "IDE",
        All : "all"
    }

    function initNodeDomain() {
        window.cocosDomain = new NodeDomain("cocos", ExtensionUtils.getModulePath(module, "node/CocosDomain"));
    }

    function initEditor() {
        var params = new UrlParams();
    
        // read URL params
        params.parse();

        var type = params.get("editorType");
        brackets.editorType = type ? type : "GameEditor";
        brackets.config.app_title += (brackets.platform === "mac" ? " \u2014 " : " - ") + brackets.editorType;

        if(appshell.app.focus) {
            window.focus = appshell.app.focus;
        }


        var modules;

        if(brackets.editorType === brackets.EditorType.GameEditor) {
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
                    "core/MenusManager",
                    "core/GameEditor",
                    
                    "editor/EditorManager",
                    "editor/SceneEditor",
                    "editor/MeshEditor",
                    "editor/Control2D"];

            initNodeDomain();
        }
        else if(brackets.editorType === brackets.EditorType.IDE) {
            modules = ["ide/ide",
                       "ide/ChromeConnect"];
        }

        require(modules);
    }

    initEditor();
});
