/**
 * Created by zenit1 on 04/07/2017.
 */
"use strict";


const Datastore   = require('nedb');
const async       = require('async');
const path        = require('path');
const beameSDK    = require('beame-sdk');
const module_name = "NeDBServices";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);
const CommonUtils = beameSDK.CommonUtils;
const Constants = require('../../constants');

const inc_id_field_name = '__autoid__';
const Collections       = {
	invitations:          {
		name:    'invitations',
		indices: [{fieldName: 'id', unique: true}, {fieldName: 'fqdn', unique: true}, {fieldName: 'pin',unique:false}]
	}
};

function onError(reject, error) {
	logger.error(BeameLogger.formatError(error), error);
	reject(error);
}

class NeDB {
	constructor(db_folder_path, options) {
		this._db_folder_path = db_folder_path;
		this._db             = {};
		this._options        = options;
	}

	start() {
		return new Promise((resolve, reject) => {
				this._loadCollections()
					.then(() => {
						logger.info(`NeDB started successfully`);
						resolve();
					})
					.catch(reject)
			}
		);

	}

	_getUniqueId(collection) {
		return new Promise((resolve, reject) => {
				this._updateDoc(
					collection,
					{_id: inc_id_field_name},
					{$inc: {value: 1}},
					{upsert: true, returnUpdatedDocs: true}
				).then(doc => {
					resolve(doc.value);
				}).catch(reject);

			}
		);
	}

	//region collections
	_loadCollections() {
		return new Promise((resolve, reject) => {

				async.parallel([
					cb => {
						this._loadCollection(Collections.invitations.name, Collections.invitations.indices)
							.then(() => {
								cb(null);
							})
							.catch(err => {
								cb(err);
							})
					}
				], err => {
					if (err) {
						reject(err)
					} else {
						logger.info(`All collections loaded`);
						resolve()
					}
				});
			}
		);
	}

	_addIndex(name, index) {
		return new Promise((resolve, reject) => {
				try {
					this._db[name].ensureIndex(index, err => {
						if (err) {
							reject(err)
						}
						else {
							logger.info(`Index for ${name} created`);
							resolve()
						}
					})
				} catch (e) {
					reject(e);
				}
			}
		);
	}

	/**
	 * @param {String} name
	 * @param {Array} indices
	 * @private
	 */
	_loadCollection(name, indices = []) {
		return new Promise((resolve, reject) => {

				const _resolve = () => {
					logger.info(`Collection ${name} created fully`);
					resolve()
				};

				try {

					this._db[name] = new Datastore({
						filename:      path.join(this._db_folder_path, `${name}.db`),
						timestampData: true
					});
					this._db[name].loadDatabase(err => {
						if (err) {
							reject(err);
							return;
						}
						this._db[name].insert({_id: inc_id_field_name, value: 0});
						logger.info(`${name} collection loaded`);
						if (indices.length) {
							Promise.all(indices.map(data => {
									return this._addIndex(name, data).then(() => {
										return Promise.resolve()
									});
								}
							)).then(() => {
								_resolve()
							}).catch(reject);
						}
						else {
							_resolve()
						}
					});

				} catch (e) {
					reject(e)
				}
			}
		);
	}

	//endregion

	//region db access operations
	_findDoc(collection, query) {
		return new Promise((resolve, reject) => {
				this._db[collection]
					.findOne(query, (err, doc) => {
						if (err) {
							reject(err)
						}
						else {
							resolve(doc)
						}
					})
			}
		);
	}

	_findDocs(collection, query = {}, sort = {}) {
		return new Promise((resolve, reject) => {
				query._id = {$ne: inc_id_field_name};
				this._db[collection].find(query).sort(sort).exec((err, docs) => {
					if (err) {
						reject(err)
					}
					else {
						resolve(docs)
					}
				})
			}
		);
	}

	_insertDoc(collection, doc) {
		return new Promise((resolve, reject) => {

				this._getUniqueId(collection).then(id => {
					logger.info(`Inserting ${JSON.stringify(doc)} into ${collection}`);
					doc.id = id;
					this._db[collection]
						.insert(doc, (err, newDoc) => {
							if (err) {
								reject(err)
							}
							else {
								logger.info(`Doc ${JSON.stringify(doc)} inserted into ${collection}`);
								resolve(newDoc)
							}
						})
				}).catch(reject)
			}
		);
	}

	_updateDoc(collection, query, update, options = {}) {
		return new Promise((resolve, reject) => {
				options['returnUpdatedDocs'] = true;
				if (CommonUtils.isObjectEmpty(query)) {
					query = {_id: {$ne: inc_id_field_name}}
				}
				try {
					this._db[collection].update(query, update, options, (err, numReplaced, returnUpdatedDocs) => {
						if (err) {
							reject(err)
						} else {
							this._db[collection].persistence.compactDatafile();
							resolve(returnUpdatedDocs);
						}
					});
				} catch (e) {
					console.log(e)
				}
			}
		);
	}

	_removeDoc(collection, query, options = {}) {
		return new Promise((resolve, reject) => {
				this._db[collection].remove(query, options, (err, numRemoved) => {
					if (err) {
						reject(err || `Unexpected error`)
					} else {
						logger.info(`${numRemoved} records removed from ${collection}`);
						this._db[collection].persistence.compactDatafile();
						resolve()
					}
					// numRemoved = 1
				});
			}
		);
	}

	//endregion

	//region registration services
	getInvitations(appId) {
		return this._findDocs(Collections.invitations.name, {appId:appId},{id:-1});
	}

	findInvitation(pin) {
		return this._findDoc(Collections.invitations.name, {pin: pin});
	}

	/**
	 * @param {Invitation} data
	 * @returns {Promise.<Invitation>}
	 */
	saveInvitation(data) {

		data.status = Constants.InvitationStatus.Waiting;
		return this._insertDoc(Collections.invitations.name, data);
	}


	deleteInvitation(id) {
		return this._removeDoc(Collections.invitations.name, {id: id});
	}

	/**
	 * @param {String} fqdn
	 * @returns {Promise}
	 */
	markInvitationAsCompleted(fqdn) {
		return this._updateDoc(Collections.invitations.name, {fqdn: fqdn}, {
			$set: {status: Constants.InvitationStatus.Completed}
		});
	}


	//endregion
}

module.exports = NeDB;