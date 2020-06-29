const EventEmitter = require('events');
const got = require('got');
const FormData = require('form-data');

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
            maxErrorCount: 6,
            ...options
        };
        this.tokensCache = {};
        // API pool credentials: apiKey and poolId
        this.credentials = { apiKey, poolId };
        // Configure network services
        if (!this.options.network || (networks[this.options.network] === undefined)) {
            throw new Error(`Unknown network ${this.options.network}`);
        }
        if (this.options.network !== 'custom') {
            this.options.api = networks[this.options.network].api;
            this.options.monitor = networks[this.options.network].monitor;
        }
        if (!this.options.api) {
            throw new Error('Custom network requires Ethplorer API uri to be set in options');
        }
        if (!this.options.monitor) {
            throw new Error('Custom network requires Bulk API uri to be set in options');
        }
        this.errors = 0;
        // Watching state
        this.state = {
            lastBlock: 0,
            blocks: {}
        };
    }

    async saveState() {
        return this.state;
    }

    restoreState(state) {
        this.state = state;
    }

    isBlockProcessed(blockNumber) {
        return (this.state.blocks[blockNumber] !== undefined);
    }

    /**
     * Adds addresses to the pool.
     *
     * @param {string[]} addresses
     * @returns {bool}
     */
    async addAddresses(addresses) {
        let result = false;
        if (addresses && addresses.length) {
            const requestUrl = `${this.options.monitor}/addPoolAddresses}`;
            const form = new FormData();
            form.append('apiKey', this.credentials.apiKey);
            form.append('poolId', this.credentials.poolId);
            form.append('addresses', addresses.join());
            const data = await got.post(requestUrl, { body: form });
            if (data && data.body) {
                result = true;
            }
        }
        return result;
    }

    /**
     * Removes addresses from the pool.
     *
     * @param {string[]} addresses
     * @returns {bool}
     */
    async removeAddresses(addresses) {
        let result = false;
        if (addresses && addresses.length) {
            const requestUrl = `${this.options.monitor}/deletePoolAddresses}`;
            const form = new FormData();
            form.append('apiKey', this.credentials.apiKey);
            form.append('poolId', this.credentials.poolId);
            form.append('addresses', addresses.join());
            const data = await got.post(requestUrl, { body: form });
            if (data && data.body) {
                result = true;
            }
        }
        return result;
    }

    /**
     * Starts watching for address acitivity.
     *
     * @returns {Promise}
     */
    watch() {
        return (this.intervalHandler())().then(() => {
            this._iId = setInterval(this.intervalHandler(), this.options.interval * 1000);
            this.emit('watched', null);
            return 'ok';
        });
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
     * Handles the watching interval.
     *
     * @returns {undefined}
     */
    intervalHandler() {
        return async () => {
            try {
                const blocksToAdd = [];
                const [transactionsData, operationsData] = await Promise.all([
                    this.getTransactions(lastUnwatchTs),
                    this.getOperations(lastUnwatchTs)
                ]);
                if (transactionsData) {
                    Object.keys(transactionsData).forEach((address) => {
                        const data = transactionsData[address];
                        for (let i = 0; i < data.length; i++) {
                            if (data[i].blockNumber && !this.isBlockProcessed(data[i].blockNumber)) {
                                this.emit('data', { address, data: data[i], type: 'transaction' });
                                if (blocksToAdd.indexOf(data[i].blockNumber) < 0) {
                                    blocksToAdd.push(data[i].blockNumber);
                                }
                            }
                        }
                    });
                }
                if (operationsData) {
                    await Promise.all(Object.keys(operationsData).map(address =>
                        Promise.all(operationsData[address].map(operation => this.getToken(operation.contract)
                            .then((token) => {
                                if (operation.blockNumber && !this.isBlockProcessed(operation.blockNumber)) {
                                    const data = { ...operation, token };
                                    this.emit('data', { address, data, type: 'operation' });
                                    if (blocksToAdd.indexOf(operation.blockNumber) < 0) {
                                        blocksToAdd.push(operation.blockNumber);
                                    }
                                }
                            })))));
                }
                if (blocksToAdd.length) {
                    blocksToAdd.forEach((block) => {
                        if (this.state.lastBlock < block) {
                            this.state.lastBlock = block;
                        }
                        this.state.blocks[block] = true;
                    });
                    this.emit('stateChanged', this.state);
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

    /**
     * Returns token data by token address.
     *
     * @param {string} address
     * @returns {Object|bool}
     */
    async getToken(address) {
        if (this.tokensCache[address] === undefined) {
            let result = false;
            const { apiKey } = this.credentials;
            const requestUrl = `${this.options.api}/getTokenInfo/${address.toLowerCase()}?apiKey=${apiKey}`;
            const data = await got(requestUrl);
            if (data && data.body) {
                result = JSON.parse(data.body);
                JSON.stringify(result);
            }
            this.tokensCache[address] = result;
        }
        return this.tokensCache[address];
    }

    /**
     *
     *
     * @param {string} method
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getUpdates(method, startTime = 0) {
        let result = null;
        if (['getPoolLastTransactions', 'getPoolLastOperations'].indexOf(method) < 0) {
            throw new Error(`Unknown API method ${method}`);
        }
        const period = startTime ? Math.floor((Date.now() - startTime) / 1000) : this.options.period;
        const { apiKey, poolId } = this.credentials;
        const url = `${this.options.monitor}/${method}/${poolId}?apiKey=${apiKey}&period=${period}`;
        const data = await got(url);
        if (data && data.body) {
            result = JSON.parse(data.body);
        }
        return result;
    }

    /**
     *
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getTransactions(startTime = 0) {
        return this.getUpdates('getPoolLastTransactions', startTime);
    }

    /**
     *
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getOperations(startTime = 0) {
        return this.getUpdates('getPoolLastOperations', startTime);
    }
}

module.exports = MonitorClient;
