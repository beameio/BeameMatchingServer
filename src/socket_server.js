/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";
const beameSDK        = require('beame-sdk');
const module_name     = "Matching";
const BeameLogger     = beameSDK.Logger;
const CommonUtils     = beameSDK.CommonUtils;
const logger          = new BeameLogger(module_name);
const store           = new (beameSDK.BeameStore)();
const WhispererAgent  = require('./whisperer_agent');
const ApprovalAgent   = require('./approval_agent');
const CodeMap         = require('./code_map');
const ApprovalCodeMap = require('./approval_code_map');
const ClientManager   = require('./client_manager');

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

let matchingSocketServer;

class MatchingSocketServer {

	/**
	 * @param {String} server_fqdn
	 * @param {Server} srv
	 */
	constructor(server_fqdn, srv) {

		/**  @type {Object.<string, Whisperer>} */
		this._whisperers = {};
		this._server           = srv;
		this._map              = new CodeMap();
		this._approval_map     = new ApprovalCodeMap();
		this._clients          = {};
		this._register_clients = {};
		this._fqdn             = server_fqdn;
		this._clientManager    = ClientManager.getInstance();

		matchingSocketServer = this;
	}

	start() {

		const _startSocketServer = () => {

			/** @type {Socket} */
			let socketio = require('socket.io')(this._server, {secure: true});

			socketio.of('whisperer').on('connection', this._onWhispererConnection.bind(this));
			socketio.of('whisperer').on('reconnect', this._onWhispererReconnect.bind(this));
			socketio.of('client').on('connection', this._onClientConnection.bind(this));

			socketio.of('approve').on('connection', this._onApprovalConnection.bind(this));
			socketio.of('register').on('connection', this._onRegisterClientConnection.bind(this));

			this._socketioServer = socketio;

			logger.info(`Socket Server started on ${this._fqdn}`);

			return Promise.resolve(this._socketioServer);
		};

		return this._loadWhisperersCreds()
			.then(_startSocketServer.bind(this));
	}


	addClient(fqdn) {
		return new Promise((resolve, reject) => {

				if (this._whisperers[fqdn]) {
					resolve();
				}

				store.find(fqdn).then(cred => {

					this._whisperers[fqdn] = {cred: cred, sessions: {}, approval_sessions: {}};

					logger.info(`${fqdn}client added to matching socketio server`);

					resolve();
				}).catch(error => {
					logger.error(error);
					reject(error);
				})
			}
		);
	}

	_loadWhisperersCreds() {

		return new Promise((resolve, reject) => {

				let fqdnsArray = this._clientManager.clients;

				let whisperer_fqdns = new Set(fqdnsArray);

				const total             = whisperer_fqdns.size;

				if(total == 0){
					resolve();
					return;
				}

				let found = 0, notfound = 0;

				const _checkCounter = () => {
					if ((found + notfound) == total) {
						found > 0 ? resolve() : reject();
					}
				};

				whisperer_fqdns.forEach(fqdn => {

					this.addClient(fqdn)
						.then(() => {
							found++;
							_checkCounter();
						})
						.catch(() => {
							notfound++;
							_checkCounter();

						})
				});

			}
		);
	}

	//region pairing whisperer
	_onWhispererConnection(socket) {
		logger.debug("Whisperer Socketio connection");

		socket.on("id_whisperer", this._onWhispererId.bind(this, socket));

		socket.on('disconnect', this._onWhispererDisconnect.bind(this, socket));

		socket.on('create_session', this._onWhispererCreateSession.bind(this, socket));

		socket.on('stop_play', this._onWhispererStopPlay.bind(this, socket));

		socket.emit('your_id');
	}

	/**
	 * @param {Socket} socket
	 * @param {SessionData} data
	 */
	_onWhispererCreateSession(socket, data) {
		try {

			logger.debug(`[${data.sessionId}] create session for socket ${socket.id} , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);

			let agent = new WhispererAgent(socket, this._map, data);

			this._whisperers[data.whispererFqdn].sessions[data.sessionId] = agent;

			logger.debug(`[${data.sessionId}] sessions saved , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);
			agent.setQrDataListener();
			agent.sendPin(data);
		}
		catch (error) {
			logger.error(error.message);
		}
	}

	/**
	 *
	 * @param {Socket} socket
	 * @param {SessionData} data
	 */
	_onWhispererStopPlay(socket, data) {

		logger.debug(`[${data.sessionId}] stop play received from socket ${socket.id} `);

		let agent = this._whisperers[data.whispererFqdn].sessions[data.sessionId];

		if (agent) {
			agent.disconnect();
			delete this._whisperers[data.whispererFqdn].sessions[data.sessionId];
		}
	}

	//noinspection JSMethodCanBeStatic
	_onWhispererReconnect(socket) {
		logger.debug('Whisperer Socket reconnected', socket.id);
		//TODO add logic for session_id
	}

