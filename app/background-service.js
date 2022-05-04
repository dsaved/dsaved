const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const fs = require('fs');
const path = require('path');
const walletAddress = require('../helpers/wallet-address');

var workerFarm = require('worker-farm'),
    workers = workerFarm(require.resolve('../modules/work-farm'), [
        'watchWalletTx',
    ]);

//DATABASE TABLES
const address_table = "addresses"
const transactions_table = "transactions"

const dbConfig = conf.db_config;
const maxJob = 5
let currentJobIm = 0

// CREATE NEW DB INSTANCE
const db = new mysql(dbConfig);

const backgoundService = {
    start: async() => {
        // run every 2 hours
        setInterval(() => runJob2hour(), 60 * 120 * 1000);

        // run every 1 hour 30 minutes
        setInterval(() => runJob1hour30mins(), 60 * 90 * 1000);

        // run every 1 hour
        setInterval(() => runJob1hour(), 60 * 60 * 1000);

        // run every 2 seconds
        setInterval(() => runJob2sec(), 2000);

        // run every 20 seconds
        setInterval(() => runJob20sec(), 20000);

        // run every 1 second
        setInterval(() => runJob1sec(), 1000);
    }
}

// JOB RUNNERS
function runJob1sec() {}

function runJob2sec() {}

function runJob20sec() {
    workFarm()
    clearTemp()
    walletAddress.generateWallets()
}

function runJob1hour() {}

function runJob1hour30mins() {}

function runJob2hour() {}

// FUNCTIONS
async function clearTemp() {;
    const directory = './public/uploads/.temp';
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) throw err;
            });
        }
    });
}

async function workFarm() {
    if (currentJobIm < maxJob) {
        await db.query(`select id, address, chatid, expected_amount from ${transactions_table} where status='pending'`)
        const addresses = db.results()
        if (db.count() > 0) {
            const watchAddresses = addresses.map((addr => addr.address))
            const query = `update ${transactions_table} set status='proccessing' where status='pending' and address IN (${watchAddresses.map(data=> '\''+data+'\'')})`
            await db.query(query)
            watcherWatch({ addresses: watchAddresses, data: addresses })
        }
    }
}

async function runFailedJobs(id) {
    if (currentJobIm < maxJob) {
        await db.query(`select id, address, chatid, expected_amount from ${transactions_table} where status='proccessing' and id IN (${id})`)
        const addresses = db.results()
        if (db.count() > 0) {
            const watchAddresses = addresses.map((addr => addr.address))
            watcherWatch({ addresses: watchAddresses, data: addresses })
        }
    }
}

function watcherWatch(data) {
    workers.watchWalletTx(data, function(err, result) {
        if (result.isDone) {
            process.kill(result.id);
            currentJobIm--;
        } else if (result.isDone === false) {
            process.kill(result.id);
            currentJobIm--;
            runFailedJobs(result.data.map(data => data.id))
        }
    })
}
module.exports = backgoundService;