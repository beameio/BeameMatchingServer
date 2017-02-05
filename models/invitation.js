'use strict';
module.exports = function (sequelize, DataTypes) {

	const Constants = require('../constants');

	return sequelize.define('Invitation', {
			id:             {
				type:          DataTypes.INTEGER,
				primaryKey:    true,
				autoIncrement: true
			},
			appId:          {
				type:      DataTypes.STRING,
				allowNull: false
			},
			token:          {
				type:      DataTypes.STRING,
				allowNull: false
			},
			pin:            {
				type:         DataTypes.STRING,
				defaultValue: DataTypes.UUIDV4,
				unique:       true

			},
			fqdn:           {
				type:      DataTypes.STRING,
				unique:    true,
				allowNull: false

			},
			status:         {
				type:         DataTypes.STRING,
				allowNull:    false,
				defaultValue: Constants.InvitationStatus.Waiting
			}
		},
		{
			tableName:       'Invitations',
			freezeTableName: true,
			indexes:         [
				{
					name:   'indPin',
					unique: true,
					fields: ['pin']
				},
				{
					name:   'indFqdn',
					unique: true,
					fields: ['fqdn']
				}
			]
		});
};