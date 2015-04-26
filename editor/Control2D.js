/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager = require("editor/EditorManager");

    var Params = function() {

        this._order = 10000;

        var Operation = {
            Positon:  0,
            Scale:    1,
            Rotation: 2
        };

        var operation = Operation.Positon;

        var obj             = null;
        var wordMat         = null;
        var mouseDown       = false;
        var selectedObjects = null;
        var canDoOperation  = false;

        var lastTouchMovePoint = null;

        var range = 15;

        var positionRect  = rect(-range/2, -range/2, range, range);
        var xPositionRect = rect(100, -range/3, range/1.5, range/1.5);
        var yPositionRect = rect(-range/3, 100, range/1.5, range/1.5);


        this.renderScene = function(ctx, objs){
            obj = null;
            selectedObjects = objs;
            if(selectedObjects && selectedObjects.length>0){
                obj = selectedObjects[0];
                render(ctx);
            }
        };


        function rect(x,y,width,height){
            return {x:x, y:y, width:width, height:height};
        }


        function renderPosition(ctx){
            ctx.lineWidth = 1;

            // ctx.fillStyle = "#ffffff";
            // ctx.beginPath();
            // ctx.moveTo(0,range/3);
            // ctx.lineTo(range/3,0);
            // ctx.lineTo(0,-range/3);
            // ctx.lineTo(-range/3,0);
            // ctx.fill();


            // ctx.globalAlpha = yPositionRect.hover ? 1 : 0.6;

            ctx.strokeStyle = "#ffff00";
            ctx.fillStyle   = yPositionRect.hover ? "#ffffff" : "#ffff00";
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(0,100);
            ctx.stroke();

            var yr = yPositionRect;
            ctx.fillRect(yr.x, yr.y, yr.width, yr.height);

            // ctx.globalAlpha = xPositionRect.hover ? 1 : 0.6;

            ctx.strokeStyle = "#ff0000";
            ctx.fillStyle   = xPositionRect.hover ? "#ffffff" : "#ff0000";
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(100,0);
            ctx.stroke();

            var xr = xPositionRect;
            ctx.fillRect(xr.x, xr.y, xr.width, xr.height);


            // ctx.globalAlpha = positionRect.hover ? 1 : 0.6;
            ctx.fillStyle = positionRect.hover ? "#ffffff" : "#0000ff";
            ctx.fillRect(positionRect.x, positionRect.y, positionRect.width, positionRect.height);
        }

        function renderScale(ctx){

        }

        function renderRotation(ctx){

        }

        function render(ctx){

            wordMat = obj.getNodeToWorldTransform();
            ctx.translate(0.5, 0.5);
            ctx.translate(wordMat.tx, wordMat.ty);

            switch(operation){
                case Operation.Positon:
                    renderPosition(ctx);
                    break;
                case Operation.Scale:
                    renderScale(ctx);
                    break;
                case Operation.Rotation:
                    renderRotation(ctx);
                    break;
            }
        }



        function hitPosition(p){
            positionRect.hover = xPositionRect.hover = yPositionRect.hover = false;

            if(cc.rectContainsPoint(positionRect, p)) {
                positionRect.hover  = true;
            }
            else if(cc.rectContainsPoint(xPositionRect, p)) {
                xPositionRect.hover = true;
            }
            else if(cc.rectContainsPoint(yPositionRect, p)) {
                yPositionRect.hover = true;
            }

            return positionRect.hover || xPositionRect.hover || yPositionRect.hover;
        }

        function hitScale(p){

        }

        function hitRotation(p){

        }


        function handlePosition(touch){
            for(var i=0; i<selectedObjects.length; i++){
                var obj = selectedObjects[i];
                
                var t = obj.getComponent("TransformComponent");
                var parent = obj.parent;

                var p1 = parent.convertToNodeSpace(touch.getLocation());
                var p2 = parent.convertToNodeSpace(lastTouchMovePoint);

                var delta = cl.p(p2).sub(p1);
                
                if(positionRect.hover) {
                    t.position = cc.pAdd(t.position, delta);
                }
                else if(xPositionRect.hover) {
                    t.x += delta.x;
                }
                else if(yPositionRect.hover) {
                    t.y += delta.y;
                }
            }
        }

        function handleScale(touch) {

        }

        function handleRotation(touch) {

        }

        
        this.onTouchBegan = function(touch) {
            if(!obj) {
                return false;
            }

            mouseDown          = canDoOperation;
            lastTouchMovePoint = touch.getLocation();

            return canDoOperation;
        };

        this.onTouchMoved = function(touch) {

            switch(operation) {
                case Operation.Positon:
                    handlePosition(touch);
                    break;
                case Operation.Scale:
                    handleScale(touch);
                    break;
                case Operation.Rotation:
                    handleRotation(touch);
                    break;
            }

            lastTouchMovePoint = touch.getLocation();
            
            return true;
        };

        this.onTouchEnded = function(touch) {
            mouseDown = false;
        };

        this.onMouseMove = function(event) {
            if(!obj || mouseDown) {
                return;
            }

            var worldPoint = event.getLocation();
            var p = cc.p(worldPoint.x-wordMat.tx, worldPoint.y-wordMat.ty);
            
            canDoOperation = false;

            switch(operation){
                case Operation.Positon:
                    canDoOperation = hitPosition(p);
                    break;
                case Operation.Scale:
                    canDoOperation = hitScale(p);
                    break;
                case Operation.Rotation:
                    canDoOperation = hitRotation(p);
                    break;
            }
        };
    }

    function init(){
        EditorManager.register("Control2D", new Params);
    }

    init();
    exports.init = init;
});
