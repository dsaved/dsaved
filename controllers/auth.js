const encryption = require('../library/encryption');
const Pagination = require('../library/MYSqlPagination');
const { mail } = require('../helpers/mailer');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const encrypt = new encryption();
const conf = Configuration.getConfig();

//database tables
const users_table = "users";
const users_page_table = "users_page";
const users_role_table = "users_role";

module.exports = {
    async login(request, response) {
        const params = request.body;

        if (params.user && params.password) {
            const user = params.user;
            const password = params.password;

            const db = new mysql(conf.db_config)
            const queryString = `select id,username,first_name,last_name,phone,email,password,country from ${users_table} where username = '${user}' OR email = '${user}'`;

            await db.query(queryString);
            if (db.count() > 0) {
                const userdata = db.first();
                const passed = await encrypt.compare(password, userdata.password);
                if (passed) {
                    let authorization = await functions.getAuthorization(userdata.id);
                    let user = {
                        userid: userdata.id,
                        auth: authorization
                    }
                    response.status(200).json({ success: true, user: user, message: "welcome back" });
                } else {
                    response.status(200).json({ success: false, message: 'incorrect details provided' });
                }
            } else {
                response.status(200).json({ success: false, message: 'user not fond' });
            }
        } else {
            response.status(200).json({ message: 'Please provide user and password', success: false });
        }
    },
    async register(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const first_name = (params.firstname) ? params.firstname : null;
        const last_name = (params.lastname) ? params.lastname : null;
        const phone = (params.phone) ? params.phone : null;
        const email = (params.email) ? params.email : null;
        const password = (params.password) ? params.password : null;

        if (!first_name) {
            response.status(200).json({
                message: 'Please provide first name',
                success: false
            });
            return;
        }
        if (!last_name) {
            response.status(200).json({
                message: 'Please provide last name',
                success: false
            });
            return;
        }
        if (!phone) {
            response.status(200).json({
                message: 'Please provide email address',
                success: false
            });
            return;
        }
        if (!email) {
            response.status(200).json({
                message: 'Please provide email number',
                success: false
            });
            return;
        }
        if (!password) {
            response.status(200).json({
                message: 'Please provide password',
                success: false
            });
            return;
        }

        await db.query(`select phone from ${users_table} where phone = '${phone}'`);
        if (db.count() > 0) {
            response.status(200).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        await db.query(`select email from ${users_table} where email = '${email}'`);
        if (db.count() > 0) {
            response.status(200).json({
                message: 'this email already exist',
                success: false
            });
            return;
        }

        const username = email.split('@')[0];
        let insertData = {
            first_name: first_name,
            last_name: last_name,
            phone: phone,
            email: email,
            username: username,
            country: "GH",
            password: await encrypt.hash(password),
        }

        const done = await db.insert(users_table, insertData);
        if (done) {
            const userid = db.lastInsertID();
            let authorization = await functions.getAuthorization(userid);
            let user = {
                userid,
                auth: authorization
            }

            const msg = await welcomNewUser({ name: `${first_name} ${last_name}`, username: username, password: password, })
            await mail({ to: email, subject: "ACCOUNT CREATION SUCCESSFUL", message: msg, image: 'register.jpg' })
            response.status(200).json({ success: true, user: user, message: "Account created successfully" });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async recover(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const user = (params.user) ? params.user : null;

        await db.query(`select first_name, last_name, phone, email, id from ${users_table} where phone = '${user}' or email = '${user}'`);
        if (db.count() < 1) {
            response.status(403).json({
                message: 'Email Or Phone number does not exist',
                success: false
            });
            return;
        }
        const user_data = db.first();

        const password = functions.hexCode(8).toUpperCase()
        const hashed_password = await encrypt.hash(password)
        const updateData = {
            password: hashed_password,
        }
        const done = await db.update(users_table, "id", user_data.id, updateData);
        if (done) {
            const message = password_message_sms({ password });
            // await functions.sendSMS(phone, message)
            const name = `${user_data.first_name} ${user_data.last_name}`
            const message_mail = await password_message_email({ name: name, password });
            await mail({ to: user_data.email, subject: "PASSWORD RESET", message: message_mail, image: 'recover.jpg' })
            response.status(200).json({
                message: 'Password reset done',
                success: true
            });
        } else {
            response.status(403).json({
                message: 'could not reset your password',
                success: false
            });
        }
    },
};