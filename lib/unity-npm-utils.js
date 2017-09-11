"use strict"
var fs = require('fs');



function convertThis() {
    if (process.argv.length > 2) {
        var myfile = process.argv[2];

        if (fs.existsSync(myfile)) {
            var content = fs.readFileSync(myfile, 'utf8');
            fs.writeFileSync(myfile, content.toUpperCase());
            console.log("Done");
        } else {
            console.log("File does not exist - " + myfile);
        }
    } else {
        console.log("Pass on a file name/path");
    }
}


const mkdirp = require('mkdirp');
const path = require('path');
const ncp = require('ncp');

const installPlugin = function(moduleRoot, pluginName, srcPkg) {

    // by default expects a 'src' folder at the root of the package
    // whose contents will be copied to the target dir in Assets/Plugins
    srcPkg = srcPkg ? srcPkg : "src";

    // by default expects the package.json to have a 'scope' property
    // and that will be the target folder, e.g. Assets/Plugins/$scope
    pluginName = pluginName ? pluginName : process.env.npm_package_scope;

    const src = path.join(moduleRoot, srcPkg);

    // expecting the module root will be as $unityProject/node_modules/$thisModule...
    const tgt = path.join(moduleRoot, '..', '..', 'Assets', 'Plugins', pluginName);

    const ismodule = moduleRoot.split(path.sep).filter(function(i) {
        return i == 'node_modules';
    }).length > 0;

    // if we're not under node_modules, don't install
    if (!ismodule) {
        return false;
    }

    mkdirp(tgt, function(err) {
        if (err) {
            console.error(err)
            process.exit(1);
        }

        // Copy files
        ncp(src, tgt, function(err) {
            if (err) {
                console.error(err);
                process.exit(1);
            }
        });
    });
    return true;
}

exports.convert = convertThis;
exports.installPlugin = installPlugin;
