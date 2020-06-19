const EventEmitter = require('events');
const got = require('got');

// API pool credentials: apiKey and poolId
let credentials = {};

// Known networks
let networks = {
    mainnet: 'https://api-mon.ethplorer.io',
    kovan: 'https://kovan-api-mon.ethplorer.io',
    custom: ''
};

class MonitorClient extends EventEmitter {
    /**
     * Constructor.
     *
     * @param {string} apiKey
     * @param {string} poolId
     * @param {object} options
     * @returns {MonitorClient}
     */
    constructor(apiKey, poolId, options) {
        super();
        this.options = {
            // Ethereum network
            network: 'mainnet',
            // Data request period (in seconds)
            period: 300,
            // How often to request updates (in seconds)
            interval: 15,
            // Maximum errors in a row to unwatch
            maxErrorCount: 6
        };
        credentials = { apiKey, poolId };
        if (options) {
            if (options.network && (networks[options.network])) {
                this.options.network = options.network;
                if (this.options.network === 'custom') {
                    if (!options.uri) {
                        throw new Error('Custom network requires network API uri to be set in options');
                    }
                    this.uri = options.uri;
                } else {
                    this.uri = networks[options.network];
                }
            } else {
                throw new Error(`Unknown network ${options.network}`);
            }
            if (options.period) {
                this.options.period = options.period;
            }
            if (options.interval) {
                this.options.interval = options.interval;
            }
        }
        this.errors = 0;
    }

    /**
     * Adds addresses to the pool.
     *
     * @param {string[]} addresses
     * @returns {undefined}
     */
    addAddresses(addresses) {
        // todo
    }

    /**
     * Removes addresses from the pool.
     *
     * @param {string[]} addresses
     * @returns {undefined}
     */
    removeAddresses(addresses) {
        // todo
    }

    /**
     * Starts watching for address acitivity.
     *
     * @returns {undefined}
     */
    watch() {
        this._iId = setInterval(this.requestUpdates, this.options.interval * 1000);
    }

    /**
     * Stops watching for address activity.
     *
     * @returns {undefined}
     */
    unwatch() {
        clearInterval(this._iId);
        this.emit('unwatched', null);
    }

    /**
     *
     * @returns {undefined}
     */
    async requestUpdates() {
        try {
            const data = await got(`${this.uri}/getPoolLastOperations/${credentials.poolId}?apiKey=${credentials.apiKey}&period=${this.options.period}`);
            // todo
        } catch (e) {
            this.errors++;
            if (this.errors >= this.options.maxErrorCount) {
                this.errors = 0;
                clearInterval(this._iId);
                this.emit('unwatched', e.message);
            }
        }
    }

    /**
     *
     * @param {type} fromTime
     * @returns {undefined}
     */
    getTxs(fromTime) {
        // todo
    }
}

module.exports = MonitorClient;
