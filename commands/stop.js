'use strict';

const prequest = require('request-promise-native');

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
    let endpoint = `http://127.0.0.1:3346/containers/started/${container}`;

    try {

        await prequest.delete(endpoint);
        console.log(`container "${container}" stoped.`);

    } catch (error) { 

        if (error.statusCode === 404)
            console.error(`container "${container}" not found.`);

        else throw error;

        process.exit(1);

    }

}
