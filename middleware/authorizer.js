const mysql = require('../library/mysql');
const Configuration = require('../library/Configs');

module.exports = async function(req, res, next) {
    const headers = req.headers
    let token = null;
    if (headers.Authorization) {
        token = headers.Authorization.substring(7)
    } else if (headers.authorization) {
        token = headers.authorization.substring(7)
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'No credentials supplied' });
    } else if (await validate(token) !== true) {
        res.status(401).json({ success: false, message: '401 token invalid' });
    } else {
        next()
    }
}

async function validate(authorization_token) {
    let token = Buffer.from(authorization_token, 'base64').toString()
    let access_credentials = token.split(":");
    if (access_credentials.length > 1) {
        const conf = Configuration.getConfig();
        const db = new mysql(conf.db_config)

        let user_id = access_credentials[0].trim();
        let auth = access_credentials[1].trim();
        const queryString = `SELECT * FROM authentication WHERE user_id = ${user_id} AND auth='${auth}' LIMIT 1`;

        await db.query(queryString);
        if (db.count() > 0) {
            let data = db.first()
            let authData = { "requests": Number(data.requests) + 1 }
            db.update('authentication', 'user_id', user_id, authData);
            return true;
        }
    }
    return false;
}