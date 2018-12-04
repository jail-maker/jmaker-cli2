'use strict';

const net = require('net');
const uuid4 = require('uuid/v4');
const path = require('path');
const config = require('../app/config');
const runContainer = require('../app/run-container');
const ManifestFactory = require('../app/manifest-factory');
const zfs = require('../app/zfs');

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
        .demandOption(['name']);
}

module.exports.handler = async args => {

    let command = args._.slice(1).join(' ');

    let { from, name, entry } = args;
    let { tty, rm, nat } = args;
    let { mount, volume, env, rules } = args;

    let dataset = path.join(config.containersLocation, name);
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let rootFSPath = path.join(datasetPath, 'rootfs');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);

    console.log(manifest);

    entry = entry ? entry : manifest.entry;
    command = command ? command : manifest.command;

    env = env.reduce((acc, item) => {
        let [key, value] = item.split('=');
        acc[key] = value;
        return acc;
    } , {});

    env = Object.assign({}, manifest.env, env);

    rules = rules.reduce((acc, item) => {
        let [key, value] = item.split('=');
        acc[key] = value;
        return acc;
    } , {});

    rules = Object.assign({}, manifest.rules, rules);

    let mounts = mount.map(
        item => {

            let [ src, dst ] = item.split(':');
            if (!dst && src) dst = src;

            src = path.resolve(src);
            dst = path.resolve(dst);
            return {src, dst};

        }
    );

    let volumes = volume.map(
        item => {

            let [name, to] = item.split(':');
            return {name, to};

        }
    );

    let body = {
        name,
        path: datasetPath,
        rootfs: rootFSPath,
        workdir: manifest.workdir,
        command,
        entry,
        env,
        mounts,
        interface: "epair0b",
        rules,
    };

    console.log(body);

    let result = await runContainer.runContainer(body);

    console.log(result);

    if (tty) {

        let sockets = await runContainer.getTty({ name });
        console.log(sockets);

        let {input, output} = sockets;

        let socket_out = net.connect(output);
        let socket_in = net.connect(input);

        process.stdin.setRawMode(true);

        socket_out.on('end', _ => {
            console.log("output end");
            process.exit();
        })

        socket_out.on('end', _ => {
            console.log("input end");
            process.exit();
        })

        socket_out.on('data', data => {
            process.stdout.write(data);
        })

        process.stdin.on('data', data => {
            socket_in.write(data);
        })

    }

}
