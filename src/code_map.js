/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

/**
 * @typedef {Object} PincodeToken
 * @property {String} socketId
 * @property {Object} socket
 * @property {String} sessionId
 * @property {String} whispererFqdn
 * @property {Array.<number>} pincode
 */

const _                    = require('underscore');
const maxFifoPinCodes      = 3;
const codeGeneratorRetries = 10;
const beameSDK             = require('beame-sdk');
const module_name          = "CodeMap";
const BeameLogger          = beameSDK.Logger;
const logger               = new BeameLogger(module_name);

class CodeMap {

	constructor() {
		this._sessionPincodes = {}
		this._pincodes        = {};
	}

	removeSocketData(key, destroySocket) {
		if (this._sessionPincodes[key]) {

			while (this._sessionPincodes[key].length > 0) {
				var item = this._sessionPincodes[key].node;
				this._sessionPincodes[key].remove(item);
				delete this._pincodes[item.value.pincode.toString()];
			}

			if (destroySocket) {
				delete this._sessionPincodes[key];
			}

		}
	}

	addPinCode(message, socket) {

		return new Promise((resolve, reject) => {


				const _addPin = (pincode)=> {

					let key = message.sessionId; //socket.id

					if (!this._sessionPincodes[key]) {
						logger.debug(`[${key}] creating que`);
						this._sessionPincodes[key] = require('fifo')();
					}
					else {
						while (this._sessionPincodes[key].length > maxFifoPinCodes) {
							let item = this._sessionPincodes[key].node;

							let pin = item.pincode;

							this._sessionPincodes[key].remove(item);

							delete this._pincodes[pin.toString()];
						}
					}
					//noinspection JSUnresolvedVariable
					this._sessionPincodes[key].push({
						socketId:      socket.id,
						socket:        socket,
						sessionId:     message.sessionId,
						pincode:       pincode,
						whispererFqdn: message.whispererFqdn
					});

					this._pincodes[pincode.toString()] = {
						socketId:      socket.id,
						socket:        socket,
						sessionId:     message.sessionId,
						whispererFqdn: message.whispererFqdn
					};

					resolve(pincode);
				};

				this._generatePincode(codeGeneratorRetries, (error, pincode)=> {
					if (error) {
						logger.error(`[${message.sessionId} code generation failed on ${codeGeneratorRetries} attempts`);
						reject(`Code generation failure`);
					}
					else {
						_addPin(pincode);
					}
				});

			}
		);

	}

	_generatePincode(retries, cb) {
		retries--;

		if (retries == 0) {
			cb(`code generation failed`, null);
		}
		else {
			let pin = CodeMap._getRandomPin();

			if (this._pincodes[pin.toString()]) {
				this._generatePincode(retries, cb);
			}
			else {
				cb(null, pin);
			}
		}
	}

	/**
	 * @param {Array.<number>}  pincode
	 * @returns {PincodeToken|null}
	 */
	matchPinCode(pincode) {

		let record = this._pincodes[pincode.toString()];

		if (record) {
			return {
				socketId:      record.socketId,
				socket:        record.socket,
				sessionId:     record.sessionId,
				pincode:       pincode,
				whispererFqdn: record.whispererFqdn
			}
		}
		else {
			//old method for recovery, TODO remove after tests
			var keys = _.keys(this._sessionPincodes);
			for (var i = 0; i < keys.length; i++) {
				var fifo = this._sessionPincodes[keys[i]];
				var node = fifo.node;
				while (node) {
					console.log('>>' + node.value.pincode + '>>' + pincode);
					if (_.isEqual(node.value.pincode, pincode)) {
						logger.debug("Bingo!");
						return node.value;
					}
					node = fifo.next(node);
				}
			}
		}

		return null;
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
			dig[i] = CodeMap._generateRandomNum(15, 0);
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


module.exports = CodeMap;