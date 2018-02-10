const pkg2UnityInstall = require('./pkg-2-unity-install')

/**
 * @deprecated use unpm.installPackageToUnity

 * Install a unity package from node_modules/${package_name}
 * to Assets/Plugins/[packages/][${scope}/]${package_name}.
 *
 * Typically, this is called from a postinstall script specified in the package
 *
 * @param {string} pkgRoot - the absolute path of the module root (where package.json lives)
 */
const installPlugin = (pkgRoot) => {

    console.error('unity-npm-utils::installPlugin is deprecated. Use installPackageToUnity instead');

    pkg2UnityInstall(pkgRoot, (err, info) => {
        if (err) {
            console.error('error installing package: %j', err);
            return;
        }

        console.log(`installed package to ${info.unity_install_path}`);

    });
}

module.exports = installPlugin
