## Classes

<dl>
<dt><a href="#MonitorApp">MonitorApp</a></dt>
<dd></dd>
<dt><a href="#MonitorClient">MonitorClient</a></dt>
<dd></dd>
</dl>

<a name="MonitorApp"></a>

## MonitorApp
**Kind**: global class  

* [MonitorApp](#MonitorApp)
    * [new MonitorApp(apiKey, options)](#new_MonitorApp_new)
    * [.saveState()](#MonitorApp+saveState)
    * [.restoreState()](#MonitorApp+restoreState)
    * [.watch(addresses, callback)](#MonitorApp+watch)

<a name="new_MonitorApp_new"></a>

### new MonitorApp(apiKey, options)
Constructor has the same params as the monitorClient class constructor.


| Param | Type |
| --- | --- |
| apiKey | <code>string</code> | 
| options | <code>object</code> | 

<a name="MonitorApp+saveState"></a>

### monitorApp.saveState()
Saves the watching state to a file

**Kind**: instance method of [<code>MonitorApp</code>](#MonitorApp)  
<a name="MonitorApp+restoreState"></a>

### monitorApp.restoreState()
Restores the watching state from a file.

**Kind**: instance method of [<code>MonitorApp</code>](#MonitorApp)  
<a name="MonitorApp+watch"></a>

### monitorApp.watch(addresses, callback)
Starts watching for addresses changes.
Will create a new pool if no poolId was stored in the watching state

**Kind**: instance method of [<code>MonitorApp</code>](#MonitorApp)  

| Param | Type |
| --- | --- |
| addresses | <code>array</code> | 
| callback | <code>function</code> | 

<a name="MonitorClient"></a>

## MonitorClient
**Kind**: global class  

* [MonitorClient](#MonitorClient)
    * [new MonitorClient(apiKey, options)](#new_MonitorClient_new)
    * [.saveState()](#MonitorClient+saveState) ⇒ <code>Promise</code>
    * [.restoreState(state)](#MonitorClient+restoreState)
    * [.isTxBlockProcessed(blockNumber)](#MonitorClient+isTxBlockProcessed) ⇒ <code>Boolean</code>
    * [.isOpBlockProcessed(blockNumber)](#MonitorClient+isOpBlockProcessed) ⇒ <code>Boolean</code>
    * [.createPool(addresses)](#MonitorClient+createPool) ⇒ <code>Boolean</code> \| <code>string</code>
    * [.deletePool()](#MonitorClient+deletePool) ⇒ <code>Boolean</code>
    * [.addAddresses(addresses)](#MonitorClient+addAddresses) ⇒ <code>Boolean</code>
    * [.removeAddresses(addresses)](#MonitorClient+removeAddresses) ⇒ <code>Boolean</code>
    * [.removeAllAddresses()](#MonitorClient+removeAllAddresses) ⇒ <code>bool</code>
    * [.watch()](#MonitorClient+watch) ⇒ <code>Promise</code>
    * [.unwatch()](#MonitorClient+unwatch) ⇒ <code>undefined</code>
    * [.intervalHandler()](#MonitorClient+intervalHandler) ⇒ <code>undefined</code>
    * [.getToken(address)](#MonitorClient+getToken) ⇒ <code>Object</code> \| <code>bool</code>
    * [.processBulkAPIData(data)](#MonitorClient+processBulkAPIData) ⇒ <code>Object</code> \| <code>null</code>
    * [.getUpdates(method, startTime)](#MonitorClient+getUpdates) ⇒ <code>Object</code> \| <code>null</code>
    * [.postBulkAPI(method, data)](#MonitorClient+postBulkAPI) ⇒ <code>Object</code> \| <code>null</code>
    * [._postBulkAPI(method, data)](#MonitorClient+_postBulkAPI) ⇒ <code>Object</code> \| <code>null</code>
    * [.getTransactions(startTime)](#MonitorClient+getTransactions) ⇒ <code>Object</code> \| <code>null</code>
    * [.getOperations(startTime)](#MonitorClient+getOperations) ⇒ <code>Object</code> \| <code>null</code>

<a name="new_MonitorClient_new"></a>

### new MonitorClient(apiKey, options)
Constructor.


| Param | Type |
| --- | --- |
| apiKey | <code>string</code> | 
| options | <code>object</code> | 

<a name="MonitorClient+saveState"></a>

### monitorClient.saveState() ⇒ <code>Promise</code>
Returns current state.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+restoreState"></a>

### monitorClient.restoreState(state)
Restores state from saved data.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| state | <code>Object</code> | 

<a name="MonitorClient+isTxBlockProcessed"></a>

### monitorClient.isTxBlockProcessed(blockNumber) ⇒ <code>Boolean</code>
Checks if the transactions block was already processed.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| blockNumber | <code>int</code> | 

<a name="MonitorClient+isOpBlockProcessed"></a>

### monitorClient.isOpBlockProcessed(blockNumber) ⇒ <code>Boolean</code>
Checks if the operations block was already processed.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| blockNumber | <code>int</code> | 

<a name="MonitorClient+createPool"></a>

### monitorClient.createPool(addresses) ⇒ <code>Boolean</code> \| <code>string</code>
Creates a new pool.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| addresses | <code>Array.&lt;string&gt;</code> | 

<a name="MonitorClient+deletePool"></a>

### monitorClient.deletePool() ⇒ <code>Boolean</code>
Deletes current pool.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+addAddresses"></a>

### monitorClient.addAddresses(addresses) ⇒ <code>Boolean</code>
Adds addresses to the pool.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| addresses | <code>Array.&lt;string&gt;</code> | 

<a name="MonitorClient+removeAddresses"></a>

### monitorClient.removeAddresses(addresses) ⇒ <code>Boolean</code>
Removes addresses from the pool.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| addresses | <code>Array.&lt;string&gt;</code> | 

<a name="MonitorClient+removeAllAddresses"></a>

### monitorClient.removeAllAddresses() ⇒ <code>bool</code>
Removes all addresses from the pool.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+watch"></a>

### monitorClient.watch() ⇒ <code>Promise</code>
Starts watching for address acitivity.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+unwatch"></a>

### monitorClient.unwatch() ⇒ <code>undefined</code>
Stops watching for address activity.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+intervalHandler"></a>

### monitorClient.intervalHandler() ⇒ <code>undefined</code>
Handles the watching interval.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  
<a name="MonitorClient+getToken"></a>

### monitorClient.getToken(address) ⇒ <code>Object</code> \| <code>bool</code>
Returns token data by token address.

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| address | <code>string</code> | 

<a name="MonitorClient+processBulkAPIData"></a>

### monitorClient.processBulkAPIData(data) ⇒ <code>Object</code> \| <code>null</code>
Parses data from Bulk API, checks for errors

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| data | <code>object</code> | 

<a name="MonitorClient+getUpdates"></a>

### monitorClient.getUpdates(method, startTime) ⇒ <code>Object</code> \| <code>null</code>
Asks Bulk API for updates

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type | Default |
| --- | --- | --- |
| method | <code>string</code> |  | 
| startTime | <code>int</code> | <code>0</code> | 

<a name="MonitorClient+postBulkAPI"></a>

### monitorClient.postBulkAPI(method, data) ⇒ <code>Object</code> \| <code>null</code>
Makes post request to Bulk API

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| method | <code>string</code> | 
| data | <code>object</code> | 

<a name="MonitorClient+_postBulkAPI"></a>

### monitorClient.\_postBulkAPI(method, data) ⇒ <code>Object</code> \| <code>null</code>
Makes post request to Bulk API

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type |
| --- | --- |
| method | <code>string</code> | 
| data | <code>object</code> | 

<a name="MonitorClient+getTransactions"></a>

### monitorClient.getTransactions(startTime) ⇒ <code>Object</code> \| <code>null</code>
Returns last tracked transactions since the startTime

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type | Default |
| --- | --- | --- |
| startTime | <code>int</code> | <code>0</code> | 

<a name="MonitorClient+getOperations"></a>

### monitorClient.getOperations(startTime) ⇒ <code>Object</code> \| <code>null</code>
Returns last tracked operations since the startTime

**Kind**: instance method of [<code>MonitorClient</code>](#MonitorClient)  

| Param | Type | Default |
| --- | --- | --- |
| startTime | <code>int</code> | <code>0</code> | 

