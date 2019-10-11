/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const util = require('util');

const Bootstrapper      = require('./bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const MatchingServer = require('./server');

(async () => {
	try {
		await bootstrapper.initAll();
		await require('../src/data_services').getInstance().start();
		const server = new MatchingServer();
		await util.promisify(cb => server.start(cb, false))();
		console.log('Matching server started');
	} catch (error) {
		console.error('Matching server error', error);
		process.exit(1);
	}
})();
