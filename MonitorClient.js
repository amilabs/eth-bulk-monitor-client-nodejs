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

// Error messages
const errorMessages = {
    unkonwn_network: 'Unknown network',
    custom_api_uri: 'Custom network requires Ethplorer API uri to be set in options',
    custom_monitor_uri: 'Custom network requires Bulk API uri to be set in options',
    no_pool_id: 'No poolId specified: set poolId option or create a new pool using createPool method',
    invalid_state: 'Invalid state object',
    request_failed: 'Request failed:',
    unknown_method: 'Unknown API method',
    already_watching: 'Watching is already started, use unwatch first'
};

// Last unwatch event timestamp
let lastUnwatchTs = 0;

// Last processed tx timestamp
let lastTxTs = 0;

// Ethereum pseudo-token addess
const ETHAddress = '0x0000000000000000000000000000000000000000';

class MonitorClient extends EventEmitter {
    /**
     * Constructor.
     *
     * @param {string} apiKey
     * @param {object} options
     * @returns {MonitorClient}
     */
    constructor(apiKey, options) {
        super();
        this.options = {
            // Ethereum network
            network: 'mainnet',
            // Data request period (in seconds)
            period: 300,
            // How often to request updates (in seconds)
            interval: 60,
            // Maximum errors in a row to unwatch (0 for infinite)
            maxErrorCount: 0,
            // Number of cache lock checks
            cacheLockCheckLimit: 100,
            // Request timeout (ms)
            requestTimeout: 30000,
            ...options
        };
        // Try to get poolId from options
        const poolId = this.options.poolId ? this.options.poolId : false;
        // Token data will be stored here
        this.tokensCache = {};
        // Used to lock token cache
        this.tokensCacheLocks = {};
        // API pool credentials: apiKey and poolId
        this.credentials = { apiKey, poolId };
        // Configure network services
        if (!this.options.network || (networks[this.options.network] === undefined)) {
            throw new Error(`${errorMessages.unknown_network} ${this.options.network}`);
        }
        if (this.options.network !== 'custom') {
            this.options.api = networks[this.options.network].api;
            this.options.monitor = networks[this.options.network].monitor;
        }
        if (!this.options.api) {
            throw new Error(errorMessages.custom_api_uri);
        }
        if (!this.options.monitor) {
            throw new Error(errorMessages.custom_monitor_uri);
        }
        this.errors = 0;
        // Watching state
        this.state = {
            lastBlock: 0,
            lastTs: 0,
            blocks: {}
        };
    }

    /**
     * Returns current state.
     *
     * @returns {Promise}
     */
    async saveState() {
        return this.state;
    }

    /**
     * Restores state from saved data.
     *
     * @param {Object} state
     */
    restoreState(state) {
        if (!state || (state.lastBlock === undefined)) {
            throw new Error(errorMessages.invalid_state);
        }
        lastUnwatchTs = state.lastTs ? state.lastTs : 0;
        this.state = state;
    }

    /**
     * Checks if the block was already processed.
     *
     * @param {int} blockNumber
     * @returns {Boolean}
     */
    isBlockProcessed(blockNumber) {
        return (this.state.blocks[blockNumber] !== undefined);
    }

    /**
     * Creates a new pool.
     *
     * @param {string[]} addresses
     * @returns {Boolean|string}
     */
    async createPool(addresses = []) {
        const result = await this.postBulkAPI('createPool', { addresses });
        return result.poolId;
    }

    /**
     * Deletes current pool.
     *
     * @returns {Boolean}
     */
    async deletePool() {
        await this.postBulkAPI('deletePool');
        return true;
    }

    /**
     * Adds addresses to the pool.
     *
     * @param {string[]} addresses
     * @returns {Boolean}
     */
    async addAddresses(addresses) {
        let result = false;
        if (addresses && addresses.length) {
            await this.postBulkAPI('addPoolAddresses', { addresses });
            result = true;
        }
        return result;
    }

    /**
     * Removes addresses from the pool.
     *
     * @param {string[]} addresses
     * @returns {Boolean}
     */
    async removeAddresses(addresses) {
        let result = false;
        if (addresses && addresses.length) {
            await this.postBulkAPI('deletePoolAddresses', { addresses });
            result = true;
        }
        return result;
    }

