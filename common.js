/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */


define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");

    // extend jquery 
    $.extend({
        includePath: '',
        include: function(file) {
            var files = typeof file == "string" ? [file]:file;
            for (var i = 0; i < files.length; i++) {
                var name = files[i];
                var att = name.split('.');
                var ext = att[att.length - 1].toLowerCase();
                var isCSS = ext == "css";
                var tag = isCSS ? "link" : "script";
                var attr = isCSS ? " type='text/css' rel='stylesheet' " : " language='javascript' type='text/javascript' ";
                var link = (isCSS ? "href" : "src") + "='" + $.includePath + name + "'";
                if ($(tag + "[" + link + "]").length == 0) $('head').append($("<" + tag + attr + link + "></" + tag + ">"));
            }
       }
    });

    $.includePath = ExtensionUtils.getModulePath(module, "");

    // extend String
    String.prototype.endWith = function(endStr) {
        var d=this.length-endStr.length;
        return (d>=0 && this.lastIndexOf(endStr)===d);
    };

    String.prototype.capitalize = function () {
      return this.charAt(0).toUpperCase() + this.slice(1);
    };
});