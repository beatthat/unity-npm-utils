

module.exports = {

    deepCopy: require('./deep-copy'),

    incrementPackageVersion: require('./increment-package-version'),

    modCloneOrPull: require('../git/clone-or-pull-installed-package'),
    modCloneLink: require('../git/link-package-2-clone'),

    readPackage: require('./read-package'),

    setPackageVersion: require('./set-package-version'),
    transformPackage: require('./transform-package'),

    copyUnity2LinkedClone: require('../deprecated/copy-unity-2-linked-clone'),
    syncPlugin2Src: require('../deprecated/sync-plugin-2-src'),
    pkg2UnityInstall: require('../deprecated/pkg-2-unity-install'),
    installPlugin: require('../deprecated/install-plugin')
}
