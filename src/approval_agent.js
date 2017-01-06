/**
 * Created by zenit1 on 31/10/2016.
 */
"use strict";
const beameSDK           = require('beame-sdk');
const module_name        = "ApprovalAgent";
const BeameLogger        = beameSDK.Logger;
const logger             = new BeameLogger(module_name);
const InvitationServices = require('./invitation_services');

class ApprovalAgent {
	/**
	 * @param {Socket} socket
	 * @param {ApprovalCodeMap} codeMap
	 * @param {SessionData} data
	 */
	constructor(socket, codeMap, data) {

		this._invitationServices = InvitationServices.getInstance();

		/** @type {_codeMap} */
		this._codeMap = codeMap;

		/** @type {Socket} */
		this._socket = socket;

		/** @type {String} */
		this._socketId = socket.id;

		/** @type {String} */
		this._sessionId = data.sessionId;

	}

	disconnect() {
		logger.debug(`[${this._sessionId }] Disconnecting from socket ${this._socketId}`);
		this._codeMap.removeSocketData(this._sessionId, true);
		//noinspection JSUnfilteredForInLoop
		this._socketId  = null;
		this._socket    = null;
		this._sessionId = null;
		this._qrData    = {};
	}

	setQrDataListener() {
		if (this._socket) {
			this._socket.on('qrData', (data) => {
				logger.log('Approval got QR data:', data);
				let qrData = JSON.parse(data);

				if (!qrData.pin) {
					this._socket.emit('approval_error', {message: `Pincode required`});
				}

				const _onPinMatched = invitation => {

					this._qrData = qrData;

					if (this._codeMap) {
						this._codeMap.addQrData(invitation.token, this._qrData, this._socket, this._sessionId);
					}
				};

				const _onPinMatchFailed = error => {
					logger.error(`Approval pincode ${qrData.pin} failed with ${BeameLogger.formatError(error)}`);
					this._socket.emit('approval_error', {message: `Invitation ${qrData.pin} not found`});
				};

				this._invitationServices.findInvitation(qrData.pin)
					.then(_onPinMatched.bind(this))
					.catch(_onPinMatchFailed.bind(this));
			});
		}
	}

}


module.exports = ApprovalAgent;