/**
 * Created by zenit1 on 26/10/2016.
 */
"use strict";

const config      = require('../config/config');


function initMobile(){

	let socket = require('socket.io-client')(config.MatchingServerFqdn);

	socket.on('your_id', ()=> {
		console.log(`on your id`);
		//noinspection JSUnresolvedFunction
		socket.emit('idmobile');
	});

}


initMobile();