const MonitorClient = require('./MonitorClient');

const path = require('path');
const fs = require('fs');
const os = require('os');

// Error messages
const errorMessages = {
    no_api_key: 'No API Key specified'
};

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
     * Saves the watching state to a file
     */
    saveState() {
        fs.writeFileSync(this.options.tmpFile, JSON.stringify(this.state));
    }

    /**
     * Restores the watching state from a file.
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
     * @param {array} addresses
     * @param {function} callback
     */
    async watch(addresses = [], callback) {
        let isNew = false;
        if (this.state.poolId === false) {
            // Create a new pool
            this.state.poolId = await this.monitor.createPool(addresses);
            this.saveState();
            isNew = true;
        }

        this.monitor.credentials.poolId = this.state.poolId;

        if (!isNew) {
            await this.monitor.removeAllAddresses();
            await this.monitor.addAddresses(addresses);
        }

        if (typeof (callback) === 'function') {
            this.monitor.on('data', callback);
        }
        this.monitor.on('stateChanged', () => this.saveState);
        this.monitor.on('unwatched', () => {
            // Exit on unwatch
            process.exit(1);
        });

        this.monitor.watch();
    }
}

module.exports = MonitorApp;
