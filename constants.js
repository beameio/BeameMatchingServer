/**
 * Created by zenit1 on 28/12/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();


const beame_server_folder_name = ".beame_matching";
const BeameRootPath            = path.join(home, beame_server_folder_name);
const ConfigFolder             = "config";
const CredsConfigFolder        = "creds";

const AppConfigFileName      = "app_config.json";
const ClientCredsFileName    = "client_creds.json";

const ConfigFolderPath     = path.join(BeameRootPath, ConfigFolder);
const AppConfigJsonPath    = path.join(BeameRootPath, ConfigFolder, AppConfigFileName);

const CredsFolderPath     = path.join(BeameRootPath, CredsConfigFolder);
const ClientCredsJsonPath = path.join(BeameRootPath, CredsConfigFolder, ClientCredsFileName);

const MatchingServerFqdn  = 'gpqhiai526aemun8.ohkv8odznwh5jpwm.v1.p.beameio.net';


const WhispererMode = {
	"SESSION":   "Session",
	"PROVISION": "Provision"
};

const DbProviders = {
	"Couchbase": "couchbase",
	"NeDB": "NeDB"
};

const InvitationStatus = {
	"Waiting":   "Waiting",
	"Canceled":  "Canceled",
	"Completed": "Completed"
};

module.exports = {
	InvitationStatus,
	MatchingServerFqdn,

	WhispererMode,

	BeameRootPath,

	AppConfigFileName,
	ConfigFolderPath,
	AppConfigJsonPath,

	CredsConfigFolder,
	ClientCredsFileName,
	CredsFolderPath,
	ClientCredsJsonPath,

	DbProviders
};



