(function () {
    "use strict";
    
    var os = require("os");
    var exec = require('child_process').exec;


    /**
     * @private
     * Handler function for the cocos.newProject command.
     * @param {boolean} total If true, return total memory; if false, return free memory only.
     * @return {number} The amount of memory.
     */
    function cmdNewProject(projectName, folder, callback) {
        var dirname = path.dirname(process.execPath);
        
        var child = exec("/Users/youyou/Desktop/workspace/brackets/src/extensions/default/CocosLite/cocos2d-js/tools/cocos2d-console/bin/cocos new " + projectName + " -l js -d " + folder);

        child.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });
        child.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
        });
        child.on('close', function(code) {
            console.log('closing code: ' + code);
            callback();
        });
    }

    /**
     * Initializes the test domain with several test commands.
     * @param {DomainManager} domainManager The DomainManager for the server
     */
    function init(domainManager) {
        if (!domainManager.hasDomain("cocos")) {
            domainManager.registerDomain("cocos", {major: 0, minor: 1});
        }
        
        domainManager.registerCommand(
            "cocos",         // domain name
            "newProject",    // command name
            cmdNewProject,   // command handler function
            true,            // whether this command is synchronous in Node
            "Returns result",
            ["projectName", "folder"],
            ["result"]
        );

    }
    
    exports.init = init;
    
}());
