
const expect = require('chai').expect;
const mlog = require('mocha-logger');

const promisify = require('es6-promisify');
const gitCredentialHelper = require('git-credential-helper');
const gchAvailable = promisify(gitCredentialHelper.available);
const gchFill = promisify(gitCredentialHelper.fill);


const h = require('../../test-helpers.js');
const unpm = require('../../../lib/unity-npm-utils');


describe.skip("credentialhelper", () => {
    var templatePkgPath = null;

    it("gets creds", function(done) {
        this.timeout(300000);

        gchAvailable()
        .then(a => {
            console.log('available=%j', a)
            return gchFill('https://github.com');
        })
        .then(creds => {
            console.log('creds=%j', creds)
            done();
        })
        .catch(e => done(e))

        // gitCredentialHelper.available(function (err, avdata) {
        //   // data will be true or false
        //   console.log('avail=%j', avdata);
        //
        //   gitCredentialHelper.fill('https://github.com', function (fillErr, fillData) {
        //           if(fillErr) {
        //               return done(fillErr);
        //           }
        //           console.log('fillData=%j', fillData);
        //
        //
        //         done();
        //       }, {
        //         silent: true
        //     });
        //
        // });
    });

});
