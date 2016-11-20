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
		this._fqdn = data.whispererFqdn;

		/** @type {_codeMap} */
		this._codeMap = codeMap;

		/** @type {Socket} */
		this._socket = socket;

		/** @type {String} */
		this._socketId = socket.id;

		/** @type {Object} */
		this._socket_options = data.socket_options;

		/** @type {String} */
		this._sessionId = data.sessionId;

		/** @type {Number} */
		this._timeout = data.timeout;

		this._mode = data.mode;

		/** @type {Object} */
		this._timer = null;

	}

	disconnect() {
		logger.debug(`[${this._sessionId }] Disconnecting from socket ${this._socketId}`);
		this._codeMap.removeSocketData(this._sessionId, true);
		//noinspection JSUnfilteredForInLoop
		this._socketId  = null;
		this._socket    = null;
		this._sessionId = null;
		this._timeout   = null;
		this._clearTimer();
		this._timer = null;

	}

	_clearTimer() {
		if (this._timer) {
			clearTimeout(this._timer);
		}
	}

	/**
	 *
	 * @param {SessionData} data
	 */
	sendPin(data) {
		this._sessionId = data.sessionId;
		this._timeout   = data.timeout;

		let pinData = {
			sessionId:      this._sessionId,
			whispererFqdn:  this._fqdn,
			socket_options: this._socket_options,
			mode:           this._mode
		};

		this._codeMap.addPinCode(pinData, this._socket).then(pin => {
			logger.debug(`[${this._sessionId }] sending pincodes to socket ${this._socket.id} pin ${pin}`);

			this._socket.emit('new_pin', pin);

			this._timer = setTimeout(this.sendPin.bind(this, data), this._timeout);
		}).catch(error => {
			this._socket.emit('fail_pin', error);
		});


	}


}


module.exports = WhispererAgent;