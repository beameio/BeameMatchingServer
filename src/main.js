/**
 * Created by zenit1 on 25/10/2016.
 */
"use strict";

process.env.BEAME_LOG_LEVEL = "DEBUG";

const MatchingServer = require('./server');

let server = new MatchingServer();

server.start();