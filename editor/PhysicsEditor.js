/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, cc, cl*/

define(function (require, exports, module) {
    "use strict";

    var EventManager = require("core/EventManager");

    var _playing = false;

    function handleSceneLoaded(event, scene) {
        cl.space.gravity = cp.v(0, 0);
    }

    function handleCocosLoaded() {
        var originSetSensor = cp.Shape.prototype.setSensor;
        cp.Shape.prototype.setSensor = function(sensor) {
            if(_playing) {
                originSetSensor.apply(this, arguments);
            }
        };

        cp.Shape.prototype.init = function() {
            if(!_playing) {
                _playing = true;
                this.setSensor(true);
                _playing = false;
            }
        }
    }

    function handleBeforePlaying() {
        _playing = true;
    }

    function handleEndPlaying() {
        _playing = false;
    }

    EventManager.on(EventManager.SCENE_LOADED,          handleSceneLoaded);
    EventManager.on(EventManager.COCOS_LOADED,          handleCocosLoaded);
    EventManager.on(EventManager.SCENE_BEFORE_PLAYING,  handleBeforePlaying);
    EventManager.on(EventManager.SCENE_END_PLAYING,     handleEndPlaying);

});