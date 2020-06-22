const EventEmitter = require('events');
const got = require('got');

// API pool credentials: apiKey and poolId
let credentials = {};

// Known networks
let networks = {
    mainnet: {
        api: 'https://api.ethplorer.io',
        monitor: 'https://api-mon.ethplorer.io'
    },
    kovan: {
        api: 'https://kovan-api.ethplorer.io',
        monitor: 'https://kovan-api-mon.ethplorer.io'
    },
    custom: false
};

const tokensCache = {};

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
                    if (!options.monitor) {
                        throw new Error('Custom network requires network API uri to be set in options');
                    }
                    this.api = options.api;
                    this.monitor = options.monitor;
                } else {
                    this.api = networks[options.network].api;
                    this.monitor = networks[options.network].monitor;
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
        setImmediate(this.intervalHandler(this));
        this._iId = setInterval(this.intervalHandler(this), this.options.interval * 1000);
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
    intervalHandler(_this) {
        return async () => {
            const transactionsData = await _this.getUpdates('getPoolLastTransactions');
            const operationsData = await _this.getUpdates('getPoolLastOperations');
            if (transactionsData) {
                for (let address in transactionsData) {
                    const data = transactionsData[address];
                    for (let i = 0; i < data.length; i++) {
                        this.emit('data', { address, data: data[i], type: 'transaction' });
                    }
                }
            }
            if (operationsData) {
                for (let address in operationsData) {
                    const data = operationsData[address];
                    for (let i = 0; i < data.length; i++) {
                        const token = await _this.getToken(data[i].contract);
                        data[i].token = token;
                        this.emit('data', { address, data: data[i], type: 'operation' });
                    }
                }
            }
        };
    }

    async getToken(address) {
        if (tokensCache[address] === undefined) {
            try {
                let result = false;
                const requestUrl = `${this.api}/getTokenInfo/${address.toString().toLowerCase()}?apiKey=${credentials.apiKey}`;
                const data = await got(requestUrl);
                if (data && data.body) {
                    result = JSON.parse(data.body);
                    JSON.stringify(result);
                }
                tokensCache[address] = result;
            } catch (e) {
                tokensCache[address] = false;
                /*
                this.errors++;
                if (this.errors >= this.options.maxErrorCount) {
                    this.errors = 0;
                    clearInterval(this._iId);
                    this.emit('unwatched', e.message);
                }
                */
            }
        }
        return tokensCache[address];
    }

    /**
     *
     * @returns {undefined}
     */
    async getUpdates(method) {
        let result = null;
        if (['getPoolLastTransactions', 'getPoolLastOperations'].indexOf(method) < 0) {
            throw new Error(`Unknown API method ${method}`);
        }
        try {
            const requestUrl = `${this.monitor}/${method}/${credentials.poolId}?apiKey=${credentials.apiKey}&period=${this.options.period}`;
            const data = await got(requestUrl);
            if (data && data.body) {
                result = JSON.parse(data.body);
            }
        } catch (e) {
            this.errors++;
            if (this.errors >= this.options.maxErrorCount) {
                this.errors = 0;
                clearInterval(this._iId);
                this.emit('unwatched', e.message);
            }
        }
        return result;
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
