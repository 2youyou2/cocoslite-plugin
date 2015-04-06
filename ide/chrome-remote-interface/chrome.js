/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define*/

define(function (require, exports, module) {
    "use strict";

    var EventDispatcher = brackets.getModule("utils/EventDispatcher");

    var defaults = require('ide/chrome-remote-interface/defaults');
    var protocol = require('text!ide/chrome-remote-interface/protocol.json');
    protocol = JSON.parse(protocol);

    function Chrome(options) {
        var self = this;
        // options
        options = options || {};
        self.host = options.host || defaults.HOST;
        self.port = options.port || defaults.PORT;
        self.chooseTab = options.chooseTab || function () { return 0; };
        // locals
        self.callbacks = {};
        self.nextCommandId = 1;
        // operations
        addCommandShorthands.call(self);
        connectToChrome.call(self);

        EventDispatcher.makeEventDispatcher(this);
    };


    Chrome.listTabs = function (options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        options = options || {};
        options.host = options.host || defaults.HOST;
        options.port = options.port || defaults.PORT;

        var request = new XMLHttpRequest();
        request.open("GET", "http://" + options.host + ":" + options.port + "/json");

        request.onload = function onLoad() {
            var tabs = JSON.parse(''+request.response);
            callback(null, tabs);
        };
        request.onerror = function onError() {
            callback(request.response);
        };

        request.send(null);
    };

    Chrome.prototype.send = function (method, params, callback) {
        var self = this;
        var id = self.nextCommandId++;
        if (typeof params === 'function') {
            callback = params;
            params = undefined;
        }
        var message = {'id': id, 'method': method, 'params': params};
        self.ws.send(JSON.stringify(message));
        // register a command response callback or use a dummy callback to ensure
        // that the 'ready' event is correctly fired
        if (typeof callback === 'undefined') {
            callback = function () {};
        }
        self.callbacks[id] = callback;
    };

    Chrome.prototype.close = function () {
        var self = this;
        self.ws.removeAllListeners();
        self.ws.close();
    };

    function prepareHelp(type, object) {
        var help = {
            'type': type
        };
        for (var field in object) {
            help[field] = object[field];
        }
        return help;
    }

    function addCommand(domainName, command) {
        var self = this;
        self[domainName][command.name] = function (params, callback) {
            self.send(domainName + '.' + command.name, params, callback);
        };
        self[domainName][command.name].help = prepareHelp('command', command);
    }

    function addEvent(domainName, event) {
        var self = this;
        self[domainName][event.name] = function (handler) {
            self.on(domainName + '.' + event.name, handler);
        };
        self[domainName][event.name].help = prepareHelp('event', event);
    }

    function addType(domainName, type) {
        var self = this;
        self[domainName][type.id] = type;
    }

    function addCommandShorthands() {
        var self = this;
        for (var domainIdx in protocol.domains) {
            var domain = protocol.domains[domainIdx];
            var domainName = domain.domain;
            self[domainName] = {};
            // add commands
            var commands = domain.commands;
            if (commands) {
                for (var commandIdx in commands) {
                    var command = commands[commandIdx];
                    addCommand.call(self, domainName, command);
                }
            }
            // add events
            var events = domain.events;
            if (events) {
                for (var eventIdx in events) {
                    var event = events[eventIdx];
                    addEvent.call(self, domainName, event);
                }
            }
            // add types
            var types = domain.types;
            if (types) {
                for (var typeIdx in types) {
                    var type = types[typeIdx];
                    addType.call(self, domainName, type);
                }
            }
        }
    }

    function connectToChrome() {
        var self = this;
        var options = {'host': self.host, 'port': self.port};
        Chrome.listTabs(options, function (err, tabs) {
            if (err) {
                self.trigger('error', err);
            } else {
                var tabError;
                var tab = tabs[self.chooseTab(tabs)];
                if (tab) {
                    var tabDebuggerUrl = tab.webSocketDebuggerUrl;
                    if (tabDebuggerUrl) {
                        connectToWebSocket.call(self, tabDebuggerUrl);
                    } else {
                        // a WebSocket is already connected to this tab?
                        self.trigger('error', 'Tab does not support inspection');
                    }
                } else {
                    self.trigger('error', 'Invalid tab index');
                }
            }
        });
    }

    function connectToWebSocket(url) {
        var self = this;
        self.ws = new WebSocket(url);
        self.ws.onopen = function () {
            self.trigger('connect', self);
        };
        self.ws.onmessage = function (response) {
            var message = JSON.parse(response.data);
            // command response
            if (message.id) {
                var callback = self.callbacks[message.id];
                if (callback) {
                    if (message.result) {
                        callback(false, message.result);
                    } else if (message.error) {
                        callback(true, message.error);
                    }
                    // unregister command response callback
                    delete self.callbacks[message.id];
                    // notify when there are no more pending commands
                    if (Object.keys(self.callbacks).length === 0) {
                        self.trigger('ready');
                    }
                }
            }
            // event
            else if (message.method) {
                self.trigger('event', message);
                self.trigger(message.method, message.params);
            }
        };
        self.ws.onerror = function (err) {
            self.trigger('error', err);
        };
    }
    
    exports.Chrome = Chrome;
});