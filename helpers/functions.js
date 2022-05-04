const encryption = require('../library/encryption');
const mysql = require('../library/mysql');
const Configuration = require('../library/Configs');
const fs = require('fs');
const path = require('path');

const encrypt = new encryption();
const conf = Configuration.getConfig()
const axios = require('axios')


module.exports = {
    formatMessage: function(html, data) {
        let template = String(html)
        for (const key in data) {
            const value = data[key];
            var re = new RegExp('{{' + key + '}}', 'g');
            template = template.replace(re, value);
        }
        return template;
    },
    getAuthorization: async function(id) {
        let aes256Key = await encrypt.salt(12);
        const db = new mysql(conf.db_config);

        await db.query(`SELECT * FROM authentication WHERE user_id = ${id} LIMIT 1`);
        const authData = {
            "user_id": id,
            "auth": aes256Key
        }
        if (db.count() > 0) {
            db.update("authentication", 'user_id', id, authData);
        } else {
            db.insert("authentication", authData);
        }
        return Buffer.from(`${id}:${aes256Key}`).toString('base64');
    },
    getUniqueNumber: async function(table, column, len, hex) {
        //Usage: await functions.getUniqueNumber('sales', 'sales_number', 10, false)
        const db = new mysql(conf.db_config);
        let shouldContinue = false;
        let return_str = '';

        while (shouldContinue == false) {
            const length = 2000;
            let characters = '';

            if (hex) {
                characters = "0123456789OPQdejklmnEFGHIopqrABCDstyWXYZzJKLMNabcRSfghiTUuvwxV";
            } else {
                characters = "0123456789";
            }

            let string = Date.now();
            let string2 = "";

            for (var p = 0; p < length; p++) {
                var min = 0;
                var max = characters.length - 1;
                string += characters[Math.floor(Math.random() * (max - min + 1)) + min];
            }

            for (var p = 0; p < length; p++) {
                var min = 0;
                var max = characters.length - 1;
                string2 += characters[Math.floor(Math.random() * (max - min + 1)) + min];
            }

            string = `${string2}${string}`;
            string = string.split('.').join('');
            const checkLent = `${string}`.length;
            return_str = (checkLent > len) ? `${string}`.substring(0, len) : string;

            await db.query(`SELECT ${column} FROM ${table} WHERE ${column} = '${return_str}' LIMIT 1`);
            if (db.count() > 0) {
                shouldContinue = false
            } else {
                shouldContinue = true
            }
        }
        return return_str;
    },
    encode: function(data) {
        return Buffer.from(data).toString('base64');
    },
    decode: function(base64String) {
        return Buffer.from(base64String, 'base64').toString('ascii');
    },
    numberCode: function(count) {
        var chars = '0123456789'.split('');
        var result = '';
        for (var i = 0; i < count; i++) {
            var x = Math.floor(Math.random() * chars.length);
            result += chars[x];
        }
        return result;
    },
    hexCode: function(count) {
        var chars = 'acdefhiklmnoqrstuvwxyz0123456789'.split('');
        var result = '';
        for (var i = 0; i < count; i++) {
            var x = Math.floor(Math.random() * chars.length);
            result += chars[x];
        }
        return result;
    },
    getDateDiff: function(d1, d2) {
        var t2 = d2.getTime();
        var t1 = d1.getTime();
        return parseInt((t2 - t1) / (24 * 3600 * 1000));
    },
    formatMoney(money) {
        var formater = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'GHs'
        })
        return formater.format(money)
    },
    dateWord({ date = '', month = true, day = true, year = true }) {
        const dob = new Date(`${date}`);
        const dobArr = dob.toDateString().split(' ');
        let data = day ? dobArr[2] + ' ' : ''
        data += month ? dobArr[1] + ' ' : ''
        data += year ? dobArr[3] : ''
        return data
    },
    async getRate(amount, { from = "USD", to = "BTC" }) {
        return new Promise(async(resolve, reject) => {
            axios.default.defaults.headers.common['X-CoinAPI-Key'] = conf.XCoinAPIKey
            axios.default.get(`https://rest.coinapi.io/v1/exchangerate/${from}/${to}`)
                .then(function(result) {
                    const rate = (result.data.rate).toFixed(8)
                    resolve(rate * amount)
                })
                .catch(function(error) {
                    console.log(error)
                    reject(error)
                });
        });
    }
}