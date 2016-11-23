/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";
const config            = require('../config/config');
const beameSDK          = require('beame-sdk');
const module_name       = "Matching";
const BeameLogger       = beameSDK.Logger;
const CommonUtils       = beameSDK.CommonUtils;
const logger            = new BeameLogger(module_name);
const store             = new (beameSDK.BeameStore)();
const config_whisperers = require('../config/whisperers');
const WhispererAgent    = require('./whisperer_agent');
const CodeMap           = require('./code_map');

/**
 * @typedef {Object} SessionData
 * @property {String} sessionId
 * @property {Number} [timeout]
 * @property {String} whispererFqdn
 * @property {String} mode
 * @property {Object} socket_options => Whisperer server socket options
 * @property {String} matching
 * @property {String} service
 */

/**
 * @typedef {Object} Whisperer
 * @property {Credential} cred
 * @property {Object.<string, WhispererAgent>} sessions
 */

class MatchingServer {

	/**
	 * @param {String} server_fqdn
	 *
	 */
	constructor(server_fqdn) {

		/**  @type {Object.<string, Whisperer>} */
		this._whisperers = {};
		this._map     = new CodeMap();
		this._clients = {};
		this._fqdn    = server_fqdn;
	}

	/**
	 * @param {Array.<string> | null} [whisperers]
	 * @returns {Promise}
	 */
	loadWhisperersCreds(whisperers) {

		return new Promise((resolve, reject) => {

				let fqdnsArray = whisperers.concat(Object.keys(config_whisperers));

				let whisperer_fqdns = new Set(fqdnsArray);

				const total             = whisperer_fqdns.size;
				let found = 0, notfound = 0;

				const _checkCounter = () => {
					if ((found + notfound) == total) {
						found > 0 ? resolve() : reject();
					}
				};

				whisperer_fqdns.forEach(fqdn => {
					store.find(fqdn).then(cred => {

						this._whisperers[cred.getKey("FQDN")] = {cred: cred, sessions: {}};

						found++;
						_checkCounter();
					}).catch(error => {
						logger.error(error);
						notfound++;
						_checkCounter();
					})
				});

			}
		);
	}

	startSocketIoServer(app) {
		/** @type {Socket} */
		let socketio = require('socket.io')(app, {secure: true});

		socketio.of('whisperer').on('connection', this.onWhispererConnection.bind(this));
		socketio.of('whisperer').on('reconnect', this.onReconnect.bind(this));
		socketio.of('client').on('connection', this.onClientConnection.bind(this));
	}

	onWhispererConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		socket.on("id_whisperer", this.onWhispererId.bind(this, socket));

		socket.on('disconnect', this.onDisconnect.bind(this, socket));

		socket.on('create_session', this.onCreateSession.bind(this, socket));

