/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var AppInit       = brackets.getModule("utils/AppInit");

    var EditorManager = require("editor/EditorManager"),
        EventManager  = require("core/EventManager");

    var _editor;

    var Operation = {
        Position: 0,
        Scale:    1,
        Rotation: 2,
        Hand:     3
    };

    var _operation = Operation.Position;


    var Editor = function() {

        this._order = Number.MAX_VALUE;


        var firstObject     = null;
        var wordMat         = null;
        var mouseDown       = false;
        var selectedObjects = null;
        var canDoOperation  = false;

        var lastTouchMovePoint = null;

        var range = 15;
        var radius = 100;

        var positionRect  = rect(-range/2, -range/2, range, range);
        var xPositionRect = rect(radius, -range/3, range/1.5, range/1.5);
        var yPositionRect = rect(-range/3, radius, range/1.5, range/1.5);


        this.renderScene = function(ctx, objs) {
            firstObject = null;
            selectedObjects = objs;
            if(selectedObjects && selectedObjects.length>0) {
                firstObject = selectedObjects[0];
                render(ctx);
            }
        };


        function rect(x,y,width,height) {
            return {x:x, y:y, width:width, height:height};
        }


        function renderPosition(ctx, rect) {
            ctx.lineWidth = 1;

            // ctx.globalAlpha = yPositionRect.hover ? 1 : 0.6;

            ctx.strokeStyle = "#ffff00";
            ctx.fillStyle   = yPositionRect.hover ? "#ffffff" : "#ffff00";
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(0,radius);
            ctx.stroke();

            var yr = yPositionRect;

            if(rect) {
                ctx.fillRect(yr.x, yr.y, yr.width, yr.height);    
            } else {
                ctx.moveTo(yr.x, yr.y);
                ctx.lineTo(yr.x+yr.width, yr.y);
                ctx.lineTo(yr.x+yr.width/2, yr.y+yr.height);
                ctx.fill();
            }
            

            // ctx.globalAlpha = xPositionRect.hover ? 1 : 0.6;

            ctx.strokeStyle = "#ff0000";
            ctx.fillStyle   = xPositionRect.hover ? "#ffffff" : "#ff0000";
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(radius,0);
            ctx.stroke();

            var xr = xPositionRect;

            if(rect) {
                ctx.fillRect(xr.x, xr.y, xr.width, xr.height);    
            } else {
                ctx.moveTo(xr.x, xr.y);
                ctx.lineTo(xr.x, xr.y+xr.height);
                ctx.lineTo(xr.x+xr.width, xr.y+xr.height/2);
                ctx.fill();
            }


            // ctx.globalAlpha = positionRect.hover ? 1 : 0.6;
            ctx.fillStyle = positionRect.hover ? "#ffffff" : "#0000ff";
            ctx.fillRect(positionRect.x, positionRect.y, positionRect.width, positionRect.height);
        }

        function renderScale(ctx) {
            renderPosition(ctx, rect);
        }

        function renderRotation(ctx) {

            ctx.strokeStyle = canDoOperation ? "#fff" : "#00f";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0,0, radius, 0,2*Math.PI);
            ctx.stroke();

            ctx.lineWidth = 1;

            var angle = firstObject.rotationX / 180 * Math.PI;

            var x = radius * Math.sin(angle);
            var y = radius * Math.cos(angle);

            ctx.strokeStyle = "#ffff00";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(-x, -y);
            ctx.stroke();


            angle -= Math.PI/2;
            
            x = radius * Math.sin(angle);
            y = radius * Math.cos(angle);

            ctx.strokeStyle = "#ffff00";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(-x, -y);
            ctx.stroke();
        }

        function render(ctx) {

            wordMat = firstObject.getNodeToWorldTransform();
            ctx.translate(0.5, 0.5);
            ctx.translate(wordMat.tx, wordMat.ty);

            switch(_operation){
                case Operation.Position:
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


        function hitPosition(p) {
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

        function hitScale(p) {
            return hitPosition(p);
        }

        function hitRotation(p) {
            var l = cc.pLength(p);
            return Math.abs(l-radius) <= 4;
        }

        function handlePosition(touch) {
            for(var i=0; i<selectedObjects.length; i++) {
                var obj = selectedObjects[i];
                
                var t = obj.getComponent("TransformComponent");
                var parent = obj.parent;

                var p1 = parent.convertToNodeSpace(touch.getLocation());
                var p2 = parent.convertToNodeSpace(lastTouchMovePoint);

                var delta = cl.p(p1).sub(p2);
                
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
            for(var i=0; i<selectedObjects.length; i++) {
                var obj = selectedObjects[i];
                
                var t = obj.getComponent("TransformComponent");
                var parent = obj.parent;

                var p1 = parent.convertToNodeSpace(touch.getLocation());
                var p2 = parent.convertToNodeSpace(lastTouchMovePoint);

                var delta = cl.p(p1).sub(p2);
                
                if(positionRect.hover) {
                    t.scaleX += delta.x > 0 ? 0.1 : -0.1;
                    t.scaleY += delta.y > 0 ? 0.1 : -0.1;
                }
                else if(xPositionRect.hover) {
                    t.scaleX += delta.x > 0 ? 0.1 : -0.1;
                }
                else if(yPositionRect.hover) {
                    t.scaleY += delta.y > 0 ? 0.1 : -0.1;
                }
            }
        }

        function handleRotation(touch) {
                
            var parent = firstObject.parent;

            var p1 = firstObject.convertToNodeSpace(touch.getLocation());
            var p2 = firstObject.convertToNodeSpace(lastTouchMovePoint);

            var angle1 = -cc.pToAngle(p1);
            var angle2 = -cc.pToAngle(p2);

            var delta = (angle1 - angle2) * 180 / Math.PI;

            for(var i=0; i<selectedObjects.length; i++) {
                var obj = selectedObjects[i];
                var t = obj.getComponent("TransformComponent");

                t.rotation = cl.p(t.rotationX+delta, t.rotationY+delta);
            }
        }

        
        this.onTouchBegan = function(touch) {

            if(!firstObject) {
                return false;
            }

            mouseDown          = canDoOperation;
            lastTouchMovePoint = touch.getLocation();

            return canDoOperation;
        };

        this.onTouchMoved = function(touch) {

            switch(_operation) {
                case Operation.Position:
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
            if(!firstObject || mouseDown) {
                return;
            }

            var worldPoint = event.getLocation();
            var p = cc.p(worldPoint.x-wordMat.tx, worldPoint.y-wordMat.ty);
            
            canDoOperation = false;

            switch(_operation){
                case Operation.Position:
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

        this.switchState = function(id) {
            var oldOperation = _operation;
            _operation = Operation[id];

            EventManager.trigger(EventManager.CONTROL_STATE_CHANGED, oldOperation, _operation);
        }
    }

    function init(){
        _editor = new Editor;
        EditorManager.register("Control2D", _editor);
    }

    AppInit.appReady(function() {
        init();

        var current;

        function handleClick() {
            if(!_editor) {
                return;
            }

            var temp = $(this);
            var id = temp.attr('id');

            _editor.switchState(id);

            toggleCurrent(temp);

            current = temp;
        }

        function toggleCurrent(btn) {
            if(current[0] != btn[0]) {
                btn.toggleClass('active');
                current.toggleClass('active');
            }

            current = btn;
        }

        var $controls = $('<span class="control-tool" />');

        var controls = {};
        controls["Hand"]     = $('<span id="Hand"      class="cl-icon-button control-tool-hand     fa-hand-o-up" >').appendTo($controls).click(handleClick);
        controls["Position"] = $('<span id="Position"  class="cl-icon-button control-tool-position iconicfill-move-alt1 active">').appendTo($controls).click(handleClick);
        controls["Rotation"] = $('<span id="Rotation"  class="cl-icon-button control-tool-rotation iconicfill-spin">').appendTo($controls).click(handleClick);
        controls["Scale"]    = $('<span id="Scale"     class="cl-icon-button control-tool-scale    iconicfill-fullscreen">').appendTo($controls).click(handleClick);

        current = controls["Position"];

        $("#play-bar").prepend($controls);

        cl.$fgCanvas.keyup(function(e){

            var key;
            switch(e.which) {
                case cc.KEY.q :
                    key = 'Hand';
                    break;
                case cc.KEY.w :
                    key = 'Position';
                    break;
                case cc.KEY.e :
                    key = 'Rotation';
                    break;
                case cc.KEY.r :
                    key = 'Scale';
                    break;
            }

            if(key) {
                _editor.switchState(key);
                toggleCurrent(controls[key]);
            }
        });    
    });

    exports.init = init;
    exports.Operation = Operation;
    exports.getOperation = function() {
        return _operation;
    }
});