    /**
     * Starts watching for address acitivity.
     *
     * @returns {Promise}
     */
    watch() {
        if (!this.credentials.poolId) {
            throw new Error(errorMessages.no_pool_id);
        }
        if (this.watching) {
            throw new Error(errorMessages.already_watching);
        }
        this.watching = true;
        return (this.intervalHandler())().then(() => {
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
        if (this.watching) {
            lastUnwatchTs = Date.now();
            this.watching = false;
            this.emit('unwatched', null);
        }
    }

    /**
     * Handles the watching interval.
     *
     * @returns {undefined}
     */
    intervalHandler() {
        return async () => {
            try {
                if (!this.watching) return;
                const eventsEmitted = {};
                const blocksToAdd = [];
                const [transactionsData, operationsData] = await Promise.all([
                    this.getTransactions(lastUnwatchTs),
                    this.getOperations(lastUnwatchTs)
                ]);
                if (transactionsData) {
                    const { rate } = await this.getToken(ETHAddress);
                    Object.keys(transactionsData).forEach((address) => {
                        const txData = transactionsData[address];
                        for (let i = 0; i < txData.length; i++) {
                            const data = { ...txData[i], rate };
                            data.usdValue = parseFloat((data.value * rate).toFixed(2));
                            if (data.blockNumber && !this.isBlockProcessed(data.blockNumber)) {
                                if (this.watching) {
                                    const eventName = `tx-${address}-${data.hash}`;
                                    if (eventsEmitted[eventName] === undefined) {
                                        lastTxTs = data.timestamp * 1000;
                                        eventsEmitted[eventName] = true;
                                        this.emit('data', { address, data, type: 'transaction' });
                                    }
                                }
                                if (blocksToAdd.indexOf(data.blockNumber) < 0) {
                                    blocksToAdd.push(data.blockNumber);
                                }
                            }
                        }
                    });
                }
                if (operationsData) {
                    await Promise.all(Object.keys(operationsData).map(address =>
                        Promise.all(operationsData[address].map(operation => this.getToken(operation.contract)
                            .then((token) => {
                                const { blockNumber } = operation;
                                const validOpType = (['approve'].indexOf(operation.type) < 0);
                                if (blockNumber && !this.isBlockProcessed(blockNumber) && validOpType) {
                                    const data = { ...operation, token };
                                    if (data.token && (data.token.decimals !== undefined)) {
                                        data.rawValue = data.value;
                                        data.value /= (10 ** data.token.decimals);
                                        if (data.token.rate) {
                                            data.usdValue = parseFloat((data.value * data.token.rate).toFixed(2));
                                        }
                                    }
                                    if (this.watching) {
                                        const eventName = `op-${address}-${data.hash}-${data.priority}`;
                                        if (eventsEmitted[eventName] === undefined) {
                                            eventsEmitted[eventName] = true;
                                            this.emit('data', { address, data, type: 'operation' });
                                        }
                                    }
                                    if (blocksToAdd.indexOf(blockNumber) < 0) {
                                        blocksToAdd.push(blockNumber);
                                    }
                                }
                            })))));
                }
                if (blocksToAdd.length) {
                    blocksToAdd.forEach((block) => {
                        if (this.state.lastBlock < block) {
                            this.state.lastBlock = block;
                        }
                        this.state.lastTs = lastTxTs;
                        this.state.blocks[block] = true;
                    });
                    this.emit('stateChanged', this.state);
                }
            } catch (e) {
                this.errors++;
                this.emit('exception', e);
                if ((this.options.maxErrorCount > 0) && (this.errors >= this.options.maxErrorCount)) {
                    this.unwatch();
                    this.errors = 0;
                    return;
                }
            }
            setTimeout(this.intervalHandler(), this.options.interval * 1000);
        };
    }

    /**
     * Returns token data by token address.
     *
     * @param {string} address
     * @returns {Object|bool}
     */
    async getToken(address) {
        address = address.toLowerCase();

        if (this.tokensCacheLocks[address]) {
            // If cache locked then wait repeatedly 0.1s for unlock
            let lockCheckCount = 0;
            if (this.tokensCacheLocks[address]) {
                while (this.tokensCacheLocks[address]) {
                    await new Promise((resolve) => { setTimeout(() => resolve(), 100); });
                    lockCheckCount++;
                    if (lockCheckCount >= this.options.cacheLockCheckLimit) {
                        // No data on timeout
                        return {
                            name: 'Unknown',
                            symbol: 'Unknown',
                            decimals: 0
                        };
                    }
                }
            }
        }
        if (this.tokensCache[address] === undefined) {
            this.tokensCacheLocks[address] = true;
            let result = false;
            const { apiKey } = this.credentials;
            const requestUrl = `${this.options.api}/getTokenInfo/${address}?apiKey=${apiKey}`;
            const data = await got(requestUrl, { timeout: this.options.requestTimeout });
            if (data && data.body) {
                const tokenData = JSON.parse(data.body);
                if (tokenData) {
                    const { name, symbol, decimals } = tokenData;
                    const rate = tokenData.price && tokenData.price.rate ? tokenData.price.rate : false;
                    result = {
                        name,
                        symbol,
                        decimals,
                        rate
                    };
                }
            }
            this.tokensCache[address] = result;
            delete this.tokensCacheLocks[address];
        }
        return this.tokensCache[address];
    }

    /**
     * Parses data from Bulk API, checks for errors
     *
     * @param {object} data
     * @returns {Object|null}
     */
    processBulkAPIData(data) {
        if (data && data.body) {
            const poolData = JSON.parse(data.body);
            if (poolData.error) {
                throw new Error(poolData.error.message);
            }
            return poolData;
        }
        return null;
    }

    /**
     * Asks Bulk API for updates
     *
     * @param {string} method
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getUpdates(method, startTime = 0) {
        if (['getPoolLastTransactions', 'getPoolLastOperations'].indexOf(method) < 0) {
            throw new Error(`${errorMessages.unknown_method} ${method}`);
        }
        const promise = this._getUpdates(method, startTime);
        this.emit(method, promise);
        return promise;
    }

    async _getUpdates(method, startTime = 0) {
        if (!this.credentials.poolId) {
            throw new Error(errorMessages.no_pool_id);
        }
        let result = null;
        let period = startTime ? Math.floor((Date.now() - startTime) / 1000) : this.options.period;
        if (this.state.lastTs && Math.floor((Date.now() - this.state.lastTs) / 1000) > period) {
            period = Math.floor((Date.now() - this.state.lastTs) / 1000);
        }
        const { apiKey, poolId } = this.credentials;
        const url = `${this.options.monitor}/${method}/${poolId}?apiKey=${apiKey}&period=${period}`;
        try {
            result = this.processBulkAPIData(await got(url, { timeout: this.options.requestTimeout }));
        } catch (e) {
            throw new Error(`${errorMessages.request_failed} ${e.message}`);
        }
        return result;
    }

    /**
     * Makes post request to Bulk API
     *
     * @param {string} method
     * @param {object} data
     * @returns {Object|null}
     */
    async postBulkAPI(method, data) {
        if (['createPool', 'deletePool', 'addPoolAddresses', 'deletePoolAddresses'].indexOf(method) < 0) {
            throw new Error(`${errorMessages.unknown_method} ${method}`);
        }
        if ((method !== 'createPool') && !this.credentials.poolId) {
            throw new Error(errorMessages.no_pool_id);
        }
        const promise = this._postBulkAPI(method, data);
        this.emit(method, promise);
        return promise;
    }

    /**
     * Makes post request to Bulk API
     *
     * @param {string} method
     * @param {object} data
     * @returns {Object|null}
     */
    async _postBulkAPI(method, data) {
        const form = new FormData();
        form.append('apiKey', this.credentials.apiKey);
        if (method !== 'createPool') {
            form.append('poolId', this.credentials.poolId);
        }
        if (data.addresses && data.addresses.length) {
            form.append('addresses', data.addresses.join());
        }
        let result = null;
        try {
            const url = `${this.options.monitor}/${method}`;
            const d = await got.post(url, { body: form, timeout: this.options.requestTimeout });
            result = this.processBulkAPIData(d);
        } catch (e) {
            throw new Error(`${errorMessages.request_failed} ${e.message}`);
        }
        return result;
    }

    /**
     * Returns last tracked transactions since the startTime
     *
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getTransactions(startTime = 0) {
        return this.getUpdates('getPoolLastTransactions', startTime);
    }

    /**
     * Returns last tracked operations since the startTime
     *
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getOperations(startTime = 0) {
        return this.getUpdates('getPoolLastOperations', startTime);
    }
}

module.exports = MonitorClient;
