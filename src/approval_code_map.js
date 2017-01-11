/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const beameSDK           = require('beame-sdk');
const module_name        = "CodeMap";
const BeameLogger        = beameSDK.Logger;
const logger             = new BeameLogger(module_name);
const InvitationServices = require('./invitation_services');

class ApprovalCodeMap {

	constructor() {
		this._invitationServices = InvitationServices.getInstance();
		this._pincodes           = {};
	}

	removeSocketData(key, destroySocket) {
		if (this._pincodes[key]) {

			if (destroySocket) {
				delete this._pincodes[key];
			}

		}
	}

	addQrData(token, qrData, socket, sessionId) {

		this._pincodes[qrData.pin] = {
			socketId:  socket.id,
			socket:    socket,
			sessionId: sessionId,
			qrData:    qrData,
			token
		};
	}


	/**
	 * @param {Array.<number>}  pincode
	 * @returns {PincodeToken|null}
	 */
	matchPinCode(pincode) {

		return new Promise((resolve, reject) => {

				const _onPinMatched = (data) => {

					// let record = data;
					var found = (this._pincodes[pincode])?this._pincodes[pincode]:{};
					if(data){//TODO recovery if no qrData but mobile got cert (and userImage required)
						found.token = data;
						resolve(found);
					}
					else{
						reject(`Approval session not found`);
					}
				};

				const _onPinMatchFailed = error => {
					logger.error(`Register pincode ${pincode} failed with ${BeameLogger.formatError(error)}`);
					reject(`Pincode not found`);
				};

				this._invitationServices.findInvitation(pincode)
					.then((data)=>{_onPinMatched(data)})
					.catch(_onPinMatchFailed.bind(this));
			}
		);
	}

}


module.exports = ApprovalCodeMap;