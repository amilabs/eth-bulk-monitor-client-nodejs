/**
 * Bulk API Monitor client library basic usage example.
 */
const { MonitorApp } = require('../index');

/**
 * Initialize client application.
 *
 * @type monitorApp
 */
const monitorApp = new MonitorApp('put your API key here');

/**
 * Watch for the addresses new transactions/operations and print out any update
 */
monitorApp.watch([
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003'
],
// Callback for every new transaction or operation
(data) => {
    console.log(data);
});