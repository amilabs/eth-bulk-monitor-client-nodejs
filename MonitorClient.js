const EventEmitter = require('events');
const got = require('got');
const FormData = require('form-data');
const BigNumber = require('bignumber.js');

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
    already_watching: 'Watching is already started, use unwatch first',
    err_get_updates: 'Can not get last pool updates'
};

// Last unwatch event timestamp
let lastUnwatchTs = 0;

// Ethereum pseudo-token addess
const ETHAddress = '0x0000000000000000000000000000000000000000';

// Events already emitted
const eventsEmitted = {};

// Watching state
const state = {
    lastBlock: 0,
    lastTs: 0,
    blocks: {}
};

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
            // Tokens cache lifetime (ms)
            tokensCacheLifeTime: 600000,
            // Request timeout (ms)
            requestTimeout: 30000,
            // Watch for failed transactions/operations
            watchFailed: false,
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
        BigNumber.config({ ERRORS: false });
    }

    /**
     * Returns current state.
     *
     * @returns {Promise}
     */
    async saveState() {
        return state;
    }

    /**
     * Restores state from saved data.
     *
     * @param {Object} stateData
     */
    restoreState(stateData) {
        if (!stateData || (stateData.lastBlock === undefined)) {
            throw new Error(errorMessages.invalid_state);
        }
        delete stateData.blocksTx;
        delete stateData.blocksOp;
        if (!stateData.blocks) {
            stateData.blocks = {};
        }
        lastUnwatchTs = stateData.lastTs ? stateData.lastTs : 0;

        state.lastBlock = stateData.lastBlock;
        state.lastTs = stateData.lastTs;
        state.blocks = stateData.blocks;
    }

    /**
     * Checks if the block was already processed.
     *
     * @param {int} blockNumber
     * @returns {Boolean}
     */
    isBlockProcessed(blockNumber) {
        return (state.lastBlock >= blockNumber) || (state.blocks && state.blocks[blockNumber]);
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
     * Returns a list of addresses in the pool.
     *
     * @returns {Array}
     */
    async getAddresses() {
        let result = [];
        const { apiKey, poolId } = this.credentials;
        const url = `${this.options.monitor}/getPoolAddresses/${poolId}?apiKey=${apiKey}`;
        try {
            const data = this.processBulkAPIData(await got(url, { timeout: this.options.requestTimeout }));
            if (data && data.addresses && data.addresses.length) {
                result = data.addresses;
            }
        } catch (e) {
            throw new Error(`${url} ${errorMessages.request_failed} ${e.message}`);
        }
        return result;
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
     * Removes all addresses from the pool.
     *
     * @returns {bool}
     */
    async removeAllAddresses() {
        await this.postBulkAPI('clearPoolAddresses');
        return true;
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
                const dataEvents = [];
                if (!this.watching) return;
                const blocksToAdd = [];
                const updatesData = await this.getPoolUpdates(lastUnwatchTs);
                if (!updatesData) {
                    throw new Error(errorMessages.err_get_updates);
                }
                const transactionsData = updatesData.transactions;
                const operationsData = updatesData.operations;
                if (transactionsData) {
                    const { rate } = await this.getToken(ETHAddress);
                    Object.keys(transactionsData).forEach((address) => {
                        const txData = transactionsData[address];
                        for (let i = 0; i < txData.length; i++) {
                            const data = { ...txData[i], rate };
                            const skipFailed = (!this.options.watchFailed && !data.success);
                            data.usdValue = parseFloat((data.value * rate).toFixed(2));
                            if (!skipFailed && data.blockNumber && !this.isBlockProcessed(data.blockNumber)) {
                                if (this.watching) {
                                    const type = 'transaction';
                                    const id = `${type}-${address}-${data.hash}`;
                                    if (eventsEmitted[id] === undefined) {
                                        blocksToAdd.push(data.blockNumber);
                                        dataEvents.push({
                                            id,
                                            address,
                                            data,
                                            type
                                        });
                                    }
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
                                        const bn = (new BigNumber(data.value)).div(10 ** data.token.decimals);
                                        data.value = bn.toString(10);
                                        if (data.token.rate) {
                                            data.usdValue = parseFloat((parseFloat(data.value) * data.token.rate)
                                                .toFixed(2));
                                        }
                                    }
                                    if (this.watching) {
                                        const type = 'operation';
                                        const id = `${type}-${address}-${data.hash}-${data.priority}`;
                                        if (eventsEmitted[id] === undefined) {
                                            blocksToAdd.push(data.blockNumber);
                                            dataEvents.push({
                                                id,
                                                address,
                                                data,
                                                type
                                            });
                                        }
                                    }
                                }
                            })))));
                }
                if ((updatesData.lastSolidBlock && updatesData.lastSolidBlock.block !== state.lastBlock) ||
                    blocksToAdd.length) {
                    state.lastBlock = updatesData.lastSolidBlock.block;
                    state.lastTs = updatesData.lastSolidBlock.timestamp;
                    if (blocksToAdd.length) {
                        for (let i = 0; i < blocksToAdd.length; i++) {
                            state.blocks[blocksToAdd[i]] = true;
                        }
                    }
                    lastUnwatchTs = 0;
                    setImmediate(() => this.emit('stateChanged', state));
                    this.clearCachedBlocks();
                }
                if (dataEvents.length > 0) {
                    setImmediate(() => {
                        for (let i = 0; i < dataEvents.length; i++) {
                            const event = dataEvents[i];
                            eventsEmitted[event.id] = true;
                            delete event.id;
                            this.emit('data', event);
                        }
                    });
                }
            } catch (e) {
                this.errors++;
                setImmediate(() => this.emit('exception', e));
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
                    await this._sleep(100);
                    lockCheckCount++;
                    if (lockCheckCount >= this.options.cacheLockCheckLimit) {
                        // No data on timeout
                        const unknownToken = {
                            name: 'Unknown',
                            symbol: 'Unknown',
                            decimals: 0
                        };
                        // Clear lock
                        delete this.tokensCacheLocks[address];
                        return (this.tokensCache[address] && this.tokensCache[address].result) ?
                            this.tokensCache[address].result : unknownToken;
                    }
                }
            }
        }
        const cache = this.tokensCache[address];
        if (cache === undefined || (Date.now() - cache.saveTs) > this.options.tokensCacheLifeTime) {
            this.tokensCacheLocks[address] = true;
            let result = false;
            const { apiKey } = this.credentials;
            let errorCount = 0;
            while (!result && errorCount < 3) {
                try {
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
                    } else errorCount++;
                } catch (e) {
                    errorCount++;
                    setImmediate(() => this.emit('exception', e));
                    await this._sleep(1000);
                }
            }
            // Use previously cached value on error
            if (!result && this.tokensCache[address] && this.tokensCache[address].result) {
                this.tokensCache[address].saveTs = Date.now();
            } else {
                this.tokensCache[address] = { result, saveTs: Date.now() };
            }
            delete this.tokensCacheLocks[address];
        }
        return this.tokensCache[address].result;
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
        if (['getPoolLastTransactions', 'getPoolLastOperations', 'getPoolUpdates'].indexOf(method) < 0) {
            throw new Error(`${errorMessages.unknown_method} ${method}`);
        }
        const promise = this._getUpdates(method, startTime);
        this.emit(method, promise);
        return promise;
    }

    /**
     * Utility function fot getUpdates
     *
     * @param {string} method
     * @param {int} startTime
     * @returns {Object|null}
     */
    async _getUpdates(method, startTime = 0) {
        if (!this.credentials.poolId) {
            throw new Error(errorMessages.no_pool_id);
        }
        let result = null;
        const startTs = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        const lastTs = state.lastTs ? Math.floor((Date.now() / 1000 - state.lastTs)) : 0;
        const period = Math.min(Math.max(this.options.period, startTs, lastTs), 360000);
        const { apiKey, poolId } = this.credentials;
        const url = `${this.options.monitor}/${method}/${poolId}?apiKey=${apiKey}&period=${period}`;
        try {
            result = this.processBulkAPIData(await got(url, { timeout: this.options.requestTimeout }));
        } catch (e) {
            throw new Error(`${url} ${errorMessages.request_failed} ${e.message}`);
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
        if ([
            'createPool',
            'deletePool',
            'addPoolAddresses',
            'deletePoolAddresses',
            'clearPoolAddresses'
        ].indexOf(method) < 0) {
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
        if (data && data.addresses && data.addresses.length) {
            form.append('addresses', data.addresses.join());
        }
        let result = null;
        const url = `${this.options.monitor}/${method}`;
        try {
            const d = await got.post(url, { body: form, timeout: this.options.requestTimeout });
            result = this.processBulkAPIData(d);
        } catch (e) {
            throw new Error(`${url} POST ${errorMessages.request_failed} ${e.message}`);
        }
        return result;
    }

    /**
     * Returns last tracked transactions since the startTime
     *
     * @param {int} startTime
     * @returns {Object|null}
     */
    async getPoolUpdates(startTime = 0) {
        return this.getUpdates('getPoolUpdates', startTime);
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

    /**
     * Wait for N seconds in async function
     *
     * @param {int} time
     */
    _sleep(time) {
        return new Promise((resolve) => { setTimeout(() => resolve(), time); });
    }

    /**
     * Clears cached blocks and tx/op data
     *
     * @returns {undefined}
     * @private
     */
    clearCachedBlocks() {
        if (state && state.blocks) {
            const blocks = Object.keys(state.blocks);
            if (blocks.length) {
                // Remove old blocks from the state
                for (let i = 0; i < blocks.length; i++) {
                    const blockNumber = blocks[i];
                    if (blockNumber <= state.lastBlock) {
                        delete state.blocks[blockNumber];
                    }
                }
                // Clear tx/op cache
                const events = Object.keys(eventsEmitted);
                for (let i = 0; i < events.length; i++) {
                    const eventName = events[i];
                    const eventBlock = eventsEmitted[eventName];
                    if (eventBlock <= state.lastBlock) {
                        delete eventsEmitted[eventName];
                    }
                }
            }
        }
    }
}

module.exports = MonitorClient;
