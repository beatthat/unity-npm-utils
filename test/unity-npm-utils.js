const unpm = require('../lib/unity-npm-utils');
const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');

describe("Unity NPM Utils", () => {

    describe("Unity Package", () => {

        describe("Install", () => {
            it("creates package json", function(done) {
                this.timeout(10000);


                tmp.dir((tmpDirErr, tmpDir, tmpDirCleanup) => {
                    // TODO: how do you get exec 'after' in mocha to tmpDirCleanup()?

                    const installPath = path.join(tmpDir, 'unpm-testpackage');

                    unpm.unityPackage.install(installPath, {}, (err) => {

                        console.log('install returned!');

                        if(err) {
                            return done(new Error(err));
                        }

                        const packageJsonPath = path.join(installPath, 'package.json');

                        expect(fs.existsSync(packageJsonPath),
                            `package.json should exist in install path ${installPath}`).to.equal(true);


                        return done();
                    });
                });

            });
        });
    });

});
