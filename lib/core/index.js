

module.exports = {

    copyFromUnity2Pkg: require('./copy-from-unity-2-pkg'),
    copyFromUnity2PkgRoot: require('./copy-from-unity-2-pkg-root'),
    deepCopy: require('./deep-copy'),

    incrementPackageVersion: require('./increment-package-version'),
    installPackageToUnity: require('./install-package-to-unity'),

    modCloneOrPull: require('../git/clone-or-pull-installed-package'),
    modCloneLink: require('../git/link-package-2-clone'),

    readPackage: require('./read-package'),
    readUnpmLocal: require('./read-unpm-local'),

    setPackageVersion: require('./set-package-version'),
    transformPackage: require('./transform-package'),

    writePackageInfoToUnpmLocal: require('./write-package-info-to-unpm-local'),





    copyUnity2LinkedClone: require('../deprecated/copy-unity-2-linked-clone'),
    syncPlugin2Src: require('../deprecated/sync-plugin-2-src'),
    pkg2UnityInstall: require('../deprecated/pkg-2-unity-install'),
    installPlugin: require('../deprecated/install-plugin')
}
