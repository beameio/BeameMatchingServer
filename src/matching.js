/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";
const beameSDK       = require('beame-sdk');
const module_name    = "Matching";
const BeameLogger    = beameSDK.Logger;
const CommonUtils    = beameSDK.CommonUtils;
const logger         = new BeameLogger(module_name);
const store          = new (beameSDK.BeameStore)();
const whisperers     = require('../config/whisperers');
const WhispererAgent = require('./whisperer_agent');
const CodeMap        = require('./code_map');

/**
 * @typedef {Object} SessionData
 * @property {String} sessionId
 * @property {Number} [timeout]
 * @property {String} whispererFqdn
 */

/**
 * @typedef {Object} Whisperer
 * @property {Credential} cred
 * @property {Object.<string, WhispererAgent>} sessions
 */

class MatchingServer {

	constructor(server_fqdn) {
		this.map = new CodeMap();
		/**  @type {Object.<string, Whisperer>} */
		this._whisperers = {};
		this._clients = {};
		this.fqdn     = server_fqdn;
	}

	loadWhisperersCreds() {

		return new Promise((resolve, reject) => {

				const total             = Object.keys(whisperers).length;
				let found = 0, notfound = 0;

				const _checkCounter = ()=> {
					if ((found + notfound) == total) {
						found > 0 ? resolve() : reject();
					}
				};

				for (let key in whisperers) {
					//noinspection JSUnfilteredForInLoop
					store.find(key).then(cred=> {

						this._whisperers[cred.fqdn] = {cred: cred, sessions: {}};

						found++;
						_checkCounter();
					}).catch(error=> {
						logger.error(error);
						notfound++;
						_checkCounter();
					})
				}
			}
		);
	}

	startSocketIoServer(app) {
		/** @type {Socket} */
		let socketio = require('socket.io')(app, {secure: true});

		socketio.of('whisperer').on('connect', this.onWhispererConnection.bind(this));
		socketio.of('whisperer').on('reconnect', this.onReconnect.bind(this));
		socketio.of('client').on('connection', this.onClientConnection.bind(this));
	}

	onWhispererConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		socket.on("id_whisperer", this.onWhispererId.bind(this, socket));

		socket.on('disconnect', this.onDisconnect.bind(this, socket));

		socket.on('create_session', this.onCreateSession.bind(this, socket));

		socket.on('stop_play', this.onStopPlay.bind(this,socket));
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

			logger.debug(`session ${data.sessionId} creating for socket ${socket.id} , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);

			let agent = new WhispererAgent(socket, this.map, data);

			this._whisperers[data.whispererFqdn].sessions[data.sessionId] = agent;

			logger.debug(`sessions saved , current total ${Object.keys(this._whisperers[data.whispererFqdn].sessions).length} sessions`);

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
	onStopPlay(socket,data) {

		logger.debug(`stop play received from socket ${socket.id} on session ${data.sessionId}`);

		let agent = this._whisperers[data.whispererFqdn].sessions[data.sessionId];

		if(agent){
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
					this._whisperers[key].sessions[id].disconnect();
					//noinspection JSUnfilteredForInLoop
					delete this._whisperers[key].sessions[id];
					return;
				}
			}


		}
	}

	onIdMobile(socket, data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this._clients[socket.id] = {
			id:         socket.id,
			socket:     socket,
			clientFqdn: data.fqdn
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
	 * @param {Object} socket
	 * @param {String|null} [signature]
	 */
	createDevicePair(pincodeObj, socket, signature) {


		logger.debug(`Found record `, {
			sessionId:     pincodeObj.sessionId,
			whispererFqdn: pincodeObj.whispererFqdn
		});
		socket.removeAllListeners("pincodeHeard");

		process.nextTick(()=> {

			try {

				//send message to Whisperer
				pincodeObj.socket.emit('mobile_matched', {
					sessionId:  pincodeObj.sessionId,
					clientFqdn: this._clients[socket.id].clientFqdn,
					signature:  signature
				});

				//send message to Mobile
				this._clients[socket.id].socket.emit('start-session', {
					sessionId:     pincodeObj.sessionId,
					whispererFqdn: pincodeObj.whispererFqdn
				});

				//close socket with mobile
				this._clients[socket.id].socket.disconnect();

				delete this._clients[socket.id];

				//clean pincodes
				this.map.removeSocketData(pincodeObj.sessionId, true);

			} catch (e) {
				logger.error(e);
			}
		});


	}

	/**
	 *
	 * @param {Object} socket
	 * @param {Object} message
	 */
	onCodeHeard(socket, message) {
		let pincode = null;

		logger.debug(`code received from mobile`, message);

		function _onPinFound(signature) {
			try {
				if (!pincode) {
					logger.error(`Pin not found `);
					return;
				}

				logger.debug(`onCodeHeard  ${pincode} on socketId ${socket.id}`);
				let pincodeObj = this.map.matchPinCode(pincode);

				if (!pincodeObj) {
					logger.debug(`Pincode not found`);
					return;
				}

				this.createDevicePair(pincodeObj, socket, signature);
			} catch (e) {
				logger.error(e);
			}
		}

		if (message.pin) {
			//noinspection JSUnresolvedVariable
			pincode = JSON.parse("[" + message.pin + "]");
			_onPinFound();
		}
		else if (message.sign) {

			let signature = CommonUtils.parse(message.sign);

			store.find(signature.signedBy).then(creds=> {
				if (!creds.checkSignature(signature)) {
					logger.error(`Client Signature by ${signature.signedBy} not valid`);
					return;
				}

				if (!signature.signedData["pin"]) {
					logger.error(`Pin not found in signature`, signature);
					return;
				}

				pincode = JSON.parse("[" + signature.signedData["pin"] + "]");

				_onPinFound.call(this, CommonUtils.stringify(signature));

			}).catch(()=> {

			});
		}
	}


}


module.exports = MatchingServer;