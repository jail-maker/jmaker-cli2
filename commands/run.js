'use strict';

const net = require('net');
const fs = require('fs');
const uuid4 = require('uuid/v4');
const path = require('path');
const { ensureDir, copy, pathExists } = require('fs-extra');
const config = require('../app/config');
const runContainer = require('../app/run-container');
const ManifestFactory = require('../app/manifest-factory');
const zfs = require('../app/zfs');
const foldersSync = require('../app/folders-sync');

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
        async item => {

            let [ src, dst ] = item.split(':');
            if (!dst && src) dst = src;

            src = path.resolve(src);
            dst = path.resolve(dst);
            let mountPath = path.join(rootFSPath, dst);

            await ensureDir(mountPath);

            if (!(await pathExists(src))) {

                await foldersSync(path.join(mountPath, '/'), path.join(src, '/'));

            }

            return {src, dst};

        }
    );

    mounts = await Promise.all(mounts);

    let volumes = volume.map(
        item => {

            let [name, to] = item.split(':');
            return {name, to};

        }
    );

    volumes = manifest.volumes.concat(volumes);
    volumes = volumes.map(async item => {

        let {name, to} = item;

        to = path.resolve(to);
        let mountPath = path.join(rootFSPath, to);

        await ensureDir(mountPath);

        let volumeDataset = path.join(config.volumesLocation, name);

        if (!zfs.has(volumeDataset)) {

            zfs.ensureDataset(volumeDataset);
            let src = zfs.get(volumeDataset, 'mountpoint');
            await foldersSync(path.join(mountPath, '/'), path.join(src, '/'));

        }

        let from = zfs.get(volumeDataset, 'mountpoint');
        let {uid, gid} = fs.statSync(mountPath);

        fs.chownSync(from, uid, gid);

        return { src: from, dst: mountPath };

    });

    volumes = await Promise.all(volumes);
    mounts = volumes.concat(mounts);

    let body = {
        name,
        path: datasetPath,
        rootfs: rootFSPath,
        workdir: manifest.workdir,
        command,
        entry,
        env,
        mounts,
        // interface: "epair0b",
        rules,
    };

    console.log(body);

    (async _ => {

        try {
            let result = await runContainer.waitContainer({ name });
        } catch (error) {
            console.log(error);
        } finally {
            process.exit();
        }

    })();

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
            socket_in.end();
        })

        socket_in.on('end', _ => {
            console.log("input end");
            socket_out.end();
        })

        socket_out.on('data', data => {
            process.stdout.write(data);
        })

        process.stdin.on('data', data => {
            socket_in.write(data);
        })


    }

}
