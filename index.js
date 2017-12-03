(function () {
    var fs = require('fs'),
        Client = require('node-rest-client').Client,
        options = require('minimist')(process.argv.slice(2));
    if (!options.instance || !options.username || !options.password) {
        console.log("Please use the following command to use this node application:")
        console.log("node index.js --instance <instancename> --username <username> --password <password>")
        process.exit(1);
    }
    options_auth = {
            user: options.username,
            password: options.password
        }

    var client = new Client(options_auth);

    var requestsToMake = [
            {
                "table": "sys_script_include", 
                "filter" : "", 
                "extension" : ".js"
            },
            {
                "table": "sys_ui_script", 
                "filter" : "", 
                "extension" : ".js"
            },
            {
                "table": "sys_update_set", 
                "filter" : "", 
                "extension" : ".html"
            }
        ];
    for (var req in requestsToMake) {
        if (requestsToMake.hasOwnProperty(req)) {
            var current = requestsToMake[req];
            makeRequest(client, options.instance, current.table, current.filter, current.extension);
        }
    }
    //saveRemoteUpdateSet(options.update_set);

    /**
     * @description Main method - Makes HTTP Get Request to ServiceNow
     * @param  {string} scriptType A type of script in ServiceNow
     * @param  {string} include    A query to add to the HTTP Request
     * @param  {string} extension the file extension to give to the file
     */
    function makeRequest(client, instance, scriptTable, include, extension) {
        url = 'https://' + instance + '.service-now.com/api/now/table/' + scriptTable + '?sysparm_limit=1'
        client.get(url, function(data) {
                try {
                    var records = data.result;
                    for (var i = 0; i < records.length; i++) {
                        checkDirectory(records[i], scriptTable, extension);
                    }
                } catch (e) {
                    console.log('oops  -  ' + e)
                }
        });
    }

    /**
     * @description Getting an actual copy of remote update set requires the sys_id of the remote,
     * which we must retrieve by name, then feed into another function
     * @param  {string} name The name of the update set to retrieve
     */
    function saveRemoteUpdateSet(name) {
        request.get("https://" + options.instance + '.service-now.com/' +
            'sys_remote_update_set.do?JSON&sysparm_action=getRecords' + 
            '&sysparm_query=name=' + name,
            function(error, response, body) {
                try {
                    var data = JSON.parse(body);
                    var records = data.records;
                    for (var i = 0; i < records.length; i++) {
                        createRemoteUpdateSet(records[i].sys_id, name);
                    }
                } catch (e) {
                    console.log('Couldnt find remote update set for ' + name);
                }
            }).auth(options.username, options.password, false);
    }

    /**
     * @description Once the sys_id of the remote update is known, it can be read from export_update_set.do
     * @param  {string} sysId The sys_id of the update set
     * @param  {string} name  The name of the update set
     */
    function createRemoteUpdateSet(sysId, name) {
        request.get("http://" + options.instance + ".service-now.com/" +
            "export_update_set.do?sysparm_delete_when_done=false&sysparm_sys_id=" + sysId,
            function(error, response, body) {
                try {
                    var data = (body);                    
                    var directory = __dirname + "/sys_remote_update_set";
                    try {
                        var stats = fs.lstatSync(directory);
                        if (stats.isDirectory()){
                            fs.writeFile(directory + "/" + cleanName(name) + 
                                ".xml", data,
                                function(err) {
                                    if (err)
                                        return console.log(err);
                                });
                        }
                    } catch (e) {
                        fs.mkdirSync(directory);
                        fs.writeFile(directory + "/" + cleanName(name) + 
                            ".xml", data,
                                function(err) {
                                    if (err)
                                        return console.log(err);
                                });
                    }
                } catch (e) {
                    console.log("Problem retrieving update set");
                }
            }).auth(options.username, options.password, false);
    }

    /**
     * @description Checks to see if a directory exists; makes it if it does not
     * @param  {object} record     an object containing information from a GlideRecord about a script
     * @param  {string} scriptType the type of script in ServiceNow
     * @param  {string} extension the file extension to give to the file
     */
    function checkDirectory(record, scriptType, extension) {
        var directory = __dirname + "/" + scriptType;
        try {
            var stats = fs.lstatSync(directory);
            if (stats.isDirectory()){
                writeAFile(record, scriptType, extension);
            } 
        } catch (e) {
            fs.mkdirSync(__dirname + "/" + scriptType);
            writeAFile(record, scriptType, extension);
        }
    }

    /**
     * @description Creates a javascript file using what was in the ServiceNow instance
     * @param  {object} record     an object containing information from a GlideRecord about a script
     * @param  {string} scriptType the type of script in ServiceNow
     * @param  {string} extension the file extension to give to the file
     */
    function writeAFile(record, scriptType, extension) {
        var html,
            heading = "<!doctype html><html lang='en'><head><title>" + 
            "Update Information About : " + record.name +"</title><meta name='viewport' content='" + 
            "width=device-width, initial-scale=1'><link rel='stylesheet' type" +
            "='text/css' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/" + 
            "css/bootstrap.min.css'/></head><body><div class='container'>",
            footing = "</div><script src='https://maxcdn.bootstrapcdn.com/" + 
            "bootstrap/3.3.5/js/bootstrap.min.js'></script></body></html>";
        fs.writeFile(__dirname + "/" + scriptType + "/" + 
            cleanName(record.name) + extension, 
            (record.script || record.payload || html), function(err) {
            if (err) {
                return console.log(err);
            }
        });
    }

    /**
     * @description  Makes a valid filename by removing whitespace and special characters
     * @param  {string} name The name of a script in the system
     * @return {string}      The name without whitespace and special characters
     */
    function cleanName(name) {
        return name.replace(/\s\W/g, '');
    }
})();