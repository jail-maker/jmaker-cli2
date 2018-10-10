'use strict';

const uuid4 = require('uuid/v4');
const path = require('path');
const prequest = require('request-promise-native');
const TTYClient = require('../tty-client');

module.exports.desc = 'command for launch the container';

module.exports.builder = yargs => {

    return yargs
        .option('r', {
            alias: 'rules',
            type: 'array',
            default: [],
            describe: 'runtime rules for container.'
        })
        .option('tty', {
            type: 'boolean',
            default: false,
        })
        .option('from', {
            type: 'string',
            describe: 'name of base container.'
        })
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'set name for new container.'
        })
        .option('e', {
            alias: 'env',
            type: 'array',
            default: [],
            describe: 'set environment variable.'
        })
        .option('rm', {
            type: 'boolean',
            describe: 'remove container after run.'
        })
        .option('m', {
            alias: 'mount',
            type: 'array',
            default: [],
            describe: 'mount host folder in container.\n Example: ./:/mnt/my-folder'
        })
        .option('vol', {
            alias: 'volume',
            type: 'array',
            default: [],
            describe: 'mount volume in container.\n Example: my-volume:/mnt/volume'
        })
        .option('nat', {
            type: 'boolean',
            default: false,
            describe: 'getting ip via local network agent.',
        })
        .option('entry', {
            type: 'string',
            default: null,
            describe: 'override entry command.',
        })
        .demandOption(['from']);
}

module.exports.handler = async args => {

    let command = args._.slice(1).join(' ');

    let { from, name, entry } = args;
    let { tty, rm, nat } = args;
    let { mount, volume, env, rules } = args;

    tty = tty ? uuid4() : null;

    env = env.reduce((acc, item) => {
        let [key, value] = item.split('=');
        acc[key] = value;
        return acc;
    } , {});

    rules = rules.reduce((acc, item) => {
        let [key, value] = item.split('=');
        acc[key] = value;
        return acc;
    } , {});

    let mounts = mount.map(
        item => {

            let [ src, dest ] = item.split(':');
            if (!dest && src) dest = src;

            src = path.resolve(src);
            dest = path.resolve(dest);
            return {src, dest};

        }
    );

    let volumes = volume.map(
        item => {

            let [name, to] = item.split(':');
            return {name, to};

        }
    );

    let body = {
        from,
        name,
        rm,
        tty,
        nat,
        entry,
        command,
        rules,
        env,
        mounts,
        volumes,
    }

    console.log(body)

    let endpoint = 'http://127.0.0.1:3346/containers/started';
    let response = await prequest.post(endpoint, {
        body,
        json: true,
    });

    if (tty) {

        process.stdin.setRawMode(true);
        tty = await TTYClient.factory(tty);

        tty.on('data', async chunk => await process.stdout.write(chunk));
        process.stdin.on('data', async chunk => await tty.write(chunk));
        process.stdout.on('resize', async _ => {

            let event = {
                name: 'resize',
                data: {
                    columns: process.stdout.columns,
                    rows: process.stdout.rows,
                }
            }

            await tty.sendEvent(event);

        });

        tty.on('server-close-connection', async _ => {

            await tty.destructor();
            process.exit();

        });

        tty.on('exit', async event => {

            await tty.destructor();
            process.exit(event.data.code);

        });

    }

}
