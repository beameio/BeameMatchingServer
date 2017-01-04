'use strict';
module.exports = {
	up:   function (queryInterface, Sequelize) {

		const Constants = require('../constants');

		return queryInterface.createTable('Invitations', {
			id: {
				allowNull:     false,
				autoIncrement: true,
				primaryKey:    true,
				type:          Sequelize.INTEGER
			},
			appId:  {
				type:      Sequelize.STRING,
				allowNull: false
			},
			token:     {
				type: Sequelize.STRING,
				allowNull:     false
			},
			pin:       {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				unique: true,
				allowNull:false
			},
			fqdn:   {
				type:      Sequelize.STRING,
				unique:    true,
				allowNull: false

			},
			status:    {
				type: Sequelize.STRING,
				allowNull:     false,
				defaultValue:Constants.InvitationStatus.Waiting
			},
			createdAt: {
				allowNull: false,
				type:      Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type:      Sequelize.DATE
			}
		},
			{
				indexes:[
					{
						name:'indPin',
						unique: true,
						fields: ['pin']
					},
					{
						name:'indFqdn',
						unique: true,
						fields: ['fqdn']
					}
				]
			}
		);
	},
	down: function (queryInterface, Sequelize) {
		return queryInterface.dropTable('Invitations');
	}
};