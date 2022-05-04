const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const Jimp = require('jimp');
const fs = require('fs');
const { promises } = require('fs');
const Uploader = require('../helpers/fileUpload');

const users_role_table = "users_role";

module.exports = {
    async roleOptions(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        let queryString = `SELECT id, role FROM ${users_role_table}`;
        await db.query(queryString);
        if (db.count() > 0) {
            const result = db.results()
            var roles = []
            for (let index = 0; index < result.length; index++) {
                const role = result[index];
                roles.push({ label: role.role, value: role.id })
            }
            response.status(200).json({
                success: true,
                roles: roles
            });
        } else {
            response.status(404).json({
                success: false,
                message: 'No roles found'
            });
        }
    },
}