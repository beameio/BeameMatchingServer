/**
 * Created by zenit1 on 08/12/2016.
 */

'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return [
			queryInterface.addColumn(
				'Invitation',
				'name',
				{
					type: Sequelize.STRING
				}
			)
		];
	},

	down: function (queryInterface) {
		return [
			queryInterface.removeColumn('Invitation', 'name')
		];
	}
};
