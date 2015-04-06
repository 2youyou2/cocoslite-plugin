/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define*/

define(function (require, exports, module) {
    "use strict";

    var ProjectManager   = brackets.getModule("project/ProjectManager"),
        Menus            = brackets.getModule("command/Menus"),
        Commands         = brackets.getModule("command/Commands"),
    	CommandManager   = brackets.getModule("command/CommandManager");

    var ide = null;
    var scriptChanged = false;

    function openIDE () {
        if(!ide) {
            ide = window.open(window.location.href+"?editorType=IDE");

            ide.onbeforeunload = function() {
                ide = null;
            }
        }
        ide.focus();
    }

    function handleComponentChanged(e, fullPath) {
        try{
            var component = require(fullPath);
            if(!component) { return; }

            var constructor = component.Constructor;
            var prototype   = constructor.prototype;
            var _super      = prototype.__proto__;
            var prop        = new component.Params;
            var releaseMode = cc.game.config[cc.game.CONFIG_KEY.classReleaseMode];

            var fnTest = /\b_super\b/;
            var desc = { writable: true, enumerable: false, configurable: true };

            for (var name in prop) {
                var isFunc = (typeof prop[name] === "function");
                var override = (typeof _super[name] === "function");
                var hasSuperCall = fnTest.test(prop[name]);

                if (releaseMode && isFunc && override && hasSuperCall) {
                    desc.value = ClassManager.compileSuper(prop[name], name, classId);
                    Object.defineProperty(prototype, name, desc);
                } else if (isFunc && override && hasSuperCall) {
                    desc.value = (function (name, fn) {
                        return function () {
                            var tmp = this._super;

                            // Add a new ._super() method that is the same method
                            // but on the super-Class
                            this._super = _super[name];

                            // The method only need to be bound temporarily, so we
                            // remove it when we're done executing
                            var ret = fn.apply(this, arguments);
                            this._super = tmp;

                            return ret;
                        };
                    })(name, prop[name]);
                    Object.defineProperty(prototype, name, desc);
                } else if (isFunc) {
                    desc.value = prop[name];
                    Object.defineProperty(prototype, name, desc);
                } else {
                    prototype[name] = prop[name];
                }

                if (isFunc) {
                    // Override registered getter/setter
                    var getter, setter, propertyName;
                    if (constructor.__getters__ && constructor.__getters__[name]) {
                        propertyName = constructor.__getters__[name];
                        for (var i in constructor.__setters__) {
                            if (constructor.__setters__[i] == propertyName) {
                                setter = i;
                                break;
                            }
                        }
                        cc.defineGetterSetter(prototype, propertyName, prop[name], prop[setter] ? prop[setter] : prototype[setter], name, setter);
                    }
                    if (constructor.__setters__ && constructor.__setters__[name]) {
                        propertyName = constructor.__setters__[name];
                        for (var i in constructor.__getters__) {
                            if (constructor.__getters__[i] == propertyName) {
                                getter = i;
                                break;
                            }
                        }
                        cc.defineGetterSetter(prototype, propertyName, prop[getter] ? prop[getter] : prototype[getter], prop[name], getter, name);
                    }
                }
            }

        }
        catch(e) {
            console.log(e);
        }
    }

    function handleEditorChanged(fullPath) {

    }

    function handleBeforeScriptChanged() {
        scriptChanged = true;
    }

    function handleScriptChanged(e, fullPath, scriptErr) {
        scriptChanged = false;

        if(scriptErr) { return; }

        // if(fullPath.indexOf("//Editor//") === -1) {
            handleComponentChanged(e, fullPath);
        // } else {
        //     handleEditorChanged(fullPath);
        // }
    }


    function handleOpenScript(fullPath) {
    	if(!ide) {

            openIDE();

            ide.initIDE = function(module) {
                ide = module;
                ide.openFile(fullPath);

                ide.on("beforeScriptChanged", handleBeforeScriptChanged);
                ide.on("scriptChanged", handleScriptChanged);
            };

    	} else {
            ide.openFile(fullPath);
        }
    }

    function handleWindowClose() {
        ide.close();
        ide = null;
    }

    function hackGameObject() {

        var originUpdate = cl.GameObject.prototype.update;
        cl.GameObject.prototype.update = function(dt) {
            if(scriptChanged) { return; }

            try{
                originUpdate.call(this, dt);
            }
            catch(e){
                console.log("[GameObject.update]"+e);
            }
        }

    }

    function registerMenus() {
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuItem(Commands.CMD_OPEN_IDE);
        menu.addMenuDivider();
    }

    CommandManager.register("OpenScript", Commands.CMD_OPEN_SCRIPT, handleOpenScript);
    CommandManager.register("IDE", Commands.CMD_OPEN_IDE, openIDE);

    ProjectManager.on("projectOpen", hackGameObject),

    registerMenus();

    window.onbeforeunload = handleWindowClose;
});