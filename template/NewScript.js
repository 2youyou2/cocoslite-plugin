/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global cl, cc*/

(function (factory) {
    if(typeof exports === 'object') {
        factory(require, module.exports, module);
    } else if(typeof define === 'function') {
        define(factory);
    }
})(function(require, exports, module) {
    "use strict";

    var Component = cl.getModule("component/Component");

    var Params = function() {

        this.ctor = function() {
            this._super([]);
        }

        this._folder_ = "Script";
    }

    var NewScript = Component.extendComponent("NewScript", new Params);

    
    exports.Constructor = NewScript;
    exports.Params = Params;
});