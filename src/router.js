/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";


const express = require('express');

const Constants          = require('../constants');

const beameSDK    = require('beame-sdk');
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

		this._router.post('/v1/invitation/delete/:id', (req, res) => {

			let id = req.params.id;

			const invitationServices = InvitationServices.getInstance();

			const resolve = res => {
				res.json({success: true})
			};

			this._authServices.getRequestAuthToken(req)
				.then(invitationServices.deleteInvitation.bind(null, id))
				.then(resolve.bind(null, res))
				.catch(e => {
					onRequestError(res, e, 500);
				})
		});
		//endregion

		this._router.post('/v1/relay/get', (req, res) => {
			this._authServices.getRequestAuthToken(req).then(() => {

				res.json({success: true, relay:Constants.RelayServerFqdn});

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
	}

	get router() {
		return this._router;
	}
}


module.exports = MatchingRouter;