define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager"),
        Menus          = brackets.getModule("command/Menus");


        objectMenu = Menus.addMenu("GameObject", "cl.GameObject");
        objectMenu.addMenuItem("cl.GameObject.CreateEmpty");

        componentMenu = Menus.addMenu("Component", "cl.Component");

        
});