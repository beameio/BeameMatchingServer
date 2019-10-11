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

class InvitationNotFound extends Error {}

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

	static deleteInvitation(id){
		return dataService.deleteInvitation(id);
	}

	static markInvitationAsCompleted(fqdn){
		return dataService.markInvitationAsCompleted(fqdn);
	}

	async findInvitation(pin) {
		const record = await dataService.findInvitation(pin);
		if (!record) {
			throw new InvitationNotFound(`Invitation for PIN ${pin} found.`)
		}
		return record.token;
	}

	static getInstance() {
		if (!invitationServicesInstance) {
			invitationServicesInstance = new InvitationServices();
		}

		return invitationServicesInstance;
	}

}

InvitationServices.InvitationNotFound = InvitationNotFound;

module.exports = InvitationServices;
