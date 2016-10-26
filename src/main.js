/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

process.env.BEAME_LOG_LEVEL = "DEBUG";


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
const matching = new(require('./matching'))();


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

let app = setExpressApp(router, false);

beameSDK.BeameServer(config.MatchingServerFqdn, app, (data, app) => {
	logger.debug(`BeameServer callback got `, data);

	let socketio = require('socket.io')(app);

	//noinspection JSUnresolvedFunction
	socketio.of('whisperer').on('connection', matching.onWhispererConnection.bind(matching));
	//noinspection JSUnresolvedFunction
	socketio.of('whisperer').on('reconnect', matching.onReconnect.bind(matching));

	//noinspection JSUnresolvedFunction
	socketio.of('client').on('connection', matching.onClientConnection.bind(matching));

});