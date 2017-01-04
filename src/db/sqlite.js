/**
 * Created by zenit1 on 15/11/2016.
 */
"use strict";

const Sequelize    = require('sequelize');
const beameSDK     = require('beame-sdk');
const module_name  = "SqliteServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const bootstrapper = new (require('../bootstrapper'))();

function onError(reject, error) {
	logger.error(BeameLogger.formatError(error), error);
	reject(error);
}

class SqliteServices {
	/**
	 * @param {DataServicesSettings} options
	 */
	constructor(options) {

		let config = bootstrapper.sqliteConfig;

		if (!config) {
			logger.error(`Sqlite config file not found`);
			return;
		}

		this._options = options;

		const models = require("../../models/index");

		this._sequelize = models.sequelize;

	}

	start() {
		return new Promise((resolve, reject) => {
				this._sequelize.sync().then(() => {

					this._models = {
						invitation: this._sequelize.models["Invitation"]
					};

					logger.info(`Sqlite services started`);

					resolve()
				}).catch(reject);
			}
		);
	}

	//region registration services
	getInvitations(appId) {
		return new Promise((resolve) => {
				logger.debug(`try fetch registrations`);
				let model = this._models.invitation;

				//noinspection JSUnresolvedFunction
				model.findAll({order: 'id DESC'}).then(models => {
						let records = models.map(item => {
							return item.dataValues
						});
						resolve(records);
					}
				).catch(
					error => {
						logger.error(error);
						resolve([]);
					}
				);
			}
		);
	}

	/**
	 * @param {Invitation} data
	 * @returns {Promise.<Invitation>}
	 */
	saveInvitation(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.invitation;

				try {
					//noinspection JSUnresolvedFunction
					model.create(data).then(record => {
						resolve(record.dataValues);
					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	/**
	 * @param {RegistrationData} data
	 * @returns {Promise.<Registration|null>}
	 */
	isRegistrationExists(data) {
		return new Promise((resolve, reject) => {

				let model = this._models.invitation;

				try {
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							email:          data.email,
							name:           data.name,
							externalUserId: data.user_id
						}
					}).then(record => {
						resolve(record ? record.dataValues : null);
					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					onError(reject, error)
				}
			}
		);
	}

	deleteRegistration(id) {
		return new Promise((resolve, reject) => {
				logger.debug(`try delete registration ${id}`);
				let model = this._models.invitation;
				model.destroy({where: {id: id}}).then(resolve).catch(reject);
			}
		);
	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise.<Registration>}
	 */
	markRegistrationAsCompleted(fqdn) {
		return new Promise((resolve, reject) => {
				try {
					let model = this._models.invitation;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							fqdn: fqdn
						}
					}).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}

						record.update({completed: true}).then(record => {
							resolve(record.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	updateRegistrationFqdn(hash, fqdn) {

	}

	/**
	 *
	 * @param id
	 * @param {SignatureToken|String} sign
	 */
	updateRegistrationHash(id, sign) {
		return new Promise((resolve, reject) => {
				try {
					let registration = this._models.invitation;
					//noinspection JSUnresolvedFunction
					registration.findById(id).then(record => {
						if (!record) {
							reject(logger.formatErrorMessage(`Registration record not found`));
							return;
						}

						var signObj = CommonUtils.parse(sign);

						if (signObj == null) {
							onError(reject, new Error(`invalid auth token`));
							return;
						}
						//noinspection JSValidateTypes
						/** @type {SignedData}*/
						let signedData = signObj.signedData,
						    hash       = signedData.data,
						    valid_till = signedData.valid_till;

						record.update({hash: hash, hashValidTill: valid_till}).then(regs => {
							resolve(regs.dataValues);
						}).catch(onError.bind(this, reject));

					}).catch(onError.bind(this, reject));

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					onError(reject, error);
				}
			}
		);
	}

	/**
	 * @param {String} hash
	 * @returns {Promise}
	 */
	findRegistrationRecordByHash(hash) {
		return new Promise((resolve) => {
				try {
					let model = this._models.invitation;
					//noinspection JSUnresolvedFunction
					model.findOne({
						where: {
							hash: hash
						}
					}).then(record => {
						resolve(record ? record.dataValues : null);

					}).catch(error => {
						logger.error(BeameLogger.formatError(error));
						resolve(null);
					});

				}
				catch (error) {
					logger.error(BeameLogger.formatError(error));
					resolve(null);
				}
			}
		);
	}

	//endregion
}

module.exports = SqliteServices;