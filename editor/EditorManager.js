/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cl*/

define(function (require, exports, module) {
    "use strict";

    var EventManager = require("core/EventManager");

    var _editors        = {};
    var _orderedEditors = [];

    function getEditors() {
        return _editors;
    }

    function getOrderedEditors() {
        return _orderedEditors;
    }

    function register(name, editor) {
        _editors[name] = editor;
        editor.name = name;

        editor._order = editor._order ? editor._order : 0;
        _orderedEditors.push(editor);
        _orderedEditors.sort(function(a,b){return a._order>b._order?-1:1});
    }
    function remove(name) {
        _editors[name] = null;

        var index = this.indexOf(_orderedEditors);
        if (index > -1) {
            _orderedEditors.splice(index, 1);
        }
    }


    exports.getEditors = getEditors;
    exports.getOrderedEditors = getOrderedEditors;
    exports.register = register;
    exports.remove = remove;
});
