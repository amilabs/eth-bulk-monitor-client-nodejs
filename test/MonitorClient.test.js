const assert = require('assert');
const lib = require('../MonitorClient.js');
const express = require('express');
const ws = express();

const ETHAddress = "0x0000000000000000000000000000000000000000";
const A1 = "0x0000000000000000000000000000000000000001";
const A2 = "0x0000000000000000000000000000000000000002";
const C0 = "0x0000000000000000000000000000000000000003";

let transactions = {};
let operations = {};
let updates = { transactions, operations, lastBlock: { block: 0, timestamp: 0 } };

let blockNumber = 1000;

const options = {
    poolId: 'poolId',
    interval: 0.1,
    network: 'custom',
    api: 'http://127.0.0.1:63101',
    monitor: 'http://127.0.0.1:63101',
    maxErrorCount: 3
};

const badOptions = { ...options, poolId: 'badPoolId' };

describe('MonitorClient test', () => {
    before(() => {
        ws.route(`/getTokenInfo/${ETHAddress}`)
            .get((req, res) => res.json({
                address: ETHAddress,
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
                price: {
                    rate: 300
                }
            }));

        ws.route(`/getTokenInfo/${C0}`)
            .get((req, res) => {
                res.json({
                    address: C0,
                    name: "Token",
                    symbol: "TKN",
                    decimals: 4,
                    price: {
                        rate: 100
                    }
                });
            });

        ws.route("/createPool")
            .get((req, res) => {
                res.json(operations);
            });

        ws.route("/deletePool")
            .get((req, res) => {
                res.json(operations);
            });

        ws.route("/getPoolLastOperations/poolId")
            .get((req, res) => {
                res.json(operations);
            });

        ws.route("/getPoolLastTransactions/poolId")
            .get((req, res) => {
                res.json(transactions);
            });
            
        ws.route("/getPoolUpdates/poolId")
            .get((req, res) => {
                res.json(updates);
            });
        this.server = ws.listen(63101);
    });

    after(() => this.server.close());

    it('getTokenInfo should return correct ETH data', async () => {
        const mon = new lib('apiKey', options);
        const data = await mon.getToken(ETHAddress);
        assert.equal(data.name, "Ethereum");
        assert.equal(data.symbol, "ETH");
        assert.equal(data.decimals, 18);
        assert.equal(data.rate, 300);
        delete mon;
    });   

    it('watch() should fire the watched, data, stateChanged and unwatch events', (done) => {
        addNextBlockTx(A1, A2, C0, 1000, 1.5);
        const mon = new lib('apiKey', options);
        mon.on("watched", () => {
            assert.equal(true, true);
        });
        mon.on("data", (eventData) => {          
            assert.equal(eventData.address, A1);
            assert.equal(eventData.data.blockNumber, 1000);
            assert.equal(eventData.data.hash, '1000');
            if (eventData.type === 'transaction') {
                assert.equal(eventData.data.rate, 300);
                assert.equal(eventData.data.usdValue, 450);
            }
            if (eventData.type === 'operation') {
                assert.equal(eventData.data.token.rate, 100);
                assert.equal(eventData.data.rawValue, 1000);
                assert.equal(eventData.data.value, 0.1);
                assert.equal(eventData.data.usdValue, 10);
            }
        });
        mon.on("stateChanged", async (state) => {
            assert.equal(state.lastBlock, 1000);
            assert.equal(state.lastTs, 1000);
            mon.unwatch();
        });
        mon.on("unwatched", () => {
            assert.equal(true, true);
            delete mon;
            done();
        });
        mon.watch();
    });

    it('should restore the saved state', (done) => {
        addNextBlockTx(A1, A2, C0, 500, 1);
        const mon = new lib('apiKey', options);
        const savedState = { lastBlock: 1000, lastTs: 1000 };
        mon.restoreState(savedState);
        mon.on("data", (eventData) => {
            assert.equal(eventData.address, A1);
            assert.equal(eventData.data.blockNumber, 1001);
            assert.equal(eventData.data.hash, '1001');
        });
        mon.on("stateChanged", (state) => {
            assert.equal(Object.keys(state.blocks).length, 1);
            assert.equal(state.lastBlock, 1001);
            assert.equal(state.lastTs, 1001);
            mon.unwatch();
            delete mon;
            done();
        });
        mon.watch();
    });

    it('should unwatch after maxErrorCount errors', (done) => {
        addNextBlockTx(A1, A2, C0, 500, 1);
        const mon = new lib('apiKey', badOptions);
        mon.on("unwatched", () => {
            assert.equal(mon.errors, 3);
            delete mon;
            done();
        });
        mon.watch();
    });

    it('should watch failed if watchFailed flag is on', (done) => {
        clearTransactionsAndOperations();
        const mon = new lib('apiKey', {...options, watchFailed: true });
        mon.restoreState({ lastBlock: 0, lastTs: 0, blocks: {} });
        mon.on("data", (eventData) => {
            assert.equal(eventData.data.success, false);
            mon.unwatch();
            delete mon;
            done();
        });
        setTimeout(() => {
            addNextBlockTx(A1, A2, C0, 500, 1, false);
        }, 0);
        mon.watch();
    });

    it('should not watch failed if watchFailed flag is off', (done) => {
        clearTransactionsAndOperations();
        const mon = new lib('apiKey', {...options });
        mon.restoreState({ lastBlock: 0, lastTs: 0, blocks: {} });
        mon.on("data", (eventData) => {
            if(eventData.type === 'transaction') {
                assert.equal(eventData.data.success, true);
                mon.unwatch();
                delete mon;
                done();
            }
        });
        setTimeout(() => {
            addNextBlockTx(A1, A2, C0, 500, 1);
        }, 0);
        mon.watch();
    });
    
    it('should not raise data event for duplicate data', (done) => {
        clearTransactionsAndOperations();
        const mon = new lib('apiKey', {...options, watchFailed: true });
        mon.restoreState({ lastBlock: 0, lastTs: 0, blocks: {} });
        let dups = 0;
        mon.on("data", (eventData) => {
            if(eventData.data.blockNumber === 1) {
                dups++;
            }
            if(eventData.data.blockNumber === 2) {
                assert.equal(dups, 1);
                mon.unwatch();
                delete mon;
                done();
            }
        });
        addBlockOp(1, A1, A2, C0, 500);
        setTimeout(() => {           
            addBlockOp(1, A1, A2, C0, 500); 
        }, 50);
        setTimeout(() => {           
            addBlockOp(1, A1, A2, C0, 500); 
        }, 100);
        setTimeout(() => addBlockOp(2, A1, A2, C0, 500), 150);
        mon.watch();
    });
});

