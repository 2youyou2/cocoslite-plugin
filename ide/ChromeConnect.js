/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define*/

define(function (require, exports, module) {
    "use strict";

    var Chrome          = require("ide/chrome-remote-interface/chrome").Chrome,
        EventDispatcher    = brackets.getModule("utils/EventDispatcher"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        DocumentManager = brackets.getModule("document/DocumentManager");

    var chrome;
    var chromeDebugger;
    var scripts = {};

    function createChrome() {
        var params = {
            host:'127.0.0.1',
            port:'9234',
            chooseTab: function(tabs) {
                for(var i=0; i<tabs.length; i++) {
                    if(tabs[i].title.endWith("GameEditor")){
                        return i;
                    }
                }
                return 0;
            }};

        chrome = new Chrome(params);

        chrome.on('error', function(err) {
            console.error('Cannot connect to chrome:', err)
        })
        chrome.on('connect', setup);
    }

    function setup() {
        chrome.on('event', function(e, message){
            var params = message.params;
            var method = message.method;

            if(method === 'Debugger.scriptParsed') {
                if (params.url.indexOf('file:///') >= 0) {
                    var file = FileSystem.getFileForPath(params.url.replace("file:///", "/"));
                    file.script = params;
                }
            }

            // console.log("message", message);
        })

        chrome.Debugger.enable(function() {
            chromeDebugger = chrome.Debugger
        })
    }

    function handleDocumentSaved(e, doc) {
        var script = doc.file.script;

        var params = {
            scriptId: script.scriptId,
            scriptSource: doc.getText()
        }

        exports.trigger("beforeScriptChanged");

        chromeDebugger.setScriptSource(params, function(scriptErr, response) {
            
            if (scriptErr) {
                process.stderr.write("Error: " + response.message+"\n")
                console.error("Could not inject source(", response.message, "), try reloading page")
            }
            
            exports.trigger("scriptChanged", doc.file.fullPath, scriptErr);
        });
    }

    EventDispatcher.makeEventDispatcher(exports);

    DocumentManager.on("documentSaved", handleDocumentSaved);

    createChrome();
});