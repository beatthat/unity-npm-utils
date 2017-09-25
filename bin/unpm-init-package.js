#!/usr/bin/env node

console.log('...here we are in unity-init-package.js...')
const opts = require('commander');
const path = require('path');

const thisDir = __dirname;
const unpm = require(path.join(__dirname, '..', 'lib', 'unity-npm-utils.js'));

opts
  .option('-n, --package-name [name]', 'set the package name')
  .option('-p, --install-path [path]', 'set the install path for the package (default is cwd)')
  .option('-v, --verbose', 'log verbose info to console')
  .parse(process.argv);

const installPath = (opts.installPath && (String(opts.installPath).match(/^\/.*/)))?
    opts.installPath:
    path.join(process.cwd(), opts.installPath || '.');

console.log('unpm-init-package - installPath=%j', installPath);

const promise = new Promise((resolve, reject) => {
    unpm.unityPackage.installTemplate(installPath, {
        package_name: opts.packageName,
        verbose: opts.verbose
    }, (err) => {
        return err? reject(err): resolve(installPath);
    });
});

promise.then(pr => process.exit(0))
.catch(pe => {
    console.error(pe);
    process.exit(1);
});
