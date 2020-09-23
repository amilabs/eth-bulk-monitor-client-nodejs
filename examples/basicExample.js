/**
 * Bulk API Monitor client library basic usage example.
 */
const { monitorApp } = require('../index');

/**
 * Initialize client application.
 *
 * @type monitorApp
 */
const app = new monitorApp('put your API key here');

/**
 * Watch for the addresses new transactions/operations and print out any update
 */
app.watch([
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003'
],
// Callback for every new transaction or operation
(data) => {
    console.log(data);
});