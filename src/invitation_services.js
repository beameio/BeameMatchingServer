/**
 * Created by zenit1 on 28/12/2016.
 */

"use strict";
const beameSDK     = require('beame-sdk');
const module_name  = "MatchingRegistrationServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
let dataService    = null;

let invitationServicesInstance = null;

class InvitationServices {
	constructor() {

		dataService = require('./data_services').getInstance();

	}

	getInvitations(appId){
		return new Promise((resolve, reject) => {
				dataService.getInvitations(appId).then(data=>{
					let rows = data.map(row=>{
						return {
							id:row.id,
							name:row.name,
							email:row.email,
							fqdn:row.fqdn,
							status:row.status,
							createdAt:row.createdAt
						}
					});

					resolve(rows);
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
				// 	fqdn:  data.fqdn,
				// 	name:data.name,
				// 	email:data.email,
				// 	userId:data.userId,
				//
				// };

				dataService.saveInvitation(data).then(record => {
						resolve({pin:record.pin,id:record.id});
					}
				).catch(error => {
					logger.error(BeameLogger.formatError(error));
					reject(error);
				});
			}
		);
	}

	findInvitation(pin){
		return new Promise((resolve, reject) => {
				dataService.findInvitation(pin).then(record=>{
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