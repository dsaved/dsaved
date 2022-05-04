const mysql = require('../library/mysql');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();

const table = "addresses"
const db = new mysql(conf.db_config);

const { HDPublicKey, PublicKey, Address, Networks } = require('bitcore-lib')

module.exports = {
    getWallet: async function() {
        let addressWallet = null
            // Todo if no address is available return null
        await db.query(`SELECT address FROM ${table} AS r1 JOIN (SELECT CEIL(RAND() * (SELECT MAX(id) FROM ${table})) AS id) AS r2 WHERE r1.id >= r2.id AND r1.used = 0 ORDER BY r1.id ASC LIMIT 1 `)
        if (db.count() > 0) {
            addressWallet = db.first().address
            await db.update(table, 'address', addressWallet, { used: 1 })
        }
        return addressWallet;
    },
    generateWallets: async function() {
        await db.query(`SELECT address FROM ${table} WHERE used = 0`)
        if (db.results() <= 3) {
            for (let i = 0; i < 20; i++) {
                const hdPublicKey = HDPublicKey(conf.x_pub_key);
                const orderPublicKey = hdPublicKey.deriveChild(`m/0/${i}`)

                var pubkey = PublicKey(orderPublicKey.publicKey)
                var address = Address.fromPublicKey(pubkey, Networks.livenet)
                await db.query(`select address from ${table} where address='${address}'`)
                if (db.count() <= 0) {
                    await db.insert(table, { address: `${address}` })
                }
            }
        } else {
            // console.log("No address needed to generate")
        }
    }
};