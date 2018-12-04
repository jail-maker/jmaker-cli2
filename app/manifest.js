'use strict';

const fs = require('fs');

class Manifest {

    constructor() {

        this.version = '0.0.2';
        this.name = '';
        this.from = null;
        this.workdir = '/';
        this.rlimits = {};
        this.cpus = '';
        this.cpuset = '';
        this.entry = '';
        this.command = '';
        this.service = {};
        this.services = {};
        this.building = [];
        this.quota = '';
        this.env = {};
        this.volumes = [];
        this['resolv-sync'] = true;
        this.rules = {
            'allow.raw_sockets': true,
            'allow.socket_af': true,
            'allow.sysvipc': true,
            'host.hostname': "name.local.net",
            osrelease: undefined,
            osreldate: undefined,
            sysvmsg: true,
            sysvsem: true,
            sysvshm: true,
            persist: true,
            vnet: "new",
        };

    }

    join(...args) {

        return Object.assign(this, ...args);

    }

    clone() {

        return Object.assign(new Manifest, this);

    }

    toFile(file) {

        fs.writeFileSync(file, JSON.stringify(this));

    }

}

module.exports = Manifest;
