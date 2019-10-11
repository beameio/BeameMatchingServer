/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const bodyParser           = require('body-parser');
const Constants            = require('../constants');
const express              = require('express');
const Router               = require('./router');
const beameSDK             = require('beame-sdk');
const module_name          = "MatchingServer";
const BeameLogger          = beameSDK.Logger;
const logger               = new BeameLogger(module_name);
const MatchingSocketServer = require('./socket_server');
const ClientManager        = require('./client_manager');

/**
 *
 * @param router
 * @param useStatic
 * @param [folderName]
 * @returns {*}
 */
function setExpressApp(router, useStatic, folderName) {
	let app    = express(),
	    folder = folderName || 'public';
	if (useStatic) {
		app.use(express.static(__dirname + '/../' + folder));
	}
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended: false}));
	app.use('/', router);
	app.use("*", function (req, res) {
		res.status(404).send('404');
	});

	return app;
}

function nop() {
}

class MatchingServer {

	/**
	 * @param {String} [fqdn]
	 * @param {Router} [app]
	 * @param {Array.<string> | null} [whisperers]
	 */
	constructor(fqdn, app, whisperers) {
		this._fqdn         = fqdn || Constants.MatchingServerFqdn;
		this._app          = app || setExpressApp((new Router()).router, false);
		this._whisperers   = whisperers || [];
		this._server       = null;
		this._socketServer = null;
	}

	/**
	 *
	 * @param {Function|null} [cb]
	 * @param {Boolean|null} [boot]
	 */
	start(cb = nop, boot = true) {


		const init = () => {
			return new Promise((resolve, reject) => {
					if (!boot) {
						resolve();
						return;
					}

					const Bootstrapper = require('./bootstrapper');
					const bootstrapper = Bootstrapper.getInstance();

					bootstrapper.initAll()
								.then(() => require('../src/data_services').getInstance().start())
								.then(resolve)
								.catch(reject);
				}
			);
		};

		const initClientManager = () =>{

			const clientManager = ClientManager.getInstance();

			return new Promise((resolve, reject) => {
					clientManager.init()
						.then(clientManager.addClients.bind(clientManager,this._whisperers))
						.then(resolve)
						.catch(reject);
				}
			);

		};

		const startServer = () => {
			beameSDK.BaseHttpsServer(this._fqdn, {}, this._app, (data, app) => {
					logger.info(`Beame Matching server started on ${this._fqdn}`);

					this._server = app;

					let socketServer = new MatchingSocketServer(this._fqdn, this._server);

					socketServer.start().then(socketio_server => {
						this._socketServer = socketio_server;
						cb(null, app);
					}).catch(error => {
						cb(error)
					});

				},
				error => {
					cb(error);
				});
		};

		init()
			.then(initClientManager.bind(this))
			.then(startServer.bind(this))
			.catch(error=>{
				logger.error(`Matching server failure ${BeameLogger.formatError(error)}`);
				cb(error);
			});

	}

	//noinspection JSUnusedGlobalSymbols
	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}

		if (this._socketServer) {
			this._socketServer.stop();
			this._socketServer = null;
		}
	}
}


module.exports = MatchingServer;
