/**
 * Created by zenit1 on 28/12/2016.
 */
"use strict";
const path     = require('path');
const execFile = require('child_process').execFile;

const defaults      = require('../defaults');
const SqliteProps   = defaults.ConfigProps.Sqlite;
const SettingsProps = defaults.ConfigProps.Settings;

const Constants         = require('../constants');
const DbProviders       = Constants.DbProviders;
const beameSDK          = require('beame-sdk');
const module_name       = "Bootstrapper";
const BeameLogger       = beameSDK.Logger;
const logger            = new BeameLogger(module_name);
const CommonUtils       = beameSDK.CommonUtils;
const DirectoryServices = beameSDK.DirectoryServices;
const dirServices       = new DirectoryServices();
const AppConfigFileName = Constants.AppConfigFileName;

const ConfigFolderPath     = Constants.ConfigFolderPath;
const AppConfigJsonPath    = Constants.AppConfigJsonPath;
const SqliteConfigJsonPath = Constants.SqliteConfigJsonPath;
const BeameRootPath        = Constants.BeameRootPath;

const CredsFolderPath     = Constants.CredsFolderPath;
const ClientCredsJsonPath = Constants.ClientCredsJsonPath;
const ClientCredsFileName = Constants.ClientCredsFileName;


const SqliteDbConfigFileName = Constants.SqliteDbConfigFileName;


const _onConfigError = error => {
	logger.error(error);
	process.exit(1);
};


let bootstrapperInstance;

class Bootstrapper {

	constructor() {
		let config            = DirectoryServices.readJSON(AppConfigJsonPath);
		this._config          = CommonUtils.isObjectEmpty(config) ? null : config;
		this._sequilizeBinary = CommonUtils.getSequelizeBinaryPath();
	}

	/**
	 * init config files and then db
	 */
	initAll() {
		return new Promise((resolve) => {
			this.initConfig(false)
				.then(this.initDb.bind(this, false))
				.then(() => {
					logger.info(`beame-matching-server bootstrapped successfully`);
					resolve();
				})
				.catch(_onConfigError);
		});
	}

	/**
	 *
	 * @param {boolean} exit
	 * @returns {Promise}
	 */
	initConfig(exit) {

		return new Promise((resolve) => {
				Bootstrapper._ensureBeameServerDir()
					.then(this._ensureAppConfigJson.bind(this))
					.then(this._ensureClientServersJson.bind(this))
					.then(this._ensureDbConfig.bind(this))
					.then(() => {
						logger.info(`Beame-insta-server config files ensured`);
						resolve();
						if (exit) {
							process.exit(0);
						}
					})
					.catch(_onConfigError)
			}
		);
	}

