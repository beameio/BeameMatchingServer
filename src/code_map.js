/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

const _               = require('underscore');
const maxFifoPinCodes = 3;
const beameSDK        = require('beame-sdk');
const module_name     = "CodeMap";
const BeameLogger     = beameSDK.Logger;
const logger          = new BeameLogger(module_name);

class CodeMap {

	constructor() {
		this.pincodes = {};
	}

	removeSocketData(key, destroySocket) {
		if (this.pincodes[key]) {
			logger.debug(`removing record for ${key}`);
			while (this.pincodes[key].length > 0) {
				var item = this.pincodes[key].node;
				this.pincodes[key].remove(item);
			}
			if (destroySocket)
				delete this.pincodes[key];
		}
	}

	addPinCode(message, socket) {

		let key = message.browseSocketId; //socket.id

		if (!this.pincodes[key]) {
			logger.debug('************************creating fifo');
			this.pincodes[key] = require('fifo')();
		}
		else {
			logger.debug("Queue length " + this.pincodes[key].length);
			while (this.pincodes[key].length > maxFifoPinCodes) {
				var item = this.pincodes[key].node;
				this.pincodes[key].remove(item);
				logger.debug(`removing item ${this.pincodes[key].length}`);
			}
		}
		logger.debug(this.pincodes[key].length);
		//noinspection JSUnresolvedVariable
		this.pincodes[key].push({
			socketId:       socket.id,
			socket:         socket,
			browseSocketId: message.browseSocketId,
			pincode:        message.pin,
			whispererFqdn:  message.whispererFqdn
		});
	}

//noinspection JSUnusedGlobalSymbols
	matchPinCode(pincode) {
		var keys = _.keys(this.pincodes);

		for (var i = 0; i < keys.length; i++) {
			var fifo = this.pincodes[keys[i]];
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
}


module.exports = CodeMap;