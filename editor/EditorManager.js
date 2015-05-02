/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl*/

define(function (require, exports, module) {
    "use strict";

    var EventManager = require("core/EventManager");

    var editors = {};
    var orderedEditors = [];

    function getEditors() {
        return editors;
    }

    function getOrderedEditors() {
        return orderedEditors;
    }

    function register(name, editor) {
        editors[name] = editor;
        editor.name = name;

        editor._order = editor._order ? editor._order : 0;
        orderedEditors.push(editor);
        orderedEditors.sort(function(a,b){return a._order>b._order?-1:1});
    }
    function remove(name) {
        editors[name] = null;

        var index = this.indexOf(orderedEditors);
        if (index > -1) {
            orderedEditors.splice(index, 1);
        }
    }



    exports.getEditors = getEditors;
    exports.getOrderedEditors = getOrderedEditors;
    exports.register = register;
    exports.remove = remove;
});
