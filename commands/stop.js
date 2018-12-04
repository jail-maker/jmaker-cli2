'use strict';

const runContainer = require('../app/run-container');

module.exports.command = 'stop <name>';

module.exports.desc = 'command for stop the container';

module.exports.builder = yargs => {

    return yargs
        .positional('name', {
            describe: 'name of the container',
            type: 'string',
        })

}

module.exports.handler = async args => {

    let container = args.name;

    await runContainer.stopContainer({ name: container });

}
