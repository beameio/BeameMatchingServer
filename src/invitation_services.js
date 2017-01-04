/**
 * Created by zenit1 on 28/12/2016.
 */
"use strict";

const Constants    = require('../constants');
const beameSDK     = require('beame-sdk');
const module_name  = "MatchingRegistrationServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const CommonUtils  = beameSDK.CommonUtils;
const AuthToken    = beameSDK.AuthToken;
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();
var dataService    = null;

class InvitationServices {
	constructor() {

		dataService = require('./data_services').getInstance();

	}

	saveInvitation(data) {

		return new Promise((resolve, reject) => {

				/** @type {Invitation} */
				let invitation = {
					token: data.token,
					appId: data.appId,
					fqdn:  data.fqdn
				};

				dataService.saveInvitation(invitation).then(invitation => {
						resolve(invitation);
					}
				).catch(error => {
					logger.error(BeameLogger.formatError(error));
					reject(error);
				});
			}
		);
	}
}

module.exports = InvitationServices;