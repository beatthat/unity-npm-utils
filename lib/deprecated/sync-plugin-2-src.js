const fs = require('fs-extra-promise')
const _infoForPkg = require('../core/_info-for-pkg')
const copyFromUnity2PkgRoot = require('../core/copy-from-unity-2-pkg-root')

/**
 * @deprecated use @see copyFromUnity2PkgRoot
 * Sync package from its installed (Unity) directory back to the package src folder.
 *
 * This is to support a workflow where a plugin can install to a unity 'test' directory,
 * the plugin source can be editted there using Unity,
 * and then the source changes can be synced back to the plugin source to commit.
 *
 * It would be easier to define this in package.json as a 'script' that uses rsync,
 * but that would only on *nix systems and not work on Windows.
 *
 * @param {string} unityProjectRoot - abs path of the unity project we are syncing *from*
 *
 * @param {string} pkgTgtRoot - abs path of the root (where package.json lives)
 *      of the module we are syncing *to*
 *
 * @param {string} options.package_scope - the scope the package
 *      that will be copied back from under Assets/Plugins,
 *      so the actual package path is (unity)/Assets/Plugins/$scope/$package_name.
 *      If nothing passed, takes the value from package.json 'scope' property.
 *
 * @param {string} options.package_name - the name of the package
 *      that will be copied back from under Assets/Plugins,
 *      so the actual package path is (unity)/Assets/Plugins/$scope/$package_name.
 *      If nothing passed, takes the value from package.json 'name' property.
 *
 * @param {string} options.src_path - name (or rel path)
 *      of the folder within the package that contains the pkg source for unity.
 *      If nothing passed, defaults to 'src'.
 *
 * @param {function(src,dest)} options.filter - filter function used in the copy.
 *      Default filters .meta files
 *
 * @param {bool} options.overwrite - if TRUE, deletes the existing contents
 *      of target src before syncing.
 *      Use this option, for example, if you're changing the names of files in Unity.
 *
 *      Default is FALSE.
 */
const syncPlugin2Src = (unityProjectRoot, pkgTgtRoot, options) => {
    console.error('unity-npm-utils::syncPlugin2Src is deprecated. Use copyFromUnity2PkgRoot instead')

    copyFromUnity2PkgRoot(unityProjectRoot, pkgTgtRoot, options, (err, info) => {
        if (err) {
            console.error("syncPlugin2Src error %j", err)
            return;
        }

        console.log('syncPlugin2Src succeedded')
    });
}

module.exports = syncPlugin2Src
