const encryption = require('../library/encryption');
const encrypt = new encryption();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();

//database tables
const users_table = "users";
const userColumns = 'id as user_id,username,first_name,last_name,phone,email,country,account_type,created';

module.exports = {
    async userInfo(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const user_id = (params.user_id) ? params.user_id : null;

        if (!user_id) {
            response.status(200).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        await db.query(`SELECT ${userColumns} FROM ${users_table} user WHERE id= ${user_id}`);
        if (db.count() > 0) {
            response.status(200).json({
                success: true,
                user: db.first(),
            });
        } else {
            response.status(403).json({
                success: false,
                message: 'No user found',
            });
        }
    },
    async userUpdate(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const user_id = (params.user_id) ? params.user_id : null;
        const first_name = (params.first_name) ? params.first_name : null;
        const last_name = (params.last_name) ? params.last_name : null;
        const phone = (params.phone) ? params.phone : null;

        if (!user_id) {
            response.status(200).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        const insertData = {
            first_name: first_name,
            last_name: last_name,
            phone: phone
        }
        const done = await db.update(users_table, 'id', user_id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Account updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update Account'
            });
        }
    },
    async adminUpdate(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const user_id = (params.user_id) ? params.user_id : null;
        const first_name = (params.first_name) ? params.first_name : null;
        const username = (params.username) ? params.username : null;
        const phone = (params.phone) ? params.phone : null;
        const email = (params.email) ? params.email : null;

        if (!user_id) {
            response.status(200).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        const insertData = {
            first_name: first_name,
            username: username,
            email: email,
            phone: phone
        }
        const done = await db.update(users_table, 'id', user_id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Account updated successfully'
            });
        } else {
            response.status(403).json({
                success: false,
                message: 'Could not update Account'
            });
        }
    },
    async userUpdatePassword(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const user_id = (params.user_id) ? params.user_id : null;
        const current_password = (params.current_password) ? params.current_password : null;
        const new_password = (params.new_password) ? params.new_password : null;

        if (!user_id) {
            response.status(200).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }
        if (!current_password) {
            response.status(200).json({
                message: 'Please provide current password',
                success: false
            });
            return;
        }
        if (!new_password) {
            response.status(200).json({
                message: 'Please provide new password',
                success: false
            });
            return;
        }

        const queryString = `select password from ${users_table} where id = '${user_id}'`;
        await db.query(queryString);
        if (db.count() > 0) {
            const userdata = db.first();
            const passed = await encrypt.compare(current_password, userdata.password);
            if (passed) {
                const insertData = {
                    password: await encrypt.hash(new_password),
                }
                const done = await db.update(users_table, 'id', user_id, insertData);
                if (done) {
                    response.status(200).json({
                        success: true,
                        message: 'Account Password updated successfully'
                    });
                } else {
                    response.status(200).json({
                        success: false,
                        message: 'Could not update Account Password'
                    });
                }
            } else {
                response.status(200).json({
                    success: false,
                    message: 'Current Password is wrong !!!'
                });
            }
        } else {
            response.status(200).json({
                success: false,
                message: 'Account user not found'
            });
        }
    },
};