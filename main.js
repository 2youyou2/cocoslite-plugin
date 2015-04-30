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
        ProjectModel           = brackets.getModule("project/ProjectModel"),
        ProjectManager         = brackets.getModule("project/ProjectManager"),
        UrlParams              = brackets.getModule("utils/UrlParams").UrlParams,
        PreferencesManager     = brackets.getModule("preferences/PreferencesManager"),
        NodeDomain             = brackets.getModule("utils/NodeDomain");

    function initCocosLite() {
        window.cl = {};

        cl.clDir              = ExtensionUtils.getModulePath(module, "");
        cl.engineDir          = ExtensionUtils.getModulePath(module, "cocos2d-js/frameworks/cocos2d-html5");
        cl.clEngineDir        = ExtensionUtils.getModulePath(module, "cocos2d-js/frameworks/cocos2d-html5/cocoslite");
        cl.cocosConsoleDir    = ExtensionUtils.getModulePath(module, "cocos2d-js/tools/cocos2d-console/bin/");


        cl.getModule = function(path) {
            if(path.indexOf(".js") === -1) {
                path += ".js";
            }
            return require(cc.path.join(cl.clEngineDir, path));
        }
    }


    function initNodeDomain() {
        cl.cocosDomain = new NodeDomain("cocos", ExtensionUtils.getModulePath(module, "node/CocosDomain"));
        cl.cocosDomain.exec("registerEnvironment", cl.cocosConsoleDir)
            .done(function(){
                console.log("registerEnvironment success.");
            });
    }

    function initEditor() {

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
                    "core/CopyManager",
                    
                    "widgets/ShowAssets",

                    "thirdparty/colorpicker/js/bootstrap-colorpicker",
                    "thirdparty/webui-popover/jquery.webui-popover",
                    "thirdparty/jquery-ui",

                    "editor/EditorManager",
                    "editor/SceneEditor",
                    "editor/MeshEditor",
                    "editor/Control2D",
                    "editor/Simulator",
                    "editor/CanvasControl"];

            initNodeDomain();
        }
        else if(brackets.editorType === brackets.EditorType.IDE) {
            modules = ["ide/ide",
                       "ide/ChromeConnect"];
        }

        modules.push("common");

        require(modules);
    }

    function hackBrackets() {

        function initEditorType() {
            brackets.EditorType = {
                GameEditor : "GameEditor",
                IDE : "IDE",
                All : "all"
            }

            var params = new UrlParams();
        
            // read URL params
            params.parse();

            var type = params.get("editorType");
            brackets.editorType = type ? type : "GameEditor";
            brackets.config.app_title += (brackets.platform === "mac" ? " \u2014 " : " - ") + brackets.editorType;

            if(appshell.app.focus) {
                window.focus = appshell.app.focus;
            }
        }

            
        function hackPreferencesManager() {
            var PREFS_NAME          = "mainView.state";

            var originSetViewState = PreferencesManager.setViewState;
            PreferencesManager.setViewState = function() {
                if(arguments[0] === PREFS_NAME) {
                    arguments[0] = PREFS_NAME + "." + brackets.editorType;
                }
                originSetViewState.apply(this, arguments);
            }

            var originGetViewState = PreferencesManager.getViewState;
            PreferencesManager.getViewState = function() {
                if(arguments[0] === PREFS_NAME) {
                    arguments[0] = PREFS_NAME + "." + brackets.editorType;
                }
                return originGetViewState.apply(this, arguments);
            }
        }

        function hackProjectModel() {
            ProjectModel._shouldShowName = function(name, path) {

                var rootPath = ProjectManager.getProjectRoot().fullPath;
                var relativePath = path.replace(rootPath, "");

                var show = true;
                // if(brackets.editorType === brackets.EditorType.GameEditor) {
                //     show = !name.match(ProjectModel._exclusionListRegEx) &&
                //            (relativePath.indexOf('res') === 0 ||
                //            name === '.cocos-project.json');
                // } else if(brackets.editorType === brackets.EditorType.IDE) {
                    show = !name.match(ProjectModel._exclusionListRegEx) &&
                           relativePath.indexOf('res') === 0 ||
                           relativePath.indexOf('src') === 0 ||
                           relativePath.indexOf('runtime') === 0 ||
                           relativePath === 'main.js' ||
                           name === '.cocos-project.json';
                // }

                return show;
            }
        }

        initEditorType();
        hackPreferencesManager();
        hackProjectModel();
    }

    hackBrackets();

    initCocosLite();
    initEditor();
});
