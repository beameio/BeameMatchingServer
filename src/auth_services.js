/**
 * Created by zenit1 on 10/01/2017.
 */
"use strict";
const beameSDK     = require('beame-sdk');
const module_name  = "MatchingAuthServices";
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger(module_name);
const CommonUtils  = beameSDK.CommonUtils;
const AuthToken    = beameSDK.AuthToken;
const Bootstrapper = require('./bootstrapper');
const bootstrapper = Bootstrapper.getInstance();


class AuthorizationServices {
	constructor() {

	}

	getRequestAuthToken(req) {
		return new Promise((resolve, reject) => {
				let authHead  = req.get('X-BeameAuthToken'),
				    /** @type {SignatureToken|null} */
				    authToken = null;

				logger.debug(`auth head received ${authHead}`);

				if (authHead) {
					try {
						authToken = CommonUtils.parse(authHead);

						if (!CommonUtils.isObject(authToken)) {
							logger.error(`invalid auth ${authToken} token format`);
							reject({message: 'Auth token invalid json format'});
							return;
						}
					}
					catch (error) {
						logger.error(`Parse auth header error ${BeameLogger.formatError(error)}`);
						reject({message: 'Auth token invalid json format'});
						return;
					}
				}

				if (!authToken) {
					reject({message: 'Auth token required'});
					return;
				}

				this._validateAuthToken(authToken).then(() => {
					resolve(authToken)
				}).catch(reject);
			}
		);
	}

	/**
	 * @param {SignatureToken} authToken
	 * @returns {Promise}
	 */
	_validateAuthToken(authToken) {
		return new Promise((resolve, reject) => {

				AuthToken.validate(authToken).then(resolve).catch(reject);

			}
		);
	}

}

module.exports = AuthorizationServices;
