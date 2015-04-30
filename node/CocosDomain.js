(function () {
    "use strict";
    
    var os   = require("os");
    var exec = require('child_process').exec;
    var path = require('path');
    var net  = require('net');
    var DecompressZip = require("decompress-zip");

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

    function registerEnvironment(consoleDir) {
        process.env.COCOS_CONSOLE_ROOT = consoleDir;
        process.env.PATH += ":" + consoleDir;

        // var dirname = path.dirname(process.execPath);
        // console.log("dirname : " + dirname);
        
        // for(var i in process.env) {
        //     console.log("evn: %s, %s", i, process.env[i]);
        // }
    }

    function runCommand(cmd, options, callback) {
        if(typeof options === 'string') {
            options = options === "" ? {} : JSON.parse(options);
        }

        console.log("running command : " + cmd);

        var child = exec(cmd, options);
        onChildProcess(child, callback);

        return child;
    }

    function unzip(file, dest, callback) {
        var unzipper = new DecompressZip(file)

        unzipper.on('error', function (err) {
            console.log('Unzip caught an error : ', err);
        });

        unzipper.on('extract', function (log) {
            // console.log('Finished extracting');
            callback();
        });

        unzipper.on('progress', function (fileIndex, fileCount) {
            // console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
        });

        unzipper.extract({
            path: dest,
            filter: function (file) {
                return file.type !== "SymbolicLink";
            }
        });
    }

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }


    var _simulateProcess   = null;
    var _simulateConsoleClient = null;


    function simulate(cmd, options, callback) {
        if(endsWith(cmd, " Mac")) {
            cmd = cmd.replace(/\ /, '\\ ');
        }

        if(_simulateProcess) {
            console.log("kill process : " + _simulateProcess);
            _simulateProcess.kill();
        }

        if(_simulateConsoleClient) {
            _simulateConsoleClient.destroy();
            _simulateConsoleClient = null;
        }

        options = JSON.parse(options);

        _simulateProcess   = runCommand(cmd, options, callback);

        var port = options.port ? options.port : 6050;
        var host = options.host ? options.host : '127.0.0.1';


        function connectToConsole() {
            if(options.connectConsole) {
                _simulateConsoleClient = net.connect(port, host, function() {
                    console.log('Connect to: ' + host + ':' + port);
                    _simulateConsoleClient.write('sendrequest {"cmd":"start-logic"}\n');
                });


                _simulateConsoleClient.on('data', function(data) {
                    console.log('[%s : %s] : %s', host, port, data);
                });
            }
        }

        // If signal is null, then child_process is killed by itself, need set _simulateProcess to null.
        // If signal is "SIGTERM", then child_process is killed by parent.
        function onSimulateClose(code, signal) {
            if(!signal) {
                _simulateProcess = null;

                if(_simulateConsoleClient) {
                    _simulateConsoleClient.destroy();
                    _simulateConsoleClient = null;
                }
            }

            console.log('closing code: ' + code);
            callback();
        }

        function onSimulateData(data) {
            console.log('stdout: ' + data);

            if(data.indexOf('Console: listening on  0.0.0.0 : ' + port) !== -1) {
                connectToConsole();
            }
        }


        _simulateProcess.on("close",       onSimulateClose);
        _simulateProcess.stdout.on('data', onSimulateData);
        _simulateProcess.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
        });

    }

    function sendMessageToConsole(data) {
        if(_simulateConsoleClient) {
            var ret = _simulateConsoleClient.write(data);
            console.log("Send message to cocos console : %s. \nResult : %s", data, ret);
        } else {
            console.log('Cocos Console has not connected.');
        }
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

        domainManager.registerCommand(
            "cocos",    
            "sendMessageToConsole", 
            sendMessageToConsole,
            false,       
            "Returns result",
            ["cmd, options"],
            ["result"]
        );

        domainManager.registerCommand(
            "cocos",    
            "runCommand", 
            runCommand,
            true,       
            "Returns result",
            ["cmd, options"],
            ["result"]
        );

        domainManager.registerCommand(
            "cocos",    
            "unzip", 
            unzip,
            true,       
            "Returns result",
            ["file, dest"],
            ["result"]
        );
    }
    
    exports.init = init;
    
}());
