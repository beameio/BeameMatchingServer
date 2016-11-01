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

		let pin     = WhispererAgent._getRandomPin(),
		    pinData = {
			    sessionId:     this.sessionId,
			    pincode:       pin,
			    whispererFqdn: this.fqdn
		    };

		this.codeMap.addPinCode(pinData, this.socket);

		logger.debug(`sending pincodes to socket ${this.socket.id}`, pin);

		this.socket.emit('new_pin', pin);

		this.timer = setTimeout(this.sendPin.bind(this,data), this.timeout);
	}



	/**
	 *
	 * @returns {number[]}
	 * @private
	 */
	static _getRandomPin() {
		let i,
		    dig = [9, 7, 4, 7, 11, 0];

		for (i = 0; i < 6; i++) {
			dig[i] = WhispererAgent._generateRandomNum(15, 0);
		}
		return dig;
	}

	/**
	 *
	 * @param {number} high
	 * @param {number} low
	 * @returns {number}
	 * @private
	 */
	static _generateRandomNum(high, low) {
		return Math.round(Math.random() * (high - low) + low);
	}
}


module.exports = WhispererAgent;