/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";


const Bootstrapper      = require('./bootstrapper');
const bootstrapper      = Bootstrapper.getInstance();
const MatchingServer = require('./server');

/** @type {DataServices} */
let dataService = null;

function startDataService() {
	dataService = require('../src/data_services').getInstance();
	return dataService.start();

}

bootstrapper.initAll()
	.then(startDataService)
	.then(()=>{
		let server = new MatchingServer();
		server.start(error =>{
			if(error){
				console.error(`Matching server error`,error);
				process.exit(1);
			}
			console.log(`Matching started`)
		},false);
	}).catch(error=>{
	console.error(error);
	process.exit(1);
});