/**
 * Created by zenit1 on 13/11/2016.
 */
"use strict";

const fs          = require("fs");
const bodyParser  = require('body-parser');
const https       = require('https');
const config      = require('../config/config');
const express     = require('express');
const router      = require('./router');
const beameSDK    = require('beame-sdk');
const module_name = "MatchingServer";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);


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

class MatchingServer {

	/**
	 * @param {String} [fqdn]
	 * @param {Router} [app]
	 * @param {Array.<string> | null} [whisperers]
	 */
	constructor(fqdn, app, whisperers) {
		this._fqdn     = fqdn || config.MatchingServerFqdn;
		this._app      = app || setExpressApp(router, false);
		this._matching = new (require('./matching'))(this._fqdn);
		this._whisperers = whisperers || [];
		this._server   = null;
	}

	/**
	 *
	 * @param {Function|null} [cb]
	 */
	start(cb) {
		beameSDK.BaseHttpsServer(this._fqdn, {requestCert: true, rejectUnauthorized: false}, this._app, (data, app) => {
				logger.info(`Beame Matching server started on ${this._fqdn}`);

				this._server = app;

				this._matching.loadWhisperersCreds(this._whisperers).then(()=> {
					this._matching.startSocketIoServer(app);
				}).catch(()=> {
					logger.error(`no whisperers creds found`);
					this._matching.startSocketIoServer();
				});

				cb && cb(null, app);
			},
			error=> {
				cb && cb(error, null);
			});
	}

	//noinspection JSUnusedGlobalSymbols
	stop() {
		if (this._server) {
			this._server.close();
			this._server = null;
		}
	}
}


module.exports = MatchingServer;