	_onWhispererDisconnect(socket) {
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

	_onWhispererId(socket, data) {

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

	//endregion

	//region pairing client
	_onClientConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		//socket.on('pincodeGenerated', _.bind(this.onCodeGenerated, this, socket))
		socket.on("pincodeHeard", this._onClientCodeHeard.bind(this, socket));

		socket.on("idmobile", this._onClientIdMobile.bind(this, socket));

		socket.on("okToClose", function () {
			socket.disconnect();
		});

		//socket.on('disconnect', this.onDisconnect.bind(this, socket));

	}

	_onClientIdMobile(socket, data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this._clients[socket.id] = {
			id:         socket.id,
			socket:     socket,
			clientFqdn: data._fqdn
		};

	}

	/**
	 *
	 * @param {PincodeToken} pincodeObj
	 * @param {Socket} socket
	 * @param {SignatureToken|null} [signature]
	 */
	_clientCreateDevicePair(pincodeObj, socket, signature) {


		logger.debug(`Found record `, {
			sessionId:     pincodeObj.sessionId,
			whispererFqdn: pincodeObj.whispererFqdn
		});

		socket.removeAllListeners("pincodeHeard");

		process.nextTick(() => {

			try {
				//send message to Mobile
				if (pincodeObj.qrData && Object.keys(pincodeObj.qrData).length > 3) {
					console.log('Matching to mobile: session_data');
					this._clients[socket.id].socket.emit('session_data', JSON.stringify(pincodeObj.qrData));
				}
				else {
					//send message to Whisperer
					pincodeObj.socket.emit('mobile_matched', {
						sessionId:  pincodeObj.sessionId,
						clientFqdn: this._clients[socket.id] ? this._clients[socket.id].clientFqdn : null,
						signature:  signature
					});

					this._clients[socket.id].socket.emit('start-session', {
						sessionId:      pincodeObj.sessionId,
						whispererFqdn:  pincodeObj.whispererFqdn,
						socket_options: pincodeObj.socket_options
					});
				}

				if (this._clients[socket.id]) {
					//close socket with mobile
					//this._clients[socket.id].socket.disconnect();
					this._clients[socket.id].socket.on('disconnect', () => {
						delete this._clients[socket.id];
					});
				}


				//clean pincodes
				//this._map.removeSocketData(pincodeObj.sessionId, true);

			} catch (e) {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
			}
		});
	}

	/**
	 *
	 * @param {Socket} socket
	 * @param {Object} message
	 */
	_onClientCodeHeard(socket, message) {
		let pincode = null;

		logger.info(`code received from mobile`, message);

		/**
		 *
		 * @param {SignatureToken} [signature]
		 * @returns {*}
		 * @private
		 */
		const _onPinFound = (signature) => {
			try {
				if (!pincode) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Pin not found `);
				}

				logger.debug(`onCodeHeard  ${pincode} on socketId ${socket.id}`);
				let pincodeObj = this._map.matchPinCode(pincode);

				if (!pincodeObj) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Pincode not found`);
				}


				//TODO Uncomment after demo
				// if (pincodeObj.mode == config.WhispererMode.SESSION && !signature) {
				// 	return MatchingSocketServer._emitError(socket, 'matching_error', `Signature Required`);
				// }

				this._clientCreateDevicePair(pincodeObj, socket, signature);
			} catch (e) {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
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
					return MatchingSocketServer._emitError(socket, 'matching_error', `Client Signature by ${signature.signedBy} not valid`);
				}

				if (!signature.signedData["pin"]) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Pin not found in signature`);
				}

				pincode = JSON.parse("[" + signature.signedData["pin"] + "]");

				_onPinFound.call(this, CommonUtils.stringify(signature));

			}).catch(error => {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(error));
			});
		}
		else {
			return MatchingSocketServer._emitError(socket, 'matching_error', `Pincode required`);
		}
	}

	//endregion

	//region approval
	_onApprovalConnection(socket) {
		logger.debug("Approval Socketio connection");

		socket.on("id_approver", this._onWhispererId.bind(this, socket));

		socket.on('disconnect', this._onWhispererDisconnect.bind(this, socket));

		socket.on('create_session', this._onApprovalCreateSession.bind(this, socket));

		socket.emit('your_id');
	}

	// _onApprovalId(socket, data) {
	//
	// 	const _closeSocket = message => {
	// 		logger.error(message);
	// 		socket.disconnect();
	// 	};
	//
	// 	if (!data) {
	// 		return _closeSocket(`data not received on onApproverId event`);
	// 	}
	//
	// 	if (!this._whisperers[data.signedBy]) {
	// 		return _closeSocket(`Approver fqdn ${data.signedBy} not found`);
	// 	}
	//
	// 	if (!this._whisperers[data.signedBy].cred.checkSignature(data)) {
	// 		return _closeSocket(`whisperer ${data.signedBy} signature not valid`);
	// 	}
	//
	// }

	/**
	 * @param {Socket} socket
	 * @param {SessionData} data
	 */
	_onApprovalCreateSession(socket, data) {

		try {

			logger.debug(`[${data.sessionId}] create session for socket ${socket.id} , current total ${Object.keys(this._whisperers[data.approverFqdn].sessions).length} sessions`);

			let agent = new ApprovalAgent(socket, this._approval_map, data);

			this._whisperers[data.approverFqdn].sessions[data.sessionId] = agent;

			logger.debug(`[${data.sessionId}] sessions saved , current total ${Object.keys(this._whisperers[data.approverFqdn].sessions).length} sessions`);
			agent.setQrDataListener();
		}
		catch (error) {
			logger.error(error.message);
		}
	}

	// _onApprovalDisconnect(socket) {
	// 	logger.debug(`Whisperer Socket ${socket.id} disconnected`);
	//
	// 	for (let key in this._whisperers) {
	// 		//noinspection JSUnfilteredForInLoop
	// 		for (let id in this._whisperers[key].approval_sessions) {
	// 			//noinspection JSUnfilteredForInLoop
	// 			if (this._whisperers[key].approval_sessions[id].socketId == socket.id) {
	// 				//noinspection JSUnfilteredForInLoop
	// 				logger.debug(`[${this._whisperers[key].approval_sessions[id].sessionId}] disconnecting`);
	// 				//noinspection JSUnfilteredForInLoop
	// 				this._whisperers[key].approval_sessions[id].disconnect();
	// 				//noinspection JSUnfilteredForInLoop
	// 				delete this._whisperers[key].approval_sessions[id];
	// 				return;
	// 			}
	// 		}
	// 	}
	//
	// 	logger.debug(`Whisperer Socket ${socket.id} disconnected, session not found`);
	// }

	//endregion

	//region register client
	_onRegisterClientConnection(socket) {
		logger.debug("Register Socketio connection");

		socket.emit('your_id');

		socket.on("pincode", this._onRegisterClientPincode.bind(this, socket));

		socket.on("idmobile", this._onRegisterClientIdMobile.bind(this, socket));

		socket.on("okToClose", () => {
			socket.disconnect();
		});


	}

	_registerClientCreateDevicePair(pincodeObj, socket, token) {

		socket.removeAllListeners("pincode");

		process.nextTick(() => {

			try {
				//send message to Mobile
				if (pincodeObj.qrData && pincodeObj.token && Object.keys(pincodeObj.qrData).length > 3) {
					console.log('Matching to mobile: session_data');
					let mobileData = JSON.stringify({qrData: pincodeObj.qrData, token: pincodeObj.token});
					this._register_clients[socket.id].socket.emit('session_data', mobileData);
				}
				else {
					//send message to Whisperer
					pincodeObj.socket.emit('mobile_matched', {
						sessionId:  pincodeObj.sessionId,
						clientFqdn: this._register_clients[socket.id] ? this._register_clients[socket.id].clientFqdn : null,
						token:      token
					});

					this._register_clients[socket.id].socket.emit('start-session', {
						sessionId: pincodeObj.sessionId
					});
				}

				if (this._register_clients[socket.id]) {

					this._register_clients[socket.id].socket.on('disconnect', () => {
						delete this._register_clients[socket.id];
					});
				}


				//clean pincodes
				//this._map.removeSocketData(pincodeObj.sessionId, true);

			} catch (e) {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
			}
		});
	}

	_onRegisterClientPincode(socket, message) {
		let pincode = null;

		logger.info(`register pincode received from mobile`, message);

		/**
		 *
		 * @param {SignatureToken} [signature]
		 * @returns {*}
		 * @private
		 */
		const _onPinFound = (signature) => {
			try {
				if (!pincode) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Pin not found `);
				}

				logger.debug(`on register pin  ${pincode} on socketId ${socket.id}`);

				this._approval_map.matchPinCode(pincode).then(pincodeObj => {
					this._registerClientCreateDevicePair(pincodeObj, socket, signature);
				}).catch(error => {
					MatchingSocketServer._emitError(socket, 'matching_error', error);
				});

			} catch (e) {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(e));
			}
		};

		//noinspection JSUnresolvedVariable
		if (message.pin) {
			//noinspection JSUnresolvedVariable
			pincode = message.pin;
			_onPinFound();
		}
		else if (message.sign) {

			let signature = CommonUtils.parse(message.sign);

			store.find(signature.signedBy).then(creds => {
				if (!creds.checkSignature(signature)) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Client Signature by ${signature.signedBy} not valid`);
				}

				if (!signature.signedData["pin"]) {
					return MatchingSocketServer._emitError(socket, 'matching_error', `Pin not found in signature`);
				}

				pincode = JSON.parse("[" + signature.signedData["pin"] + "]");

				_onPinFound.call(this, CommonUtils.stringify(signature));

			}).catch(error => {
				return MatchingSocketServer._emitError(socket, 'matching_error', BeameLogger.formatError(error));
			});
		}
		else {
			return MatchingSocketServer._emitError(socket, 'matching_error', `Pincode required`);
		}
	}

	_onRegisterClientIdMobile(socket, data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this._register_clients[socket.id] = {
			id:         socket.id,
			socket:     socket,
			clientFqdn: data._fqdn
		};

	}

	//endregion

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
	 * @returns {MatchingSocketServer}
	 */
	static getInstance() {

		return matchingSocketServer;
	}

}

module.exports = MatchingSocketServer;