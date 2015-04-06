/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, window, cc, cl, setInterval*/

define(function (require, exports, module) {
    "use strict";

    var Scene           = require("text!html/Scene.html"),
        Selector        = require("core/Selector"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        EventDispatcher = brackets.getModule("utils/EventDispatcher"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils");

    var $scene = $(Scene);

    EventDispatcher.makeEventDispatcher(exports);

    function appendDefaultStyle(){
        // Insert default overlay style at the beginning of head, so any custom style can overwrite it.
        var styleUrl = ExtensionUtils.getModulePath(module, "../css/main.css");
        var style = $('<link rel="stylesheet" type="text/css" />');
        $(document.head).prepend(style);
        $(style).attr('href', styleUrl);
    }

    function hackHtml() {
        var $statusBar = $("#status-bar");
        $statusBar.hide();
    }

    function initConfig(){
        window.cl = {};
        cl.engineDir = ExtensionUtils.getModulePath(module, "../cocos2d-js/frameworks/cocos2d-html5");
        cl.clDir = ExtensionUtils.getModulePath(module, "../cocos2d-js/frameworks/cocos2d-html5/cocoslite");
        cl.getModule = function(path) {
            if(path.indexOf(".js") === -1) {
                path += ".js";
            }
            return require(cc.path.join(cl.clDir, path));
        }

        document.ccConfig = {
            "engineDir": cl.engineDir,
            "project_type": "javascript",
            "debugMode" : 1,
            "showFPS" : true,
            "frameRate" : 15,
            "id" : "gameCanvas",
            "renderMode" : 2,
            "modules":["cocos2d"]
        };

        cc.game._initConfig();
    }


    function initCanvas(){

        // cl.$editor = $('#editor-holder');
        // cl.$editor.append($scene);

        cl.$canvas = $scene.find('#gameCanvas');

        cl.$fgCanvas = $scene.find("#fgCanvas");
        cl.fgCanvas = cl.$fgCanvas[0];
        // cl.$fgCanvas[0].style.display = 'none';

        cl.$fgCanvas._renderList = [];
        cl.$fgCanvas.addRender = function(func){
            this._renderList.push(func);
        };


        cl.$fgCanvas.ctx = cl.fgCanvas.getContext('2d');
        var render = function(){
            if(!cc._canvas) {
                return;
            }

            var selectedObjects = Selector.getSelectObjects();

            var fg = cl.$fgCanvas;
            var maxW = cc._canvas.width ;
            var maxH = cc._canvas.height;
     
            var ctx = fg.ctx;
            ctx.clearRect(0,0,maxW,maxH);

            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -maxH);
            for(var i=0; i<fg._renderList.length; i++){
                ctx.save();
                fg._renderList[i](ctx, selectedObjects);
                ctx.restore();
            }
            ctx.restore();
        };
        
        setInterval(render, 100);
    }

    function initCocos() {
        var updateSize = function(){ 
            cl.fgCanvas.setAttribute("width",  cc._canvas.width);
            cl.fgCanvas.setAttribute("height", cc._canvas.height);
        };

        var isRegisterEvent = false;
        cc.game.onStart = function(){

            exports.trigger("gameStart");

            if(!isRegisterEvent) {
                isRegisterEvent = true;
                cc.inputManager._isRegisterEvent = false;
                cc.inputManager.registerSystemEvent(cl.fgCanvas);
            }

            var $container = $scene.find('#Cocos2dGameContainer');
            $container.css({margin:'0'});

            // hack cc.view._resizeEvent
            cc.view._resizeEvent = function () {
                var view;
                if(this.setDesignResolutionSize){
                    view = this;
                }else{
                    view = cc.view;
                }
                if (view._resizeCallback) {
                    view._initFrameSize();
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

        };

        function loadCocosLiteModule(cb) {
            var dir = FileSystem.getDirectoryForPath(cl.clDir);
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
            loadCocosLiteModule(function(){
                cc.game._prepared = true;
            });
        });
    }


    function initScene($container, cb) {
        $container.append($scene);
        cc.game.run("gameCanvas");
    }

    hackHtml();
    appendDefaultStyle();
    initConfig();
    initCanvas();
    initCocos();

    exports.initScene = initScene;
});
