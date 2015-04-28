(function () {
    "use strict";
    
    var os   = require("os");
    var exec = require('child_process').exec;
    var path = require('path');


    function onChildProcess(child, callback) {
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
     * @private
     * Handler function for the cocos.newProject command.
     * @param {boolean} total If true, return total memory; if false, return free memory only.
     * @return {number} The amount of memory.
     */
    function cmdNewProject(projectName, folder, callback) {
        var child = exec("cocos new " + projectName + " -l js -d " + folder);
        onChildProcess(child, callback);
    }


    function simulate(projectDir, platform, callback) {
        var child = exec("cocos run -p " + platform, {
            cwd: projectDir
        });
        onChildProcess(child, callback);
    }

    function registerEnvironment(consoleDir) {
        process.env.COCOS_CONSOLE_ROOT = consoleDir;
        process.env.PATH += ":" + consoleDir;

        // var dirname = path.dirname(process.execPath);
        // console.log("dirname : " + dirname);
        
        // for(var i in process.env) {
        //     console.log("evn: %s, %s", i, process.env[i]);
        // }
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

        domainManager.registerCommand(
            "cocos",               // domain name
            "registerEnvironment", // command name
            registerEnvironment,   // command handler function
            false,                 // whether this command is synchronous in Node
            "Returns result",
            ["consoleDir"],
            ["result"]
        );

        domainManager.registerCommand(
            "cocos",    
            "simulate", 
            simulate,   
            true,       
            "Returns result",
            ["projectDir, platform"],
            ["result"]
        );
    }
    
    exports.init = init;
    
}());
