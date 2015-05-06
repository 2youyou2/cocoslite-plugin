/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, window, cc, cl, setInterval*/

define(function (require, exports, module) {
    "use strict";

    var ProjectModel           = brackets.getModule("project/ProjectModel"),
        ProjectManager         = brackets.getModule("project/ProjectManager"),
        PreferencesManager     = brackets.getModule("preferences/PreferencesManager"),
        Directory              = brackets.getModule("filesystem/Directory");

        
    function _hackPreferencesManager() {
        var PREFS_NAME          = "mainView.state";

        var originSetViewState = PreferencesManager.setViewState;
        PreferencesManager.setViewState = function() {
            if(arguments[0] === PREFS_NAME) {
                arguments[0] = PREFS_NAME + "." + cl.editorType;
            }
            originSetViewState.apply(this, arguments);
        }

        var originGetViewState = PreferencesManager.getViewState;
        PreferencesManager.getViewState = function() {
            if(arguments[0] === PREFS_NAME) {
                arguments[0] = PREFS_NAME + "." + cl.editorType;
            }
            return originGetViewState.apply(this, arguments);
        }
    }

    /** 
     * Currently project only show res, src, rintime folder
     * To prevent load too many files to project
     * @private
     */
    function _hackProjectModel() {
        ProjectModel._shouldShowName = function(name, path) {

            var rootPath = ProjectManager.getProjectRoot().fullPath;
            var relativePath = path.replace(rootPath, "");

            var show = true;
            // if(cl.editorType === cl.EditorType.GameEditor) {
            //     show = !name.match(ProjectModel._exclusionListRegEx) &&
            //            (relativePath.indexOf('res') === 0 ||
            //            name === '.cocos-project.json');
            // } else if(cl.editorType === cl.EditorType.IDE) {
                show = !name.match(ProjectModel._exclusionListRegEx) &&
                       relativePath.indexOf('res') === 0 ||
                       relativePath.indexOf('src') === 0 ||
                       relativePath.indexOf('runtime') === 0 ||
                       relativePath === 'main.js' ||
                       name === 'project.json' ||
                       name === '.cocos-project.json';
            // }

            return show;
        }
    }

    function _applyAllCallbacks(callbacks, args) {
        if (callbacks.length > 0) {
            var callback = callbacks.pop();
            try {
                callback.apply(undefined, args);
            } finally {
                _applyAllCallbacks(callbacks, args);
            }
        }
    }


    /** 
     * There is another API Directory.prototype.getContents
     *  getContents will apply the _shouldShowName filter
     *  so it can't get contents in other folder
     * Add an extension API to allow get files outside project folders 
     */
    Directory.prototype.getAllContents = function (callback) {
        if (this._allContentsCallbacks) {
            // There is already a pending call for this directory's contents.
            // Push the new callback onto the stack and return.
            this._allContentsCallbacks.push(callback);
            return;
        }
        
        this._allContentsCallbacks = [callback];
        
        this._impl.readdir(this.fullPath, function (err, names, stats) {
            var contents = [],
                contentsStats = [],
                contentsStatsErrors;
            
            if (err) {
                this._clearCachedData();
            } else {
                // Use the "relaxed" parameter to _isWatched because it's OK to
                // cache data even while watchers are still starting up
                var watched = this._isWatched(true);
                
                names.forEach(function (name, index) {
                    var entryPath = this.fullPath + name;
                    
                    var entryStats = stats[index],
                        entry;
                    
                    // Note: not all entries necessarily have associated stats.
                    if (typeof entryStats === "string") {
                        // entryStats is an error string
                        if (contentsStatsErrors === undefined) {
                            contentsStatsErrors = {};
                        }
                        contentsStatsErrors[entryPath] = entryStats;
                    } else {
                        // entryStats is a FileSystemStats object
                        if (entryStats.isFile) {
                            entry = this._fileSystem.getFileForPath(entryPath);
                        } else {
                            entry = this._fileSystem.getDirectoryForPath(entryPath);
                        }
                        
                        if (watched) {
                            entry._stat = entryStats;
                        }
                        
                        contents.push(entry);
                        contentsStats.push(entryStats);
                    }
                }, this);
            }
            
            // Reset the callback list before we begin calling back so that
            // synchronous reentrant calls are handled correctly.
            var currentCallbacks = this._allContentsCallbacks;
            
            this._allContentsCallbacks = null;
            
            // Invoke all saved callbacks
            var callbackArgs = [err, contents, contentsStats, contentsStatsErrors];
            _applyAllCallbacks(currentCallbacks, callbackArgs);
        }.bind(this));
    };

    _hackPreferencesManager();
    _hackProjectModel();

});