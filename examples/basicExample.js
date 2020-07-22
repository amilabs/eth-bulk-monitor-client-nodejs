/**
 * Bulk API Monitor client library basic usage example.
 */

const monitorClient = require('eth-bulk-monitor-client-nodejs');

/**
 * Your Ethplorer API key
 *
 * @type String
 */
const APIKey = 'EK-XXXX-XXXX';

/**
 * You need to create an address pool first to use monitor
 * https://docs.ethplorer.io/monitor#tag/Bulk-API-Monitor-Endpoints/paths/~1createPool/post
 *
 * @type String
 */
const PoolId = 'XXXXX-XXX-XXX-XXXXXXXX';


const monitor = new monitorClient(APIKey, PoolId, { interval: 20 });

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
