const MonitorClient = require('./MonitorClient');

const path = require('path');
const fs = require('fs');
const os = require('os');

// Error messages
const errorMessages = {
    no_api_key: 'No API Key specified'
};

// Watching flag
let watching = false;

// Initialization flag
let initialized = false;

class MonitorApp {
    /**
     * Constructor has the same params as the monitorClient class constructor.
     *
     * @param {string} apiKey
     * @param {object} options
     * @returns {MonitorApp}
     */
    constructor(apiKey, options = {}) {
        if (!apiKey) {
            throw new Error(errorMessages.no_api_key);
        }

        this.monitor = new MonitorClient(apiKey, options);

        this.state = {
            poolId: false
        };

        this.options = {
            // Temporary file to save watching state
            tmpFile: path.join(os.tmpdir(), 'monitorAppState.tmp'),
            ...options
        };

        this.restoreState();
    }

    /**
     * Initializes the app and adds addresses to the pool.
     *
     * @param {array} addresses
     */
    async init(addresses) {
        if (initialized) return;
        if (this.state.poolId === false) {
            // Create a new pool
            this.state.poolId = await this.monitor.createPool();
            this.saveState();
        }
        this.monitor.credentials.poolId = this.state.poolId;
        if (addresses && addresses.length) {
            this.monitor.addAddresses(addresses);
        }
        initialized = true;
    }

    /**
     * Saves the app state to a file
     */
    saveState() {
        fs.writeFileSync(this.options.tmpFile, JSON.stringify(this.state));
    }

    /**
     * Restores the app state from a file.
     */
    restoreState() {
        if (fs.existsSync(this.options.tmpFile)) {
            const data = fs.readFileSync(this.options.tmpFile);
            this.state = JSON.parse(data);
        }
    }

    /**
     * Starts watching for addresses changes.
     * Will create a new pool if no poolId was stored in the watching state
     *
     * @param {function} callback
     */
    async watch(callback) {
        if (watching === true) return;

        await this.init();

        if (typeof (callback) === 'function') {
            this.monitor.on('data', callback);
        }
        this.monitor.on('stateChanged', () => this.saveState);

        this.monitor.watch();
        watching = true;
    }

    /**
     * Stops watching and removes listeners
     */
    async unwatch() {
        this.monitor.removeAllListeners();
        this.monitor.unwatch();
        watching = false;
    }
}

module.exports = MonitorApp;
