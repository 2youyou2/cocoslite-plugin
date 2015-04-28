/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager = require("editor/EditorManager"),
        Control2D     = require("editor/Control2D"),
        EventManager  = require("core/EventManager");

    var _editor;
    var _$scaleSlider;

    var Editor = function() {

        this._order = Number.MAX_VALUE;

        function handleHand(touch) {
            var canvas = getCanvas();

            if(!canvas) {
                return;
            }

            canvas.offset.addToSelf(touch.getDelta());
            canvas.recalculatePosition();
        }

        
        this.onTouchBegan = function(touch) {
            return Control2D.getOperation() === Control2D.Operation.Hand;
        };

        this.onTouchMoved = function(touch) {

            handleHand(touch);
            
            return true;
        };

        this.onTouchEnded = function(touch) {
        };
    }

    function getCanvas() {
        var scene = cc.director.getRunningScene();
        if(!scene) {
            return null;
        }

        return scene.canvas;
    }


    function scaleToOrigin() {
        var canvas = getCanvas();

        canvas.scale = 1;
        canvas.offset = cl.p(0,0);
        canvas.recalculatePosition();

        handleCanvasScaleChanged();
    }

    function scaleToFit() {
        var canvas = getCanvas();

        var scaleX = cc._canvas.width  / canvas.width;
        var scaleY = cc._canvas.height / canvas.height;

        canvas.scale = Math.min(scaleX, scaleY);
        canvas.offset = cl.p(0,0);
        canvas.recalculatePosition();

        handleCanvasScaleChanged();
    }

    function handleCanvasScaleChanged(event, scene) {
        var canvas = scene ? scene.canvas : getCanvas();
        _$scaleSlider.slider("value", canvas.scale*100);
    }

    function createControlBar() {
        var $el = $('<div class="canvas-control-bar">');

        _$scaleSlider    = $('<span class="canvas-scale-slider">').appendTo($el);
        var $originScale = $('<span class="origin-scale cl-icon-button fa-search" title="Zoom to 100%">').appendTo($el);
        var $fitScale    = $('<span class="fit-scale    cl-icon-button iconicfill-fullscreen" title="Zoom to fit">').appendTo($el);


        _$scaleSlider.slider({
            min: 1,
            max: 200,
            value: 100,
            orientation: "vertical",
            range: "min",
            slide: function (event, ui) {
                var canvas = getCanvas();

                canvas.scale = ui.value/100;
                canvas.recalculatePosition();
            }
        });

        $originScale.click(scaleToOrigin);
        $fitScale.click(scaleToFit);


        return $el;
    }

    function handleControlStateChanged(e, old, now) {

        if(old === Control2D.Operation.Hand || now === Control2D.Operation.Hand) {
            cl.$fgCanvas.toggleClass('control-hand');
        }
    }

    function handleCocosLoaded() {
        var $el = createControlBar();
        cl.$fgCanvas.parent().append($el);
    }



    function init(){
        _editor = new Editor;
        EditorManager.register("CanvasControl", _editor);
    }

    EventManager.on(EventManager.CONTROL_STATE_CHANGED, handleControlStateChanged);
    EventManager.on(EventManager.COCOS_LOADED,          handleCocosLoaded);
    EventManager.on(EventManager.SCENE_LOADED,          handleCanvasScaleChanged);
    EventManager.on(EventManager.SCENE_BEGIN_PLAYING,   handleCanvasScaleChanged);
    EventManager.on(EventManager.SCENE_END_PLAYING,     handleCanvasScaleChanged);

    init();
    exports.init = init;
});
