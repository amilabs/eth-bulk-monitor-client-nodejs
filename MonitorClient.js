const EventEmitter = require('events');

class MonitorClient extends EventEmitter {
    // How often to request updates
    requestInterval = 15000;

    constructor(monitorURI, apiKey, poolId, options) {
        super();
    }

    addAddresses(addresses) {

    }

    removeAddresses(addresses) {

    }

    watch() {
        // requestUpdates();
    }

    getTxs(fromTime) {

    }
}
