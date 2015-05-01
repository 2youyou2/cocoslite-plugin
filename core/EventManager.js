define(function (require, exports, module) {
    "use strict";

    var EventDispatcher = brackets.getModule("utils/EventDispatcher");
    EventDispatcher.makeEventDispatcher(exports);

    // Cocos
    exports.GAME_START                  = "game_start";
    exports.COCOS_LOADED                = "cocos_loaded";


    // SceneEditor
    exports.SCENE_LOADED                = "scene_loaded";
    exports.SCENE_CLOSED                = "scene_closed";
    exports.SCENE_BEFORE_PLAYING        = "scene_play_before";
    exports.SCENE_BEGIN_PLAYING         = "scene_play_begin";
    exports.SCENE_END_PLAYING           = "scene_play_end";
    exports.SCENE_SWITCH_STATE          = "scene_switch_state";

    // Selector
    exports.SELECT_OBJECTS              = "select_objects";

    // Project
    exports.PROJECT_OPEN                = "project_open";
    exports.PROJECT_CLOSE               = "project_close";

    // ObjectManager
    exports.OBJECT_PROPERTY_CHANGED     = "object_property_changed";
    exports.OBJECT_ADDED                = "object_added";
    exports.OBJECT_REMOVED              = "object_removed";
    exports.COMPONENT_ADDED             = "component_added";
    exports.COMPONENT_REMOVED           = "component_removed";

    // GameEditor
    exports.IDE_FOCUS                   = "ide_focus";

    // ComponentManager
    exports.NEW_EMPTY_COMPONENT         = "new_empty_component";

    // Control2D
    exports.CONTROL_STATE_CHANGED       = "control_state_changed";
});
