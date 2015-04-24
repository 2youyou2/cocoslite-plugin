/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl*/

define(function (require, exports, module) {
    "use strict";

    var EditorManager = require("editor/EditorManager");

    var Params = function() {

        this.renderScene = function(ctx, selectedObjects){
            if(selectedObjects) {
                for(var i=0; i< selectedObjects.length; i++) {
                    if(selectedObjects[i].getComponent("MeshComponent")) {
                        render(ctx, selectedObjects[i]);
                    }
                }
            }
        };

        function render (ctx, obj){

            var mat = obj.getNodeToWorldTransform();
            ctx.transform(mat.a, mat.b, mat.c, mat.d, mat.tx, mat.ty);

            var mesh = obj.getComponent("MeshComponent");
            var vertices  = mesh.vertices;
            var subMeshes = mesh.subMeshes;

            ctx.strokeStyle = "#8fddff";
            ctx.lineWidth = 1/Math.max(Math.abs(mat.a), Math.abs(mat.d));
            
            for(var i=0; i<subMeshes.length; i++){
                var indices = subMeshes[i];
                for(var j=0; j<indices.length; j+=3){
                    var v1 = vertices[indices[j  ]].vertices;
                    var v2 = vertices[indices[j+1]].vertices;
                    var v3 = vertices[indices[j+2]].vertices;

                    ctx.beginPath();
                    ctx.moveTo(v1.x, v1.y);
                    ctx.lineTo(v2.x, v2.y);
                    ctx.lineTo(v3.x, v3.y);
                    ctx.lineTo(v1.x, v1.y);
                    ctx.stroke();
                }
            }
        };
    }

    function init(){
        EditorManager.register("MeshEditor", new Params);
    }

    init();
    exports.init = init;
});
