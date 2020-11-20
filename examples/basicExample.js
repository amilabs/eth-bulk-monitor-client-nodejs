/**
 * Bulk API Monitor client library basic usage example.
 */
const { MonitorApp } = require('../index');

/**
 * Initialize client application.
 *
 * @type MonitorApp
 */
const monitorApp = new MonitorApp('put your API key here');

/**
 * Watch for the addresses new transactions/operations and print out any update
 */
monitorApp.init([
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003'
]).then(() => monitorApp.watch((data) => console.log(data)).catch((err) => console.log(err)));
