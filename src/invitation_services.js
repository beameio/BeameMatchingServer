/**
 * Created by zenit1 on 28/12/2016.
 */

"use strict";
const beameSDK    = require('beame-sdk');
const module_name = "MatchingRegistrationServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
let dataService   = null;

let invitationServicesInstance = null;

class InvitationServices {
	constructor() {

		dataService = require('./data_services').getInstance();

	}

	getInvitations(appId) {

		return new Promise((resolve, reject) => {
				dataService.getInvitations(appId).then(rows => {
					let payload = rows.map(row=>{
						return{
							id:row.id,
							fqdn:row.fqdn,
							status:row.status,
							createdAt:row.createdAt
						}
					});

					resolve(payload);

				}).catch(reject);
			}
		);


	}

	saveInvitation(data) {

		return new Promise((resolve, reject) => {

				// //noinspection JSValidateTypes
				// /** @type {Invitation} */
				// let invitation = {
				// 	token: data.token,
				// 	appId: data.appId,
				// 	fqdn:  data.fqdn
				//
				// };

				dataService.saveInvitation(data).then(record => {
						resolve({pin: record.pin, id: record.id});
					}
				).catch(error => {
					logger.error(BeameLogger.formatError(error));
					reject(error);
				});
			}
		);
	}

	deleteInvitation(id){
		return dataService.deleteInvitation(id);
	}


	findInvitation(pin) {
		return new Promise((resolve, reject) => {
				dataService.findInvitation(pin).then(record => {
					resolve(record.token);
				}).catch(reject);
			}
		);
	}

	static getInstance() {
		if (!invitationServicesInstance) {
			invitationServicesInstance = new InvitationServices();
		}

		return invitationServicesInstance;
	}
}

module.exports = InvitationServices;