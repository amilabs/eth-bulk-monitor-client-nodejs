/**
 * Bulk API Monitor client library basic usage example.
 */

const monitorClient = require('eth-bulk-monitor-client-nodejs');

/**
 * Initialize client
 *
 * @type monitorClient
 */
const monitor = new monitorClient('put your API key here’');

/**
 * Add some addresses to the pool
 */
monitor.addAddresses([
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002'
]);

/**
 * Add data event callback
 */
monitor.on("data", function(data){
    console.log(data);
});

/**
 * Start watching
 */
monitor.watch();
