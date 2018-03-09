const path = require('path')
const _infoForPkg = require('../core/_info-for-pkg')
const modCloneOrPull = require('../git/clone-or-pull-installed-package')
const modCloneLink = require('../git/link-package-2-clone')
const copyFromUnity2Pkg = require('../unity-project/copy-from-unity-2-pkg')

const copyUnity2LinkedClone = (unityRoot, pkgName, options, callback) => {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    options = options ? options : {};

    const promise = new Promise((resolve, reject) => {

        const pkgRoot = path.join(unityRoot, 'node_modules', pkgName);

        _infoForPkg(pkgRoot, options, (infoErr, info) => {
            if (infoErr) {
                return reject(infoErr);
            }

            if (options.verbose) {
                console.log(`copy unity to linked clone: unityroot=${unityRoot}, pkgPath=${pkgRoot}, options=${JSON.stringify(options)}`);
            }

            const pkg = info.package;

            modCloneOrPull(pkgRoot, options, (cloneErr) => {
                if (cloneErr) {
                    return reject(cloneErr);
                }

                if (options.verbose) {
                    console.log('clone succeeded...');
                    console.log('link clone to node_module %j with options', pkgRoot, options);
                }

                modCloneLink(pkgRoot, options, (linkErr) => {
                    if (linkErr) {
                        return reject(linkErr);
                    }

                    if (options.verbose) {
                        console.log('link succeeded...');
                        console.log('copy unity source to linked node_module with options %j', options);
                    }

                    copyFromUnity2Pkg(unityRoot, pkgName, options, (copyErr, copyInfo) => {
                        if (copyErr) {
                            return reject(copyErr);
                        }

                        console.log(`
===================================================================================================================
copy to linked clone succeeded
-----------------------------------------------------------------------------------------------------------------

commit changes at ${copyInfo.package_unity_src}

cd ${copyInfo.package_unity_src} && git add -A && git commit -m
===================================================================================================================
                            `);
                        return resolve();
                    });
                });
            });
        });
    });

    return (callback) ?
        promise.then(r => callback(null, r)).catch(e => callback(e)) : promise;
}

module.exports = copyUnity2LinkedClone