function addNextBlockTx(from, to, contract, value, valueETH, success = true, noOperation = false) {
    if (transactions[from] === undefined) {
        transactions[from] = [];
    }

    if (success && !noOperation) {
        addBlockOp(blockNumber, from, to, contract, value);
    }

    const tx = {
        timestamp: Date.now(),
        blockNumber,
        from,
        to: contract,
        hash: blockNumber.toString(),
        value: valueETH,
        input: '0xa9059cbb',
        balances: {},
        success
    };

    tx.balances[from] = 10000;
    tx.balances[contract] = 10000;

    transactions[from].push(tx);

    updates = { transactions, operations, lastSolidBlock: { block: blockNumber, timestamp: blockNumber } };

    blockNumber++;
}

function addBlockOp(blockNumber, from, to, contract, value) {
    if (operations[from] === undefined) {
        operations[from] = [];
    }
    const op = {
        timestamp: Date.now(),
        blockNumber,
        contract,
        value,
        type: 'transfer',
        priority: 0,
        from,
        to,
        hash: blockNumber.toString(),
        balances: {}
    };

    op.balances[from] = 10000;
    op.balances[to] = 10000;

    operations[from].push(op);
    
    updates = { transactions, operations, lastSolidBlock: { block: blockNumber, timestamp: blockNumber } };
}

function clearTransactionsAndOperations() {
    transactions = {};
    operations = {};
    updates = { transactions, operations, lastSolidBlock: { block: 0, timestamp: 0 } };
}