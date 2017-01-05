/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";


const express = require('express');


const beameSDK    = require('beame-sdk');
const module_name = "MatchingRouter";
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger(module_name);

const InvitationServices = require('./invitation_services');

function onRequestError(res, error, code) {
	logger.error(`authorization error ${BeameLogger.formatError(error)}`);
	res.status(code || 500).send(error);
}

class MatchingRouter {
	constructor() {

		this._invitationServices = InvitationServices.getInstance();

		this._router = express.Router();

		this._initRoutes();
	}

	_initRoutes() {
		this._router.post('/v1/invitation/save', (req, res) => {

			this._invitationServices.getRequestAuthToken(req).then(() => {
				this._invitationServices.saveInvitation(req.body).then(data => {
					res.json({success: true, data});
				}).catch(error => {
					res.json({success: false, error: BeameLogger.formatError(error)});
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