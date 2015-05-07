/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var AppInit       = brackets.getModule('utils/AppInit');

    var EventManager  = require("core/EventManager"),
        EditorManager = require("editor/EditorManager");

    var _playing = false;


    var Editor = function() {
        var points;
        var obj;
        var currentPoint;
        var currentIndex;
        var mouseDown;
        var path;
        var terrain;

        var currentMousePoint;
        var closestID;
        var secondID;

        this.renderScene = function(ctx, selectedObjects) {
            if(!cl.space || _playing) {
                return;
            }
            if(selectedObjects && selectedObjects.length === 1) {
                obj    = selectedObjects[0];
                var cs = obj.components;

                var mat = obj.getNodeToWorldTransform();
                ctx.transform(mat.a, mat.b, mat.c, mat.d, mat.tx, mat.ty);

                ctx.globalAlpha = 0.5;
                ctx.fillStyle   = "#f00";
                ctx.strokeStyle = "#f00"; 
                ctx.lineWidth   = 2;

                for(var i=0; i<cs.length; i++) {
                    var className = cs[i].className;
                    var shape     = cs[i];
                    var func      = null;

                    switch(className) {
                        case 'PhysicsSegment' :
                            func = renderSegment;
                            break;
                        case 'PhysicsBox' :
                            func = renderBox;
                            break;
                        case 'PhysicsPoly' :
                            func = renderPoly;
                            break;
                        default :
                            func = function(){}
                    }

                    func(ctx, shape);
                }
            } 
        }

        function renderSegment(ctx, shape) {

            var start = shape.start;
            var end   = shape.end;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x,   end.y);
            ctx.stroke();
        }

        function renderBox(ctx, shape) {
            var w = shape.width;
            var h = shape.height;
            var a = shape.anchor;

            ctx.fillRect(-w*a.x, -h*a.y, w, h);
        }

        function renderPoly(ctx, shape) {
            var verts = shape.verts;

            if(verts.length < 3) return;

            ctx.beginPath();
            ctx.moveTo(verts[0].x, verts[0].y);

            for(var i=1; i<verts.length; i++) {
                ctx.lineTo(verts[i].x, verts[i].y)
            }

            ctx.lineTo(verts[0].x, verts[0].y);

            ctx.fill();
        }

        function render (ctx, obj){
            if(!path) {
                return;
            }

            var mat = obj.getNodeToWorldTransform();
            ctx.transform(mat.a, mat.b, mat.c, mat.d, mat.tx, mat.ty);

            ctx.fillStyle   = "#ffffff"; 
            ctx.strokeStyle = "#ffffff"; 

            ctx.lineWidth = 1/Math.max(Math.abs(mat.a), Math.abs(mat.d));
            var radius = 5*ctx.lineWidth;

            for(var i=0; i<points.length; i++){
                ctx.fillStyle = points[i].hover ? "#0000ff" : "#ffffff"; 

                ctx.beginPath(); 
                ctx.arc(points[i].x, points[i].y, radius, 0, Math.PI*2, true); 
                ctx.fill();

                ctx.beginPath(); 
                ctx.moveTo(points[i].x, points[i].y);
                var j = i+1>=points.length ? 0 : i+1;
                ctx.lineTo(points[j].x, points[j].y); 
                ctx.stroke();
            }

            if(shift){
                try{
                    if(closestID === undefined || secondID === undefined || currentMousePoint === undefined ) {
                        return;
                    }

                    var p1 = points[closestID], p2 = points[secondID];
                    if(!p1 || !p2) {
                        return;
                    }

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(currentMousePoint.x, currentMousePoint.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(currentMousePoint.x, currentMousePoint.y, radius, 0, Math.PI*2, true); 
                    ctx.fill();
                }
                catch(e){
                    cc.log(e);
                }
            }
        }
    }


    function init(){
        EditorManager.register("PhysicsEditor", new Editor);
    }


    AppInit.appReady(function() {
        init(); 
    })


    function handleSceneLoaded(event, scene) {
        if(!cl.space) {
            return;
        }

        cl.space.gravity = cp.v(0, 0);
    }

    function handleCocosLoaded() {
        if(!cl.space) {
            return;
        }

        var originSetSensor = cp.Shape.prototype.setSensor;
        cp.Shape.prototype.setSensor = function(sensor) {
            if(_playing) {
                originSetSensor.apply(this, arguments);
            }
        };

        cp.Shape.prototype.init = function() {
            if(!_playing) {
                _playing = true;
                this.setSensor(true);
                _playing = false;
            }
        }
    }

    function handleBeforePlaying() {
        _playing = true;
    }

    function handleEndPlaying(event, scene) {
        if(!cl.space) {
            return;
        }

        _playing = false;

        cl.space = scene.space;
        scene.scheduleUpdate();
    }

    EventManager.on(EventManager.SCENE_LOADED,              handleSceneLoaded);
    EventManager.on(EventManager.COCOS_LOADED,              handleCocosLoaded);
    EventManager.on(EventManager.SCENE_BEFORE_PLAYING,      handleBeforePlaying);
    EventManager.on(EventManager.SCENE_END_PLAYING,         handleEndPlaying);

    exports.init = init;

});