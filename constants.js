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

const AppConfigFileName           = "app_config.json";
const SqliteDbConfigFileName = "sqlite_config.json";

const SqliteConfigJsonPath   = path.join(BeameRootPath, ConfigFolder, SqliteDbConfigFileName);
const ConfigFolderPath            = path.join(BeameRootPath, ConfigFolder);
const AppConfigJsonPath           = path.join(BeameRootPath, ConfigFolder, AppConfigFileName);

const MatchingServerFqdn = 'i5un73q6o42bc8r0.q6ujqecc83gg6fod.v1.d.beameio.net';


const WhispererMode = {
	"SESSION":   "Session",
	"PROVISION": "Provision"
};

const DbProviders = {
	"Sqlite":    "sqlite",
	"Couchbase": "couchbase"
};

const InvitationStatus = {
	"Waiting":   "Waiting",
	"Matched" :  "Matched",
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
	DbProviders,
	SqliteDbConfigFileName,
	SqliteConfigJsonPath
};



