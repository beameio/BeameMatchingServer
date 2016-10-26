/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";
const beameSDK    = require('beame-sdk');
const module_name = "Matching";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const CodeMap = require('./code_map');


class MatchingServer {

	constructor() {
		this.map        = new CodeMap();
		this.whisperers = {};
		this.clients    = {};
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

	onIdMobile(socket,data) {

		logger.debug(`Mobile is connected: ${socket.id}`);

		this.clients[socket.id] = {
			id:     socket.id,
			socket: socket,
			clientId:data.id
		};

	}

	onWhispererId(socket) {
		this.whisperers[socket.id] = {
			id:     socket.id,
			socket: socket
		};
	}

	createDevicePair(foundRecord, socket) {

		if (!foundRecord) {
			logger.debug(`Found record is null`);
			return;
		}
		logger.debug(`Found record `, {
			browseSocketId: foundRecord.browseSocketId,
			whispererFqdn:  foundRecord.whispererFqdn
		});
		socket.removeAllListeners("pincodeHeard");

		process.nextTick(()=> {

			try {

				foundRecord.socket.emit('mobile_matched', {
					browseSocketId: foundRecord.browseSocketId
				});

				this.clients[socket.id].socket.emit('start-session', {
					browseSocketId: foundRecord.browseSocketId,
					whispererFqdn:  foundRecord.whispererFqdn
				});

				this.clients[socket.id].socket.disconnect();

				delete this.clients[socket.id];

				this.map.removeSocketData(foundRecord.browseSocketId, true);
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
		let pincode = JSON.parse("[" + message.pin + "]");
		logger.debug(`onCodeHeard  ${message.pin} on socketId ${socket.id}`);
		let foundRecord = this.map.matchPinCode(pincode);
		this.createDevicePair(foundRecord, socket);
	}
}


module.exports = MatchingServer;