'use strict';
const bootstrapper = new (require('../src/bootstrapper'))();
let config = bootstrapper.sqliteConfig;

const beameSDK     = require('beame-sdk');
const BeameLogger  = beameSDK.Logger;
const logger       = new BeameLogger('Sequelize');

const fs        = require('fs');
const path      = require('path');
const Sequelize = require('sequelize');
const basename  = path.basename(module.filename);
let db        = {};

const sequelize = new Sequelize(config["database"], config["username"], config["password"], {
	dialect: 'sqlite',
	pool:    {
		max:  5,
		min:  0,
		idle: 10000
	},
	logging: logger.debug.bind(logger),
	// SQLite only
	storage: config["storage"]
});

fs
	.readdirSync(__dirname)
	.filter(function (file) {
		return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
	})
	.forEach(function (file) {
		let model      = sequelize['import'](path.join(__dirname, file));
		db[model.name] = model;
	});

Object.keys(db).forEach(function (modelName) {
	if (db[modelName].associate) {
		db[modelName].associate(db);
	}
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

