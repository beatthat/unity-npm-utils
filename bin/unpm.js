#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const path = require('path');

const thisDir = __dirname;
const unpm = require(path.join(__dirname, '..', 'lib', 'unity-npm-utils.js'));

const optionsDefs = [
    { name: 'cmd', type: String, multiple: false, defaultOption: true },
    { name: 'path', alias: 'p', type: String, default: '.' },
    { name: 'package_name', alias: 'n', type: String },
    { name: 'verbose', alias: 'v', type: Boolean }
];

const options = commandLineArgs(optionsDefs);

const installPath = (options.path && options.path.match(/^\/.*/))?
    options.path:
    path.join(process.cwd(), options.path || '.');

const promise = new Promise((resolve, reject) => {
    unpm.unityPackage.installTemplate(installPath, {}, (err) => {

        if (err) {
            return reject(new Error(err));
        }

        if (!options.package_name) {
            return resolve(installPath);
        }

        unpm.unityPackage.setPackageName(installPath, {
                package_name: options.package_name,
                verbose: false
            },
            (setNameErr) => {
                if (setNameErr) {
                    return reject(setNameErr);
                }
                return resolve(installPath);
            });
    });
});

promise.then(pr => process.exit(0))
.catch(pe => {
    console.error(pe);
    process.exit(1);
});
