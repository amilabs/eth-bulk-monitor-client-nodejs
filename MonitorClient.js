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

const ETHAddress = '0x0000000000000000000000000000000000000000';

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
            // Number of cache lock checks
            cacheLockCheckLimit: 30,
            ...options
        };
        // Token data will be stored here
        this.tokensCache = {};
        // Used to lock token cache
        this.tokensCacheLocks = {};
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
            const requestUrl = `${this.options.monitor}/addPoolAddresses`;
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
            const requestUrl = `${this.options.monitor}/deletePoolAddresses`;
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
        lastUnwatchTs = Date.now();
        clearInterval(this._iId);
        this._iId = 0;
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
                    const ETHData = await this.getToken(ETHAddress);
                    Object.keys(transactionsData).forEach((address) => {
                        const txData = transactionsData[address];
                        for (let i = 0; i < txData.length; i++) {
                            const data = { ...txData[i] };
                            if (ETHData && ETHData.rate) {
                                data.rate = ETHData.rate;
                                data.usdValue = parseFloat((data.value * ETHData.rate).toFixed(2));
                            }
                            if (data.blockNumber && !this.isBlockProcessed(data.blockNumber)) {
                                if (this._iId) {
                                    this.emit('data', { address, data, type: 'transaction' });
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
                                if (operation.blockNumber && !this.isBlockProcessed(operation.blockNumber)) {
                                    const data = { ...operation, token };
                                    if (data.token) {
                                        data.rawValue = data.value;
                                        data.value = data.rawValue / (10 ** data.token.decimals);
                                        if (data.token.rate) {
                                            data.usdValue = parseFloat((data.value * data.token.rate).toFixed(2));
                                        }
                                    }
                                    if (this._iId) {
                                        this.emit('data', { address, data, type: 'operation' });
                                    }
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
                    this.unwatch();
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
                        return {};
                    }
                }
            }
        }
        if (this.tokensCache[address] === undefined) {
            this.tokensCacheLocks[address] = true;
            let result = false;
            const { apiKey } = this.credentials;
            const requestUrl = `${this.options.api}/getTokenInfo/${address}?apiKey=${apiKey}`;
            const data = await got(requestUrl);
            if (data && data.body) {
                const tokenData = JSON.parse(data.body);
                if (tokenData) {
                    result = {
                        name: tokenData.name,
                        symbol: tokenData.symbol,
                        decimals: tokenData.decimals,
                        rate: tokenData.price && tokenData.price.rate ? tokenData.price.rate : false
                    };
                }
            }
            this.tokensCache[address] = result;
            delete this.tokensCacheLocks[address];
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
