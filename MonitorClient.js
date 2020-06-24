const EventEmitter = require('events');
const got = require('got');
const FormData = require('form-data');

// API pool credentials: apiKey and poolId
let credentials = {};

// Known networks
const networks = {
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

// Last unwatch event timestamp
let lastUnwatchTs = 0;

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
                if (options.network === 'custom') {
                    if (!options.api) {
                        throw new Error('Custom network requires Ethplorer API uri to be set in options');
                    }
                    if (!options.monitor) {
                        throw new Error('Custom network requires Bulk API uri to be set in options');
                    }
                    this.api = options.api;
                    this.monitor = options.monitor;
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
        if (this.options.network !== 'custom') {
            this.api = networks[this.options.network].api;
            this.monitor = networks[this.options.network].monitor;
        }
        this.errors = 0;
    }

    /**
     * Adds addresses to the pool.
     *
     * @param {string[]} addresses
     * @returns {undefined}
     */
    async addAddresses(addresses) {
        if (addresses && addresses.length) {
            const requestUrl = `${this.monitor}/addPoolAddresses}`;
            const form = new FormData();
            form.append('apiKey', credentials.apiKey);
            form.append('poolId', credentials.poolId);
            form.append('addresses', addresses.join());
            await got.post(requestUrl, { body: form });
        }
    }

    /**
     * Removes addresses from the pool.
     *
     * @param {string[]} addresses
     * @returns {undefined}
     */
    async removeAddresses(addresses) {
        if (addresses && addresses.length) {
            const requestUrl = `${this.monitor}/deletePoolAddresses}`;
            const form = new FormData();
            form.append('apiKey', credentials.apiKey);
            form.append('poolId', credentials.poolId);
            form.append('addresses', addresses.join());
            await got.post(requestUrl, { body: form });
        }
    }

    /**
     * Starts watching for address acitivity.
     *
     * @returns {undefined}
     */
    watch() {
        setImmediate(this.intervalHandler());
        this._iId = setInterval(this.intervalHandler(), this.options.interval * 1000);
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
    intervalHandler() {
        return async () => {
            try {
                const transactionsData = await this.getTransactions(lastUnwatchTs);
                if (transactionsData) {
                    Object.keys(transactionsData).forEach((address) => {
                        const data = transactionsData[address];
                        for (let i = 0; i < data.length; i++) {
                            this.emit('data', { address, data: data[i], type: 'transaction' });
                        }
                    });
                }
                const operationsData = await this.getOperations(lastUnwatchTs);
                if (operationsData) {
                    await Promise.all(Object.keys(operationsData).map((address) => {
                        const data = operationsData[address];
                        return Promise.all(data.map(addressInfo => this.getToken(addressInfo.contract)
                            .then(token => this.emit(
                                'data',
                                {
                                    address,
                                    data: {
                                        ...addressInfo,
                                        token
                                    },
                                    type: 'operation'
                                }
                            ))));
                    }));
                }
            } catch (e) {
                this.errors++;
                if (this.errors >= this.options.maxErrorCount) {
                    this.errors = 0;
                    lastUnwatchTs = Date.now();
                    clearInterval(this._iId);
                    this.emit('unwatched', e.message);
                }
            }
        };
    }

    async getToken(address) {
        if (tokensCache[address] === undefined) {
            let result = false;
            const requestUrl = `${this.api}/getTokenInfo/${address.toLowerCase()}?apiKey=${credentials.apiKey}`;
            const data = await got(requestUrl);
            if (data && data.body) {
                result = JSON.parse(data.body);
                JSON.stringify(result);
            }
            tokensCache[address] = result;
        }
        return tokensCache[address];
    }

    /**
     *
     * @returns {undefined}
     */
    async getUpdates(method, startTime = 0) {
        let result = null;
        if (['getPoolLastTransactions', 'getPoolLastOperations'].indexOf(method) < 0) {
            throw new Error(`Unknown API method ${method}`);
        }
        const period = startTime ? Math.floor((Date.now() - startTime) / 1000) : this.options.period;
        const url = `${this.monitor}/${method}/${credentials.poolId}?apiKey=${credentials.apiKey}&period=${period}`;
        const data = await got(url);
        if (data && data.body) {
            result = JSON.parse(data.body);
        }
        return result;
    }

    /**
     *
     * @param {type} startTime
     * @returns {undefined|result}
     */
    async getTransactions(startTime = 0) {
        return this.getUpdates('getPoolLastTransactions', startTime);
    }

    /**
     *
     * @param {type} startTime
     * @returns {undefined|result}
     */
    async getOperations(startTime = 0) {
        return this.getUpdates('getPoolLastOperations', startTime);
    }
}

module.exports = MonitorClient;
