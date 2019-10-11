/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";


const express = require('express');
const beameSDK = require('beame-sdk');

const module_name = "MatchingRouter";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const InvitationServices = require('./invitation_services');
const ClientManager      = require('./client_manager');

function onRequestError(res, error, code) {
	logger.error(`authorization error ${BeameLogger.formatError(error)}`);
	res.status(code || 500).send(error);
}

class MatchingRouter {
	constructor() {

		this._authServices = new (require('./auth_services'))();

		this._router = express.Router();

		this._relayFqdn = null;

		this._initRoutes();
	}

	_initRoutes() {
		//region invitations
		this._router.get('/v1/invitation/list', (req, res) => {

			this._authServices.getRequestAuthToken(req).then(() => {

				let appId = req.body.appId;

				if (!appId) {
					onRequestError(res, 'AppId required', 400);
					return;
				}

				const invitationServices = InvitationServices.getInstance();

				invitationServices.getInvitations(appId).then(data => {
					res.json({data});
				}).catch(error => {
					onRequestError(res, error, 401);
				});
			}).catch(error => {
				onRequestError(res, error, 401);
			});
		});

		// Used by Gatekeeper for new invitations / registrations
		this._router.post('/v1/invitation/save', (req, res) => {

			this._authServices.getRequestAuthToken(req).then(() => {

				const invitationServices = InvitationServices.getInstance();

				invitationServices.saveInvitation(req.body).then(data => {
					res.json({success: true, data});
				}).catch(error => {
					res.json({success: false, error: BeameLogger.formatError(error)});
				});
			}).catch(error => {
				onRequestError(res, error, 401);
			});
		});

		this._router.post('/v1/invitation/complete/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			const resolve = res => {
				res.json({success: true})
			};

			this._authServices.getRequestAuthToken(req)
				.then(InvitationServices.markInvitationAsCompleted(fqdn))
				.then(resolve.bind(null, res))
				.catch(e => {
					onRequestError(res, e, 500);
				})
		});

		this._router.post('/v1/invitation/delete/:id', (req, res) => {

			let id = req.params.id,
				inviteId;

			try {
				inviteId = parseInt(id);
			} catch (e) {
				return onRequestError(res,{message:"invalid invitationId"},500);
			}


			const resolve = res => {
				res.json({success: true})
			};

			this._authServices.getRequestAuthToken(req)
				.then(InvitationServices.deleteInvitation(inviteId))
				.then(resolve.bind(null, res))
				.catch(e => {
					onRequestError(res, e, 500);
				})
		});
		//endregion

		this._router.get('/v1/relay/get', (req, res) => {
			this._authServices.getRequestAuthToken(req).then(() => {

				const _returnRelay = () => {
					res.json({success: true, relay: this._relayFqdn});
				};

				if (this._relayFqdn) {
					_returnRelay();
					return;
				}

				this._getBestRelay()
					.then(_returnRelay)
					.catch(error => {
						onRequestError(res, error, 401);
					})

			}).catch(error => {
				onRequestError(res, error, 401);
			});
		});

		this._router.post('/v1/client/register/:fqdn', (req, res) => {

			let fqdn = req.params.fqdn;

			const clientManager = ClientManager.getInstance();

			this._authServices.getRequestAuthToken(req).then(() => {
				clientManager.addClients([fqdn]).then(() => {

					const socketServer = (require('./socket_server')).getInstance();

					socketServer.addClient(fqdn)
						.then(() => {
							res.status(200).json({success: true});
						}).catch(error => {
						res.status(500).json({success: false, error: BeameLogger.formatError(error)});
					});


				}).catch(error => {
					res.status(500).json({success: false, error: BeameLogger.formatError(error)});
				});
			}).catch(error => {
				onRequestError(res, error, 401);
			});
		});

		this._router.get('/v1/matching-access-info-pin/:pin', async (req, res, next) => {
			try {
				const data = await InvitationServices.getInstance().findInvitation(req.params.pin);
				await res.send({'X-BeameAuthToken': data});
			} catch(e) {
				if(e instanceof InvitationServices.InvitationNotFound) {
					const msg = `Matching Access Info PIN not found: ${req.params.pin}`;
					console.warn(`[/v1/matching-access-info-pin/:pin] ${msg}`);
					await res.status(404).send(msg);
					return;
				}
				console.error('[/v1/matching-access-info-pin/:pin] error', e);
				await next(e);
			}
		});
	}

	get router() {
		return this._router;
	}

	_getBestRelay() {
		return new Promise((resolve, reject) => {

				const beameUtils = beameSDK.BeameUtils;
				beameUtils.selectBestProxy(null, 100, 1000, (error, payload) => {
					if (!error) {
						this._relayFqdn = payload.endpoint;
						resolve();
					}
					else {
						this._relayFqdn = null;
						reject();
					}
				});
			}
		);
	}
}


module.exports = MatchingRouter;
