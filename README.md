# NodeJS client for the Bulk API Monitor
Fast tracking an unlimited number of ERC20 tokens and Ethereum addresses, even millions.

https://docs.ethplorer.io/monitor

## Quickstart

In this quickstart, you'll learn how to monitor your Ethereum addresses with Ethplorer Bulk API and and Node.js.

First of all, let's include MonitorApp class:
```
const { MonitorApp } = require('eth-bulk-monitor-client-nodejs');
```

Then instantiate the class with your [API key](https://ethplorer.io/wallet/#register).
```
const monitorApp = new MonitorApp('put your API key here');
```

Finally, lets define the addresses we would like to monitor and a callback function:
```
monitorApp.watch([
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003'
],
(data) => {
    console.log(data);
});
```

Voila, now we can get and process all the new transactions and ERC-20 operations for the specified addresses using just a single npm library and Node.js.
