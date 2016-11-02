/**
 * Created by zenit1 on 31/10/2016.
 */
"use strict";
const beameSDK    = require('beame-sdk');
const module_name = "WhispererAgent";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

class WhispererAgent {
	/**
	 * @param {Socket} socket
	 * @param {CodeMap} codeMap
	 * @param {SessionData} data
	 */
	constructor(socket, codeMap, data) {

		/** @type {String} */
		this.fqdn = data.whispererFqdn;

		/** @type {codeMap} */
		this.codeMap = codeMap;

		/** @type {Socket} */
		this.socket = socket;

		/** @type {String} */
		this.socketId = socket.id;

		/** @type {String} */
		this.sessionId = data.sessionId;

		/** @type {Number} */
		this.timeout = data.timeout;

		/** @type {Object} */
		this.timer = null;

	}

	disconnect() {
		logger.debug(`[${this.sessionId }] Disconnecting from socket ${this.socketId}`);
		this.codeMap.removeSocketData(this.sessionId, true);
		//noinspection JSUnfilteredForInLoop
		this.socketId  = null;
		this.socket    = null;
		this.sessionId = null;
		this.timeout   = null;
		this._clearTimer();
		this.timer = null;

	}

	_clearTimer() {
		if (this.timer) {
			clearTimeout(this.timer);
		}
	}

	/**
	 *
	 * @param {SessionData} data
	 */
	sendPin(data) {
		this.sessionId = data.sessionId;
		this.timeout   = data.timeout;

		let pinData = {
			sessionId:     this.sessionId,
			whispererFqdn: this.fqdn
		};

		this.codeMap.addPinCode(pinData, this.socket).then(pin=> {
			logger.debug(`[${this.sessionId }] sending pincodes to socket ${this.socket.id} pin ${pin}`);

			this.socket.emit('new_pin', pin);

			this.timer = setTimeout(this.sendPin.bind(this, data), this.timeout);
		}).catch(error=> {
			this.socket.emit('fail_pin', error);
		});


	}


}


module.exports = WhispererAgent;