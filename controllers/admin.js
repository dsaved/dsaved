const encryption = require('../library/encryption');
const encrypt = new encryption();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();

//database tables
const users_table = "users";
const users_role_table = "users_role";
const users_page_table = "users_page";
const certificate_table = "certificates";

module.exports = {
    //user admin section
    async getAdminUsers(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        let condition = `WHERE account_type = 'admin'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        const db = new mysql(conf.db_config);
        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT
        user.id,
        user.first_name name,
        user.phone,
        user.email,
        user.username,
        user.account_type,
        user.created,
        rl.role
        FROM ${users_table} user LEFT JOIN ${users_role_table} rl ON rl.id=user.role ${condition} ORDER BY id DESC `)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let users = paging.results()
            response.status(200).json({
                success: true,
                users: users,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No users found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getAdminUser(request, response) {
        const id = (request.body.id) ? request.body.id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        let condition = `WHERE user.account_type = 'admin' AND user.id=${id}`;
        const db = new mysql(conf.db_config);
        await db.query(`SELECT
        user.id,
        user.username,
        user.first_name name,
        user.phone,
        user.email,
        user.account_type,
        user.role,
        user.created
        FROM ${users_table} user ${condition} ORDER BY id DESC `)
        if (db.count() > 0) {
            let user = db.first()
            await db.query(`SELECT pages FROM ${users_page_table} WHERE user_id = ${user.id} LIMIT 1`)
            if (db.count() > 0) {
                user.selectedPages = db.first().pages.split(',');
            }
            await db.query(`SELECT role, id FROM ${users_role_table} WHERE id = ${user.role} LIMIT 1`)
            if (db.count() > 0) {
                const role = db.first();
                user.role = { label: role.role, value: role.id }
            }
            response.status(200).json({
                success: true,
                user: user
            });
        } else {
            response.status(404).json({
                success: false,
                message: 'No user found',
            });
        }
    },
    async createAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const email = (params.email) ? params.email : "";
        const password = (params.password) ? params.password : null;
        const pages = (params.pages) ? params.pages : null;
        const role = (params.role) ? params.role : null;

        const required = ['name', 'phone', 'email', 'pages', 'role', 'password'];
        for (let index = 0; index < required.length; index++) {
            const element = required[index];
            if (!params[element]) {
                return response.status(403).json({
                    message: `Please provide ${element}`,
                    success: false
                });
            }
        }

        await db.query(`select phone from ${users_table} where phone = '${phone}'`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        const insertData = {
            first_name: name,
            phone: phone,
            username: email.split('@')[0],
            role: role,
            email: email,
            account_type: 'admin',
            password: await encrypt.hash(password),
        }

        const done = await db.insert(users_table, insertData);
        if (done) {
            const adminID = db.lastInsertID();
            await db.insert(users_page_table, { user_id: adminID, pages: pages.join(',') });
            response.status(200).json({
                success: true,
                message: 'Account created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async updateAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const adminID = (params.id) ? params.id : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const email = (params.email) ? params.email : "";
        const pages = (params.pages) ? params.pages : null;
        const role = (params.role) ? params.role : null;

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        if (!name) {
            response.status(403).json({
                message: 'Please provide name',
                success: false
            });
            return;
        }
        if (!phone) {
            response.status(403).json({
                message: 'Please provide phone',
                success: false
            });
            return;
        }
        if (!pages) {
            response.status(403).json({
                message: 'Please provide pages',
                success: false
            });
            return;
        }
        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
                success: false
            });
            return;
        }

        const insertData = {
            first_name: name,
            phone: phone,
            role: role,
            email: email,
        }

        const done = await db.update(users_table, 'id', adminID, insertData);
        if (done) {
            await db.update(users_page_table, 'user_id', adminID, { pages: pages.join(',') });
            response.status(200).json({
                success: true,
                message: 'Account updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async deleteAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const adminID = (params.id) ? params.id : null;

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        const done = await db.delete(users_table, `WHERE id IN (${adminID.join(',')})`);
        if (done) {
            await db.delete(users_page_table, `WHERE user_id IN (${adminID.join(',')})`);
            response.status(200).json({
                success: true,
                message: 'Account deleted successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not deleted account'
            });
        }
    },
    async updatePassword(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const user_id = (params.user_id) ? params.user_id : null;
        const new_password = (params.new_password) ? params.new_password : null;

        if (!user_id) {
            response.status(200).json({
                message: 'Please provide user id',
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
    },

    //Roles Sections
    async getRoles(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        let condition = ``;
        if (search) {
            condition += ` AND (role LIKE '%${search}%' OR permissions LIKE '%${search}%' ) `;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT * FROM ${users_role_table} ${condition} ORDER BY id `);
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let roles = paging.results()
            response.status(200).json({
                success: true,
                roles: roles,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No roles found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }

        await db.query(`SELECT * FROM ${users_role_table} WHERE id=${id} ORDER BY id `);
        if (db.count() > 0) {
            let role = db.first()
            response.status(200).json({
                success: true,
                role: role,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No role found',
            });
        }
    },
    async deleteRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const adminID = (params.id) ? params.id : null;

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        const done = await db.delete(users_role_table, `WHERE id IN (${adminID.join(',')})`);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Record deleted successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not delete record'
            });
        }
    },
    async addRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const role = (params.role) ? params.role : null;
        const permissions = (params.permissions) ? params.permissions : null;

        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
                success: false
            });
            return;
        }
        if (!permissions) {
            response.status(403).json({
                message: 'Please provide permissions',
                success: false
            });
            return;
        }

        const insertData = {
            role: role,
            permissions: permissions.join(','),
        }

        const done = await db.insert(users_role_table, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Role created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create role'
            });
        }
    },
    async updateRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const role = (params.role) ? params.role : null;
        const permissions = (params.permissions) ? params.permissions : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
                success: false
            });
            return;
        }
        if (!permissions) {
            response.status(403).json({
                message: 'Please provide permissions',
                success: false
            });
            return;
        }

        const insertData = {
            role: role,
            permissions: permissions.join(','),
        }

        const done = await db.update(users_role_table, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Role updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update role'
            });
        }
    },

    //Dashboard section
    async getDashboardData(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const user_id = (params.user_id) ? params.user_id : null;

        // REGISTRATION STATS STARTS HERE
        let registration_stat = {
            stats_for: `${new Date().getFullYear()} Stats`,
            name: 'New customers by months',
            stats: [{ name: 'new customer', data: [] }]
        }
        let stats_data = [null, null, null, null, null, null, null, null, null, null, null, null]

        await db.query(`SELECT COUNT(id) as count, MONTH(created) as month FROM ${users_table} WHERE account_type='user' GROUP BY MONTH(created) Order By created DESC LIMIT 12`);
        const results1 = db.results();
        for (let index = 0; index < results1.length; index++) {
            const result = results1[index];
            stats_data[result.month - 1] = result.count
        }

        for (let index = 0; index < stats_data.length; index++) {
            const value = stats_data[index];
            if (value === null && index < new Date().getMonth() + 1) {
                stats_data[index] = 0
            }
        }
        registration_stat.stats[0].data = stats_data


        // ORDER STATS STARTS HERE
        let order_statistic_stat = {
            stats_for: `${new Date().getFullYear()} Stats`,
            name: 'New certificates by months',
            stats: [{ name: 'Certificates', data: [] }]
        }
        let order_stat = [null, null, null, null, null, null, null, null, null, null, null, null]

        await db.query(`SELECT COUNT(id) as count, MONTH(created_at) as month FROM ${certificate_table} GROUP BY MONTH(created_at) Order By created_at DESC LIMIT 12`);
        const resultsO = db.results();
        for (let index = 0; index < resultsO.length; index++) {
            const result = resultsO[index];
            order_stat[result.month - 1] = result.count
        }

        for (let index = 0; index < order_stat.length; index++) {
            const value = order_stat[index];
            if (value === null && index < new Date().getMonth() + 1) {
                order_stat[index] = 0
            }
        }
        order_statistic_stat.stats[0].data = order_stat

        // INACTIVE ADMIN, VENDOR ,AGENT COUNTS STARTS HERE
        let count_stat = { cert_count: 0, admin_count: 0 }
        await db.query(`
        SELECT
        (SELECT COUNT(DISTINCT (id_number)) FROM ${certificate_table} ) cert_count,
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'admin') admin_count
         `);
        if (db.count() > 0) {
            count_stat = db.first();
        }


        response.status(200).json({
            count_stat: count_stat,
            registration_stat: registration_stat,
            order_statistic_stat: order_statistic_stat
        });
    },
};