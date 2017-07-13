/**
 * Created by zenit1 on 28/12/2016.
 */
"use strict";

const path = require('path');
const os   = require('os');
const home = os.homedir();

const Constants   = require('./constants');
const db_provider = Constants.DbProviders.NeDB;


const nedb_storage_root = path.join(home, process.env.BEAME_DATA_FOLDER || ".beame_matching_data");


const ConfigProps = {
	Settings: {
		DbProvider:                    "db_provider"
	},
	NeDB:     {
		StorageRoot: "nedb_storage_root"
	},
	BeameDir: {
		BeameFolderRootPath: "beame_server_folder_path",
		BeameFolderName:     "beame_server_folder_name"
	}
};

const ClientServersTemplate = {
	"Servers": []
};

module.exports = {
	ConfigProps,
	ClientServersTemplate,

	db_provider,

	nedb_storage_root
};