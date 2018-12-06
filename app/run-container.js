'use strict';

const net = require("net");
const uuid4 = require("uuid/v4");
const config = require("./config");

const SOCKET = "/tmp/run_container.sock";

class RunContainer {

    remoteCall(method, body = {}) {

        return new Promise((resolve, reject) => {

            let id = uuid4();
            let socket = net.connect(SOCKET)

            socket.on('data', data => {

                data = JSON.parse(data.toString());
                if (data.error) reject(data.error);
                if (data.id === id) resolve(data.result);

            });

            socket.end(JSON.stringify({
                jsonrpc: "2.0",
                method,
                params: {
                    body
                },
                id,
            }));

        })

    }

    getTty(body = {}) {

        return this.remoteCall("get_tty", body);

    }

    stopContainer(body = {}) {

        return this.remoteCall("stop_container", body);

    }

    runContainer(body = {}) {

        return this.remoteCall("run_container", body);

    }

    waitContainer(body = {}) {

        return this.remoteCall("wait_container", body);

    }

}

module.exports = new RunContainer;
