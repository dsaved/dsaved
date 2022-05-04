const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const mysql = require('../library/mysql');

const Socket = require('blockchain.info/Socket')

// CREATE NEW DB INSTANCE
const dbConfig = conf.db_config;
const db = new mysql(dbConfig);
const mySocket = new Socket()

/**
 * mapCars model for mapping cars to an article
 * @param payload is a variable holding the current job
 * @param callback this is a method called when the job is finished in other to terminate the process.
 */
exports.watchWalletTx = function(payload, callback) {
    var proccessID = process.pid;
    const data = payload.data;
    const addresses = payload.addresses;

    const start = async() => {
        try {
            mySocket.onOpen(function() {
                console.log("connection onOpen")
            })

            mySocket.onClose(function() {
                console.log("connection onClose")
                callback(null, { isDone: false, id: proccessID, data: data })
            })

            mySocket.onTransaction(function(tx) {
                console.log(tx)
            }, {
                addresses: addresses,
                setTxMini: true
            })

        } catch (err) {
            callback(null, { isDone: true, id: proccessID })
            console.error("Error occured: ", err)
        }
    }

    start()
}