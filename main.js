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

    var ExtensionUtils         = brackets.getModule("utils/ExtensionUtils"),
        UrlParams              = brackets.getModule("utils/UrlParams").UrlParams,
        NodeDomain             = brackets.getModule("utils/NodeDomain");


    function _initCocosLite() {
        window.cl = {};

        // We have two types of editors now : GameEditor and IDE
        // Different editor has different titles and will init from different module
        // All is common modules for both
        cl.EditorType = {
            GameEditor : "GameEditor",
            IDE : "IDE",
            All : "All"
        }

        var params = new UrlParams();
        params.parse();

        var type = params.get("editorType");
        cl.editorType = type ? type : "GameEditor";
        brackets.config.app_title += (brackets.platform === "mac" ? " \u2014 " : " - ") + cl.editorType;

        if(appshell.app.focus) {
            window.focus = appshell.app.focus;
        }

        // Init cocoslite dir
        cl.clDir              = ExtensionUtils.getModulePath(module, "");
        cl.engineDir          = ExtensionUtils.getModulePath(module, "cocos2d-js/frameworks/cocos2d-html5");
        cl.clEngineDir        = ExtensionUtils.getModulePath(module, "cocos2d-js/frameworks/cocos2d-html5/cocoslite");
        cl.cocosConsoleDir    = ExtensionUtils.getModulePath(module, "cocos2d-js/tools/cocos2d-console/bin/");
        cl.templatesDir       = ExtensionUtils.getModulePath(module, "cocos2d-js/templates/");

        // Get module from cocos-html5/cocoslite
        // Used for user get cocoslite easily
        cl.getModule = function(path) {
            if(path.indexOf(".js") === -1) {
                path += ".js";
            }
            return require(cc.path.join(cl.clEngineDir, path));
        }
    }


    function _initNodeDomain() {
        cl.cocosDomain = new NodeDomain("cocos", ExtensionUtils.getModulePath(module, "node/CocosDomain"));

        cl.cocosDomain.exec("registerEnvironment", 'COCOS_CONSOLE_ROOT', cl.cocosConsoleDir);
        cl.cocosDomain.exec("registerEnvironment", 'TEMPLATES',          cl.templatesDir);
    }

    /** 
     * Load modules for current editor
     * GameEditor is the main editor, IDE will start from GameEditor
     * 
     * @private
     */
    function _initEditor() {

        var modules;

        if(cl.editorType === cl.EditorType.GameEditor) {
            modules = [
                    "cocos2d-js/frameworks/cocos2d-html5/CCBoot",
                    
                    "hack/hackBrackets",
                    "hack/hackCocos",

                    "core/ObjectManager",
                    "core/Hierarchy",
                    "core/Inspector",
                    "core/Undo",
                    "core/ComponentManager",
                    "core/Selector",
                    "core/Project",
                    "core/MenusManager",
                    "core/GameEditor",
                    "core/CopyManager",
                    
                    "thirdparty/vue",
                    "thirdparty/colorpicker/js/bootstrap-colorpicker",
                    "thirdparty/webui-popover/jquery.webui-popover",
                    "thirdparty/jquery-ui",

                    "editor/EditorManager",
                    "editor/SceneEditor",
                    "editor/MeshEditor",
                    "editor/Control2D",
                    "editor/Simulator",
                    "editor/PhysicsEditor",
                    "editor/CanvasControl"];

            _initNodeDomain();
        }
        else if(cl.editorType === cl.EditorType.IDE) {
            modules = ["ide/ide",
                       "ide/ChromeConnect"];
        }

        modules.push("common");

        require(modules);
    }


    _initCocosLite();
    _initEditor();
});
