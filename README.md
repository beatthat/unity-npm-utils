# Unity NPM Utils

**Unity NPM Utils helps you create, integrate, and share interdependent Unity packages**

The Unity Asset Store is a great resource but as a package manager, it has limitations. Notably, it provides no mechanism for one package to declare dependencies on another.

A practical effect of this is that the Unity ecosystem doesn't create and share small, single-task focused, interdependent code modules the way other language/platform communities do, and so the Unity community misses out on that engine of innovation and progress.

unity-npm-utils leverages the mature and powerful Node JS package manager, npm, as a basis to provide Unity-friendly tools for creating, integrating, editing and sharing Unity packages.

## Dependencies

Requires npm

## Usage

### Installing packages to a unity project

#### Your unity project needs a package.json

First things first: we're using npm here, so your unity project needs a package.json. If you don't yet have a package.json in your unity project, you can use npm init

`cd [your unity project root] && npm init`

#### Use `npm install` to install existing (unpm-enabled) packages

...so now that your unity project has a package.json file at its root, if you want to install a unity package that's been set up for with unity-npm-utils, you can just use the normal npm install command. For example, to install [beatthat/properties](https://github.com/beatthat/properties):

```
npm install --save beatthat/properties
```

Once that completes, notice that an Assets folder has been created. Open the project in Unity (or review it in a Finder/Explorer) and there should now be a `Plugins/packages/ape` directory. Under that directory, you will see not only the [properties](https://github.com/beatthat/properties) package that you just installed but also various other packages which are the (recursive) dependencies of the properties package.

What makes each package install to a folder under Assets/Plugins is a `postinstall` script. Unlike an npm javascript package installed to node_modules, the code package installed to your unity project is a copy intended for you to commit. If you only want to install packages that already exist using unity-npm-utils, then this is all you need to know!

### Create your own unity package

If you want to create your unity package that can install via npm (and leverage dependency support), then `unpm` can help.

#### Set up a unpm-enabled package from clean slate

Create a new directory with the same you want to give your package and then execute the following shell command:

```
npm init --force && \
npm install --save beatthat/unity-npm-utils && \
node ./node_modules/unity-npm-utils/bin/unpm upt -v
```

When the commands above complete, your package.json should have some scripts and directories should be set up for source and tests. There is a placeholder text file under `src/${your-package-name}` so you can test the unity-install process right away as follows:

```
npm run install:test
```

Your package should now be installed to the (unity project) under `./test`. Open up the test folder in Unity and find that placeholder text file under Plugins.

Once you see the placeholder source file installed. Close unity, go back to your source directory and add you real (C#) source files (you can delete the placeholder text file.)

When you're done run `npm run install:test` and check the install by opening the test directory in Unity again. Why do we keep testing the install and opening it in Unity? Because that's the easiest way to see if our source code and package setup are valid, specifically we need to check if our source code has any dependencies (on other unity packages) that weren't specified. If that turns out to be the case, you'll have to include that dependency in package.json (e.g. `npm install --save [whatever package we're missing]`)

## How to test the software

If the software includes automated tests, detail how to run those tests.

## Known issues

Document any known significant shortcomings with the software.

## Getting help

Instruct users how to get help with this software; this might include links to an issue tracker, wiki, mailing list, etc.

**Example**

If you have questions, concerns, bug reports, etc, please file an issue in this repository's Issue Tracker.

## Getting involved

This section should detail why people should get involved and describe key areas you are currently focusing on; e.g., trying to get feedback on features, fixing certain bugs, building important pieces, etc.

General instructions on _how_ to contribute should be stated with a link to [CONTRIBUTING](CONTRIBUTING.md).

--------------------------------------------------------------------------------

## Open source licensing info

1. [TERMS](TERMS.md)
2. <LICENSE>
3. [CFPB Source Code Policy](https://github.com/cfpb/source-code-policy/)

--------------------------------------------------------------------------------

## Credits and references

1. Projects that inspired you
2. Related projects
3. Books, papers, talks, or other sources that have meaningful impact or influence on this project
