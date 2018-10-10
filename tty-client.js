'use strict';

const EventEmitter = require('events');
const Redis = require('ioredis');

class TTYClient extends EventEmitter {

    constructor(id) {

        super();

        this._id = id;
        this._input = new Redis;
        this._output = new Redis;
        this._eventsIn = new Redis;
        this._eventsOut = new Redis;

        this._output.on('message', (channel, message) => {

            this.emit('data', message);

        });

        this._eventsIn.on('message', (channel, message) => {

            let event = JSON.parse(message);
            this.emit(event.name, event);

        });

    }

    static async factory(id) {

        let obj = new this(id);
        await obj.connect();
        return obj;

    }

    async connect() {

        await this._output.subscribe(`${this._id}:client-output`);
        await this._eventsIn.subscribe(`${this._id}:events`);

        await this.sendEvent({ name: 'client-create-connection' });

    }

    get id() { return this._id; }

    async write(chunk) {

        await this._input.publish(`${this._id}:server-input`, chunk);

    }

    async sendEvent(event) {

        if (!event) throw new Error('argument event required');
        if (event.name === undefined) throw new Error('property name is required');

        this._eventsOut.publish(`${this._id}:events`, JSON.stringify(event));

    }

    async destructor() {

        await this.sendEvent({
            name: 'client-close-connection'
        });

        await this._input.disconnect();
        await this._output.disconnect();
        await this._eventsIn.disconnect();
        await this._eventsOut.disconnect();
        this._id = null;

    }

}

module.exports = TTYClient;