	/**
	 *
	 * @param {boolean} exit
	 * @returns {Promise}
	 */
	initDb(exit) {
		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.Sqlite:
						this._ensureSqliteDir()
							.then(this._migrateSqliteSchema.bind(this))
							.then(this._runSqliteSeeders.bind(this))
							.then(() => {
								logger.info(`Beame-matching-server ${provider} DB updated successfully`);
								resolve();
								if (exit) {
									process.exit(0);
								}
							}).catch(_onConfigError);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				reject(`Db Provider ${provider} currently not supported`);
			}
		);
	}

	//region App Config
	_ensureAppConfigJson() {

		return new Promise((resolve) => {
				logger.debug(`ensuring ${AppConfigFileName}...`);

				let isExists = DirectoryServices.doesPathExists(AppConfigJsonPath);

				if (isExists) {
					logger.debug(`${AppConfigFileName} found...`);
					this._updateAppConfigJson().then(resolve).catch(_onConfigError);
				}
				else {
					this._createAppConfigJson().then(resolve).catch(_onConfigError);
				}

			}
		);


	}

	_createAppConfigJson() {

		return new Promise((resolve, reject) => {
				logger.debug(`creating ${AppConfigFileName}...`);

				let config = {};

				for (let prop in defaults) {
					//noinspection JSUnfilteredForInLoop
					if (typeof defaults[prop] !== "object") {
						//noinspection JSUnfilteredForInLoop
						config[prop] = defaults[prop];
					}
				}

				this._config = config;

				this.saveAppConfigFile().then(() => {
					logger.debug(`${AppConfigFileName} saved in ${path.dirname(AppConfigJsonPath)}...`);
					resolve();
				}).catch(error => {
					this._config = null;
					reject(error);
				});
			}
		);
	}

	_updateAppConfigJson() {

		return new Promise((resolve, reject) => {
				try {
					let config     = DirectoryServices.readJSON(AppConfigJsonPath),
					    updateFile = false;

					if (CommonUtils.isObjectEmpty(config)) {
						return this._createAppConfigJson();
					}

					for (let prop in defaults) {
						//noinspection JSUnfilteredForInLoop
						if ((typeof defaults[prop] !== "object") && !config.hasOwnProperty(prop)) {
							updateFile   = true;
							//noinspection JSUnfilteredForInLoop
							config[prop] = defaults[prop];
						}

					}

					this._config = config;

					if (!updateFile) {
						logger.debug(`no changes found for ${AppConfigFileName}...`);
						resolve();
						return;
					}

					this.saveAppConfigFile().then(() => {
						logger.debug(`${AppConfigFileName} updated...`);
						resolve();
					}).catch(error => {
						this._config = null;
						reject(error);
					});

				} catch (error) {
					reject(error);
				}
			}
		);
	}

	saveAppConfigFile() {
		return dirServices.saveFileAsync(AppConfigJsonPath, CommonUtils.stringify(this._config, true));
	}

	//endregion

	// region Clients servers config
	registerClientServer(fqdn) {
		return new Promise((resolve, reject) => {
				if (!fqdn) {
					reject(`fqdn required`);
					return;
				}

				let servers = DirectoryServices.readJSON(ClientCredsJsonPath);

				if (CommonUtils.isObjectEmpty(servers)) {
					reject(`client servers configuration file not found`);
					return;
				}

				if (servers.Servers.indexOf(fqdn) >= 0) {
					resolve();
					return;
				}

				servers.Servers.push(fqdn);


				DirectoryServices.saveFileSync(ClientCredsJsonPath, CommonUtils.stringify(servers, true), (error) => {
					if (error) {
						reject(error);
						return;
					}
					logger.info(`${fqdn} added to clients servers...`);
					resolve();
				});

			}
		);
	}

	static listClientServers() {
		return new Promise((resolve) => {
			resolve(DirectoryServices.readJSON(ClientCredsJsonPath).Servers);
		});
	}

	/**
	 * @returns {Promise}
	 * @private
	 */
	_ensureClientServersJson() {
		return new Promise((resolve) => {
				logger.debug(`ensuring ${ClientCredsFileName}...`);

				let isExists = DirectoryServices.doesPathExists(ClientCredsJsonPath);

				if (isExists) {
					logger.debug(`${ClientCredsFileName} found...`);
					resolve();
				}
				else {
					this._createClientServersJson().then(resolve).catch(_onConfigError);
				}
			}
		);
	}

	/**
	 ** @returns {Promise}
	 * @private
	 */
	_createClientServersJson() {

		return new Promise((resolve, reject) => {
				let credsConfig = defaults.ClientServersTemplate;


				dirServices.saveFileAsync(ClientCredsJsonPath, CommonUtils.stringify(credsConfig, true)).then(() => {
					logger.debug(`${ClientCredsFileName} saved in ${path.dirname(ClientCredsJsonPath)}...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	//endregion

	//region Db services
	//region config
	_ensureDbConfig() {

		return new Promise((resolve, reject) => {
				let provider = this._config[SettingsProps.DbProvider];

				logger.debug(`DB Provider set to ${provider}...`);

				if (!provider) {
					reject(`Db Provider not defined`);
					return;
				}

				switch (provider) {
					case DbProviders.Sqlite:
						this._ensureSqliteConfigJson().then(resolve).catch(_onConfigError);
						return;
					//TODO implement Couchbase connector
					// case DbProviders.Couchbase:
					// 	break;
				}

				reject(`Db Provider ${provider} currently not supported`);
			}
		);
	}

	_ensureSqliteConfigJson() {

		return new Promise((resolve, reject) => {

				logger.debug(`validating sqlite ${SqliteDbConfigFileName}...`);

				let dbConfig = DirectoryServices.readJSON(SqliteConfigJsonPath);

				if (CommonUtils.isObjectEmpty(dbConfig)) {
					this._createSqliteConfigJson().then(resolve).catch(_onConfigError);
					return;
				}

				logger.debug(`sqlite ${SqliteDbConfigFileName} found...`);

				let dbConfigTemplate = defaults.SqliteConfigTemplate,
				    env              = this._config[SqliteProps.EnvName],
				    dbConfigKeys     = Object.keys(dbConfigTemplate[env]),
				    updateFile       = false;

				dbConfigKeys.forEach(key => {
					if (!dbConfig[env].hasOwnProperty(key)) {
						updateFile         = true;
						dbConfig[env][key] = dbConfigTemplate[env][key];
					}
				});


				if (updateFile) {
					dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig, true)).then(() => {
						logger.debug(`${SqliteDbConfigFileName} updated successfully...`);
						resolve();
					}).catch(reject);
				}
				else {
					resolve();
				}

			}
		);

	}

	_createSqliteConfigJson() {

		return new Promise((resolve, reject) => {
				let dbConfig = defaults.SqliteConfigTemplate,
				    env      = this._config[SqliteProps.EnvName];

				dbConfig[env]["username"] = this._config[SqliteProps.AdminUserName];
				dbConfig[env]["password"] = CommonUtils.randomPassword(12);
				dbConfig[env]["storage"]  = path.join(process.env.BEAME_SERVERS_AUTH_DATA_DIR || this._config[SqliteProps.StorageRoot], this._config[SqliteProps.DbName]);

				dirServices.saveFileAsync(SqliteConfigJsonPath, CommonUtils.stringify(dbConfig, true)).then(() => {
					logger.debug(`${SqliteDbConfigFileName} saved in ${path.dirname(SqliteConfigJsonPath)}...`);
					resolve();
				}).catch(reject);

			}
		);
	}

	//endregion

	//region init sqlite db

	_migrateSqliteSchema() {

		logger.debug(`migrating sqlite schema...`);

		return new Promise((resolve, reject) => {
				//TODO implement https://github.com/sequelize/umzug
				let args = ["db:migrate", "--env", this._config[SqliteProps.EnvName], "--config", SqliteConfigJsonPath];

				try {
					execFile(this._sequilizeBinary, args, (error) => {
						if (error) {
							reject(error);
							return;
						}
						logger.debug(`sqlite migration completed successfully...`);
						resolve();
					});
				}
				catch (e) {
					reject(e);
				}
			}
		);
	}

	_runSqliteSeeders() {

		logger.debug(`running sqlite seeders...`);

		return new Promise((resolve, reject) => {
				let args = ["db:seed:all", "--env", this._config[SqliteProps.EnvName], "--config", SqliteConfigJsonPath];

				try {
					execFile(this._sequilizeBinary, args, (error) => {
						if (error) {
							reject(error);
							return;
						}
						logger.debug(`sqlite seeders applied successfully...`);
						resolve();
					});
				}
				catch (e) {
					reject(e);
				}
			}
		);
	}

	_ensureSqliteDir() {

		return this._ensureConfigDir(SqliteProps.StorageRoot);
	}

	//endregion

	//endregion

	//region Beame folder
	static _ensureBeameServerDir() {

		return new Promise((resolve, reject) => {
				Bootstrapper._ensureDir(BeameRootPath)
					.then(Bootstrapper._ensureDir(ConfigFolderPath))
					.then(Bootstrapper._ensureDir(CredsFolderPath))
					.then(resolve)
					.catch(reject);
			}
		);

	}

	//endregion

	//region Directory services
	_ensureConfigDir(prop) {

		return new Promise((resolve, reject) => {
				let dir = this._config[prop];

				if (!dir) {
					reject(`config.json not contains required "beame-server dir root path" value`);
					return;
				}

				Bootstrapper._ensureDir(dir).then(resolve);
			}
		);


	}

	static _ensureDir(dir) {
		return new Promise((resolve) => {
				DirectoryServices.createDir(dir);

				logger.debug(`directory ${dir} ensured...`);

				resolve();
			}
		);

	}

	//endregion

	//region getters
	get dbProvider() {
		return this._config && this._config[SettingsProps.DbProvider] ? this._config[SettingsProps.DbProvider] : null;
	}

	get sqliteConfig() {
		let config = DirectoryServices.readJSON(SqliteConfigJsonPath);

		if (CommonUtils.isObjectEmpty(config)) {
			//noinspection JSConstructorReturnsPrimitive
			return null;
		}

		let env = this._config[SqliteProps.EnvName];

		return config[env];
	}

	//noinspection JSUnusedGlobalSymbols
	get appConfig() {
		return this._config;
	}

	//noinspection JSMethodCanBeStati

	set setAppConfig(config) {
		this._config = config;
	}

	//endregion

	/**
	 *
	 * @returns {Bootstrapper}
	 */
	static getInstance() {
		if (!bootstrapperInstance) {
			bootstrapperInstance = new Bootstrapper();
		}

		return bootstrapperInstance;
	}
}

module.exports = Bootstrapper;