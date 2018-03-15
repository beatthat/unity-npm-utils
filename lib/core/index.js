

module.exports = {

    deepCopy: require('./deep-copy'),

    modCloneOrPull: require('../git/clone-or-pull-installed-package'),

    readPackage: require('./read-package'),
    readJson: require('./read-json'),

    setPackageVersion: require('./set-package-version'),
    transformJson: require('./transform-json'),
    transformPackage: require('./transform-package'),
}
