# NodeJS client for Ethplorer Bulk API Monitor
Fast tracking an unlimited number of ERC20 tokens and Ethereum addresses, even millions.

https://docs.ethplorer.io/monitor

## Quickstart

Learn how to start tracking your Ethereum addresses with Ethplorer Bulk API and and Node.js.

Let's create a new project and add ```eth-bulk-monitor-client-nodejs``` library via npm.
```
$ mkdir monitor-example
$ cd monitor-example
$ npm init
$ npm i --save eth-bulk-monitor-client-nodejs
$ vim index.js
```

Create a new js file and start edit it.

First of all, let's include MonitorApp class:
```
const { MonitorApp } = require('eth-bulk-monitor-client-nodejs');
```

Then instantiate the class with your [API key](https://ethplorer.zendesk.com/hc/en-us/articles/900000976026-How-to-get-access-to-the-Bulk-API-Monitor-).
```
const monitorApp = new MonitorApp('put your API key here');
```

Finally, lets define the addresses we would like to monitor and a callback function:
```
monitorApp.init([
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003'
]).then(() => monitorApp.watch((data) => console.log(data));
```

Voila, now we can get and process all the new transactions and ERC-20 operations for the specified addresses using just a single npm library and Node.js.

## Examples

- [Basic example](examples/basicExample.js)
- [Crypto exchanger example](https://github.com/amilabs/crypto-exchanger)

## Reference

You can find the class reference [here](reference.md).
