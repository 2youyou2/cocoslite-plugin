/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, window, cc, cl, setInterval*/

define(function (require, exports, module) {
    "use strict";

    var FileSystem      = brackets.getModule("filesystem/FileSystem"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils");

    var Selector        = require("core/Selector"),
        EventManager    = require("core/EventManager"),
        EditorManager   = require("editor/EditorManager");



    function initConfig(){

        document.ccConfig = {
            "engineDir": cl.engineDir,
            "project_type": "javascript",
            "debugMode" : 1,
            "showFPS" : false,
            "frameRate" : 15,
            "id" : "gameCanvas",
            "renderMode" : 2,
            "modules":["chipmunk"]
        };

        cc.game._initConfig();
    }

    function initCocos() {
        function updateSize() { 
            cl.fgCanvas.setAttribute("width",  cc._canvas.width);
            cl.fgCanvas.setAttribute("height", cc._canvas.height);

            var scene = cc.director.getRunningScene();
            if(scene && scene.canvas) {
                scene.canvas.recalculatePosition();
            }
        }

        var isRegisterEvent = false;
        cc.game.onStart = function(){

            if(!isRegisterEvent) {
                isRegisterEvent = true;
                cc.inputManager._isRegisterEvent = false;
                cc.inputManager.registerSystemEvent(cl.fgCanvas);
            }


            // hack cc.view._resizeEvent
            cc.view._resizeEvent = function () {
                var view;
                if(this.setDesignResolutionSize){
                    view = this;
                }else{
                    view = cc.view;
                }

                view._initFrameSize();
                if (view._resizeCallback) {
                    view._resizeCallback.call();
                }
                var width = view._frameSize.width;
                var height = view._frameSize.height;
                if (width > 0){
                    view.setDesignResolutionSize(width, height, view._resolutionPolicy);
                }

                updateSize();
            };

            cc.view.setResolutionPolicy(cc.ResolutionPolicy.EXACT_FIT);
            cc.view.enableRetina(false);
            cc.view._resizeEvent();
            cc.view.resizeWithBrowserSize(true);


            window.addEventListener("focus", function() {
                cc.director.resume();
            });

            window.addEventListener("blur", function() {
                cc.director.pause();
            });

            // need trigger this event after cocos state ready, like resize .etc
            EventManager.trigger(EventManager.GAME_START);
        };

        function loadCocosLiteModule(cb) {
            var dir = FileSystem.getDirectoryForPath(cl.clEngineDir);
            var sources = [];

            function readSource(item, cb) {
                if(item.name.endWith(".js")) {
                    sources.push(item.fullPath);
                }

                if(item.isDirectory) {
                    item.getContents(function(err, subItems) {
                        var i = 0;
                        subItems.forEach(function(subItem) {
                            readSource(subItem, function() {
                                if(++i === subItems.length) {
                                    cb();
                                }
                            });
                        });
                    });
                }
                else{
                    cb();
                }
            }

            readSource(dir, function(){
                require(sources, cb);
            })

            
        }
        
        cc.loader.loadJsWithImg = cc.loader.loadJs;

        cc.game.prepare(function(){

            // hack cocos load flow

            var originSetGLDefaultValues = cc.Director.prototype.setGLDefaultValues;
            cc.Director.prototype.setGLDefaultValues = function () {
                originSetGLDefaultValues.apply(this, arguments);

                // set background color to transparent
                cc._renderContext.clearColor(0.0, 0.0, 0.0, 0.0);
            };

            var originCreate3DContext = cc.create3DContext;
            cc.create3DContext = function(canvas, opt_attribs) {
                // support alpha background
                opt_attribs.alpha = true;

                return originCreate3DContext.apply(this, arguments);
            }

            // load CocosLote module
            loadCocosLiteModule(function(){
                cc.game._prepared = true;
                EventManager.trigger(EventManager.COCOS_LOADED);
            });
        });

    }

    initConfig();
    initCocos();

});