		socket.on('stop_play', this.onStopPlay.bind(this, socket));
	}

	onClientConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		//socket.on('pincodeGenerated', _.bind(this.onCodeGenerated, this, socket))
		socket.on("pincodeHeard", this.onCodeHeard.bind(this, socket));

		socket.on("idmobile", this.onIdMobile.bind(this, socket));

		//socket.on('disconnect', this.onDisconnect.bind(this, socket));

	}

	/**
	 * @param {Socket} socket
	 * @param {SessionData} data
	 */
	onCreateSession(socket, data) {
		try {

			logger.debug(`[${data.sessionId}] create session for socket ${socket.id} , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);

			let agent = new WhispererAgent(socket, this._map, data);

			this._whisperers[data.whispererFqdn].sessions[data.sessionId] = agent;

			logger.debug(`[${data.sessionId}] sessions saved , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);

			agent.sendPin(data);
		}
		catch (error) {
			logger.error(BeameLogger.formatError(error));
		}
	}

	/**
	 *
	 * @param {Socket} socket
	 * @param {SessionData} data
	 */
	onStopPlay(socket, data) {

		logger.debug(`[${data.sessionId}] stop play received from socket ${socket.id} `);

		let agent = this._whisperers[data.whispererFqdn].sessions[data.sessionId];

		if (agent) {
			agent.disconnect();
			delete this._whisperers[data.whispererFqdn].sessions[data.sessionId];
		}
	}

	//noinspection JSMethodCanBeStatic
	onReconnect(socket) {
		logger.debug('Whisperer Socket reconnected', socket.id);
		//TODO add logic for session_id
	}

	onDisconnect(socket) {
		logger.debug(`Whisperer Socket ${socket.id} disconnected`);

		for (let key in this._whisperers) {
			//noinspection JSUnfilteredForInLoop
			for (let id in this._whisperers[key].sessions) {
				//noinspection JSUnfilteredForInLoop
				if (this._whisperers[key].sessions[id].socketId == socket.id) {
					//noinspection JSUnfilteredForInLoop
					logger.debug(`[${this._whisperers[key].sessions[id].sessionId}] disconnecting`);
					//noinspection JSUnfilteredForInLoop
					this._whisperers[key].sessions[id].disconnect();
					//noinspection JSUnfilteredForInLoop
					delete this._whisperers[key].sessions[id];
					return;
				}
			}
		}

		logger.debug(`Whisperer Socket ${socket.id} disconnected, session not found`);
	}

	onIdMobile(socket, data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this._clients[socket.id] = {
			id:         socket.id,
			socket:     socket,
			clientFqdn: data._fqdn
		};

	}

	onWhispererId(socket, data) {

		const _closeSocket = message => {
			logger.error(message);
			socket.disconnect();
		};

		if (!data) {
			return _closeSocket(`data not received on onWhispererId event`);
		}

		if (!this._whisperers[data.signedBy]) {
			return _closeSocket(`whisperer fqdn ${data.signedBy} not found`);
		}

		if (!this._whisperers[data.signedBy].cred.checkSignature(data)) {
			return _closeSocket(`whisperer ${data.signedBy} signature not valid`);
		}

	}

	/**
	 *
	 * @param {PincodeToken} pincodeObj
	 * @param {Socket} socket
	 * @param {SignatureToken|null} [signature]
	 */
	createDevicePair(pincodeObj, socket, signature) {


		logger.debug(`Found record `, {
			sessionId:     pincodeObj.sessionId,
			whispererFqdn: pincodeObj.whispererFqdn
		});

		socket.removeAllListeners("pincodeHeard");

		process.nextTick(() => {

			try {

				//send message to Whisperer
				pincodeObj.socket.emit('mobile_matched', {
					sessionId:  pincodeObj.sessionId,
					clientFqdn: this._clients[socket.id] ? this._clients[socket.id].clientFqdn : null,
					signature:  signature
				});

				//send message to Mobile
				this._clients[socket.id].socket.emit('start-session', {
					sessionId:      pincodeObj.sessionId,
					whispererFqdn:  pincodeObj.whispererFqdn,
					socket_options: pincodeObj.socket_options
				});

				if (this._clients[socket.id]) {
					//close socket with mobile
					this._clients[socket.id].socket.disconnect();
					this._clients[socket.id].socket.on('disconnect', () => {
						delete this._clients[socket.id];
					});
				}


				//clean pincodes
				this._map.removeSocketData(pincodeObj.sessionId, true);

			} catch (e) {
				return MatchingServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
			}
		});
	}

	/**
	 *
	 * @param {Socket} socket
	 * @param {String} event
	 * @param {Object|string} error
	 * @private
	 */
	static _emitError(socket, event, error) {
		logger.error(error);
		socket.emit(event, error);
	}

	/**
	 *
	 * @param {Socket} socket
	 * @param {Object} message
	 */
	onCodeHeard(socket, message) {
		let pincode = null;

		logger.debug(`code received from mobile`, message);

		/**
		 *
		 * @param {SignatureToken} [signature]
		 * @returns {*}
		 * @private
		 */
		const _onPinFound = (signature) => {
			try {
				if (!pincode) {
					return MatchingServer._emitError(socket, 'matching_error', `Pin not found `);
				}

				logger.debug(`onCodeHeard  ${pincode} on socketId ${socket.id}`);
				let pincodeObj = this._map.matchPinCode(pincode);

				if (!pincodeObj) {
					return MatchingServer._emitError(socket, 'matching_error', `Pincode not found`);
				}


				//TODO Uncomment after demo
				// if (pincodeObj.mode == config.WhispererMode.SESSION && !signature) {
				// 	return MatchingServer._emitError(socket, 'matching_error', `Signature Required`);
				// }

				this.createDevicePair(pincodeObj, socket, signature);
			} catch (e) {
				return MatchingServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
			}
		};

		//noinspection JSUnresolvedVariable
		if (message.pin) {
			//noinspection JSUnresolvedVariable
			pincode = JSON.parse("[" + message.pin + "]");
			_onPinFound();
		}
		else if (message.sign) {

			let signature = CommonUtils.parse(message.sign);

			store.find(signature.signedBy).then(creds => {
				if (!creds.checkSignature(signature)) {
					return MatchingServer._emitError(socket, 'matching_error', `Client Signature by ${signature.signedBy} not valid`);
				}

				if (!signature.signedData["pin"]) {
					return MatchingServer._emitError(socket, 'matching_error', `Pin not found in signature`);
				}

				pincode = JSON.parse("[" + signature.signedData["pin"] + "]");

				_onPinFound.call(this, CommonUtils.stringify(signature));

			}).catch(error => {
				return MatchingServer._emitError(socket, 'matching_error', BeameLogger.formatError(error));
			});
		}
		else {
			return MatchingServer._emitError(socket, 'matching_error', `Pincode required`);
		}
	}


}


module.exports = MatchingServer;