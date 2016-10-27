/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";
const beameSDK    = require('beame-sdk');
const module_name = "Matching";
const BeameLogger = beameSDK.Logger;
const CommonUtils = beameSDK.CommonUtils;
const logger      = new BeameLogger(module_name);
const store       = new (beameSDK.BeameStore)();

const CodeMap = require('./code_map');


class MatchingServer {

	constructor(server_fqdn) {
		this.map        = new CodeMap();
		this.whisperers = {};
		this.clients    = {};
		this.fqdn       = server_fqdn;
		this.creds      = store.getCredential(this.fqdn);
	}

	onWhispererConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		socket.on("id_whisperer", this.onWhispererId.bind(this, socket));

		socket.on('disconnect', this.onDisconnect.bind(this, socket));

		socket.on('add_pincode', this.onPinAdded.bind(this, socket));
	}

	onClientConnection(socket) {
		logger.debug("Socketio connection");

		socket.emit('your_id');

		//socket.on('pincodeGenerated', _.bind(this.onCodeGenerated, this, socket))
		socket.on("pincodeHeard", this.onCodeHeard.bind(this, socket));

		socket.on("idmobile", this.onIdMobile.bind(this, socket));

		socket.on('disconnect', this.onDisconnect.bind(this, socket));

	}

	onPinAdded(socket, data) {
		logger.debug(`*****************************************PIN CODE ADDED*************************`, data);

		this.map.addPinCode(data, socket);
	}

	//noinspection JSMethodCanBeStatic
	onReconnect(socket) {
		logger.debug('Socket reconnected', socket.id);
		//TODO add logic for session_id
	}

	onDisconnect(socket) {
		logger.debug('Socket disconnected', socket.id);
		if (this.whisperers[socket.id]) {
			delete this.whisperers[socket.id];
		}
	}

	onIdMobile(socket, data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this.clients[socket.id] = {
			id:         socket.id,
			socket:     socket,
			clientFqdn: data.fqdn
		};

	}

	onWhispererId(socket) {
		this.whisperers[socket.id] = {
			id:     socket.id,
			socket: socket
		};
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
					clientFqdn: this.clients[socket.id].clientFqdn,
					signature:  signature
				});

				//send message to Mobile
				this.clients[socket.id].socket.emit('start-session', {
					sessionId:     pincodeObj.sessionId,
					whispererFqdn: pincodeObj.whispererFqdn
				});

				//close socket with mobile
				this.clients[socket.id].socket.disconnect();

				delete this.clients[socket.id];

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

		logger.debug(`code received from mobile`,message);

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