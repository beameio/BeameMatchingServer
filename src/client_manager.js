/**
 * Created by zenit1 on 10/01/2017.
 */
"use strict";

const beameSDK     = require('beame-sdk');
const module_name  = "MatchingClientManager";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();

let clientManagerInstance = null;

class ClientManager {

	constructor() {
		this._clients = [];
		logger.debug(`New Client manager`);
	}

	get clients(){
		return this._clients;
	}

	init() {
		return new Promise((resolve, reject) => {
				Bootstrapper.listClientServers().then(clients => {
					this._clients = clients;
					resolve();
				}).catch(reject);
			}
		);
	}


	/**
	 * @param {Array.<string> | null} [clients]
	 */
	addClients(clients) {

		const _updateClients = (_fqdn)=>{
			if(this._clients.indexOf(_fqdn) < 0){
				this._clients.push(_fqdn);
			}
		};

		return Promise.all(clients.map(fqdn => {

				let p = bootstrapper.registerClientServer(fqdn);

			 	return p.then(_updateClients.bind(this,fqdn));
		}));
	}


	/**
	 * @returns {ClientManager}
	 */
	static getInstance() {
		if (!clientManagerInstance) {
			clientManagerInstance = new ClientManager();
		}

		return clientManagerInstance;
	}
}


module.exports = ClientManager;