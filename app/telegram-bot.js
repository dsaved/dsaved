const mysql = require('../library/mysql');
const encryption = require('../library/encryption');
const encrypt = new encryption();
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const functions = require('../helpers/functions');
const walletAddress = require('../helpers/wallet-address');
const QRCode = require("qrcode")

//tables
const users_table = "users";
const transactions_table = "transactions"
const address_table = "addresses"

const CREATE_ACCOUNT = '/createaccount'
const UPDATE_PASSWORD = '/updatepassword'
const ADD_BALANCE = '/topupbalance '
const LOAD_BALANCE = '/loadbalance'
const PROCEED = '/proceed'
const CANCEL = '/cancel'
const YES = '/yes'
const CANCEL_TRANSACTION = '/canceltransaction'

const db = new mysql(conf.db_config);

let accountCreationData = {
    username: null,
    passsword: null,
    from: null
}
let newPassword = null
let waitForUsername = false;
let waitForPassword = false;
let waitForPasswordChange = false;

let paymentWaitInterval = null
let pendingAddress = null
let txID = 0

const bot = {
    start: async(bot) => {
        try {
            // Listen for start.
            bot.onText(/\/start/, (msg) => {
                startProccess(bot, msg)
                return;
            });

            // Listen for createaccount.
            bot.onText(/\/createaccount/, (msg) => {
                createAccount(bot, msg.chat)
                return;
            });

            // Listen for updatepassword.
            bot.onText(/\/updatepassword/, (msg) => {
                updatePassword(bot, msg.chat)
                return;
            });

            // Listen for loadbalance.
            bot.onText(/\/loadbalance/, (msg) => {
                loadalance(bot, msg.chat)
                return;
            });

            // Listen for topupbalance.
            bot.onText(/\/topupbalance/, (msg) => {
                addbalance(bot, msg.chat)
                return;
            });

            // Listen for any kind of message.
            bot.on('message', async(msg) => {
                if (!msg.text.startsWith("/")) {
                    if (msg.text && waitForUsername) {
                        const username = msg.text.trim();
                        await db.query(`select username from ${users_table} where username = '${username}'`);
                        if (db.count() > 0) {
                            bot.sendMessage(msg.chat.id, 'Username already exist\nPlease choose another username')
                            return;
                        } else {
                            waitForUsername = false
                            accountCreationData.username = username
                            waitForPassword = true
                            bot.sendMessage(msg.chat.id, 'Send your password')
                        }
                    } else if (msg.text && waitForPassword) {
                        waitForPassword = false
                        accountCreationData.passsword = msg.text
                        bot.sendMessage(msg.chat.id, `Please confirm the provided detials\n\n \rUsername: ${accountCreationData.username}\n\rPassword: ${accountCreationData.passsword}\n\n procees to create account?`, {
                            reply_markup: {
                                "inline_keyboard": [
                                    [{
                                        text: "Proceed",
                                        callback_data: PROCEED
                                    }],
                                    [{
                                        text: "Cancel",
                                        callback_data: CANCEL
                                    }]
                                ]
                            }
                        })
                    } else if (msg.text && waitForPasswordChange) {
                        waitForPasswordChange = false
                        newPassword = msg.text
                        bot.sendMessage(msg.chat.id, `Set this password as your current password?`, {
                            reply_markup: {
                                "inline_keyboard": [
                                    [{
                                        text: "Yes",
                                        callback_data: YES
                                    }],
                                    [{
                                        text: "No",
                                        callback_data: CANCEL
                                    }]
                                ]
                            }
                        })
                    } else {
                        bot.sendMessage(msg.chat.id, 'Please use the command \/start')
                    }
                }
            });

            bot.on('callback_query', async query => {
                const {
                    message: {
                        chat,
                        message_id,
                        text
                    } = {}
                } = query
                switch (query.data) {
                    case CREATE_ACCOUNT:
                        createAccount(bot, chat)
                        break
                    case UPDATE_PASSWORD:
                        updatePassword(bot, chat)
                        break
                    case LOAD_BALANCE:
                        loadalance(bot, chat)
                        break
                    case ADD_BALANCE:
                        addbalance(bot, chat)
                        break
                    case PROCEED:
                        if (accountCreationData.username === null || accountCreationData.from === null || accountCreationData.passsword === null) {
                            startProccess(bot, {
                                chat,
                                text
                            })
                            return
                        }

                        let insertData = {
                            first_name: accountCreationData.from.first_name,
                            last_name: accountCreationData.from.last_name,
                            username: accountCreationData.username,
                            chatid: accountCreationData.from.id,
                            password: await encrypt.hash(accountCreationData.passsword),
                        }
                        const done = await db.insert(users_table, insertData);
                        if (done) {
                            const userid = db.lastInsertID();
                            await functions.getAuthorization(userid);

                            bot.sendMessage(chat.id, `Account created successfully\nLogin Here: [${conf.main_site}/login](${conf.main_site}/login)`, {
                                parse_mode: "markdown",
                                reply_markup: {
                                    "inline_keyboard": [
                                        [{
                                            "text": "Open link",
                                            "url": `${conf.main_site}/login`
                                        }]
                                    ]
                                }
                            })
                        } else {
                            bot.sendMessage(chat.id, 'Account could not be created, please try again later')
                        }
                        break
                    case YES:
                        if (newPassword === null) {
                            startProccess(bot, {
                                chat,
                                text
                            })
                            return
                        }

                        const success = await db.update(users_table, 'chatid', chat.id, { password: await encrypt.hash(newPassword) });
                        if (success) {
                            bot.sendMessage(chat.id, `Password updated successfully`)
                            newPassword = null
                        } else {
                            bot.sendMessage(chat.id, 'Error updating password, please try again later')
                        }
                        break
                    case CANCEL:
                        bot.sendMessage(chat.id, 'Action Canceled')
                        break
                    case CANCEL_TRANSACTION:
                        cancelTransaction(bot, chat)
                        break
                    default:
                }
                bot.answerCallbackQuery({
                    callback_query_id: query.id
                })
            })

        } catch (err) {
            console.error("Error occured: ", err)
        }
    }
}

async function createAccount(bot, chat) {
    await db.query(`select username from ${users_table} where chatid = '${chat.id}'`);
    if (db.count() > 0) {
        bot.sendMessage(chat.id, `You already have an accout with the username: "${db.first().username}"`)
        return;
    } else {
        accountCreationData.from = chat
        waitForUsername = true;
        bot.sendMessage(chat.id, 'Send your username')
    }
}

async function updatePassword(bot, chat) {
    await db.query(`select username from ${users_table} where chatid = '${chat.id}'`);
    if (db.count() > 0) {
        waitForPasswordChange = true;
        bot.sendMessage(chat.id, 'Send your new password')
    } else {
        no_account(bot, chat)
    }
}

async function loadalance(bot, chat) {
    await db.query(`select balance from ${users_table} where chatid = '${chat.id}'`);
    if (db.count() > 0) {
        const userData = db.first()
        bot.sendMessage(chat.id, `You account balance is: $${userData.balance}`)
    } else {
        no_account(bot, chat)
    }
}

async function cancelTransaction(bot, chat) {
    await db.query(`select * from ${transactions_table} where chatid = '${chat.id}' and (status='pending' or status='proccessing') and id=${txID}`);
    if (db.count() > 0) {
        const transactionData = db.first()
        const done = await db.update(address_table, 'address', transactionData.address, { used: 0 })
        if (done) {
            await db.query(`update ${transactions_table} set status = 'cancelled' where chatid='${chat.id}' and id=${txID}`)
            bot.sendMessage(chat.id, `Transaction has been cancelled successfully`)
        } else {
            bot.sendMessage(chat.id, `Transaction could not be cancelled`)
        }
    } else {
        bot.sendMessage(chat.id, `You have no pending transaction`)
    }
}

async function addbalance(bot, chat) {
    const amount = 2.00;
    const file = `public/uploads/.temp/bitcoin.png`;
    await db.query(`select * from ${transactions_table} where chatid = '${chat.id}' and (status='pending' or status='proccessing') LIMIT 1`);
    if (db.count() > 0) {
        const transactionPending = db.first()
        const address = transactionPending.address;
        pendingAddress = transactionPending.address;
        const convertedAmount = transactionPending.expected_amount
        txID = transactionPending.id

        QRCode.toFile(file, `bitcoin:${address}?amount=${convertedAmount}`, {}, function(err) {
            if (err) throw err
            bot.sendPhoto(chat.id, file, {
                caption: `You have a pending Transaction to complete,\n\nSend $${amount} or more worth of BTC to ${address}`,
                reply_markup: {
                    "inline_keyboard": [
                        [{
                            text: "Cancel transaction",
                            callback_data: CANCEL_TRANSACTION
                        }]
                    ]
                }
            });
        })
    } else {
        const address = await walletAddress.getWallet();
        const convertedAmount = await functions.getRate(amount, { from: "USD", to: "BTC" }).catch(error => console.error(error))
        pendingAddress = address;
        await db.insert(transactions_table, {
            chatid: chat.id,
            address: `${address}`,
            expected_amount: convertedAmount
        })
        txID = db.lastInsertID();

        QRCode.toFile(file, `bitcoin:${address}?amount=${convertedAmount}`, {}, function(err) {
            if (err) throw err
            bot.sendPhoto(chat.id, file, { caption: `Send $${amount} or more worth of BTC to ${address}` });
        })

        checkPaymentStatus(bot, chat);
    }
}

async function checkPaymentStatus(bot, chat) {
    const startTime = new Date();
    paymentWaitInterval = setInterval(async() => {
        const endTime = new Date();
        let timeDiff = endTime - startTime; //in ms
        // strip the ms
        timeDiff /= 1000;
        // get seconds 
        const seconds = Math.round(timeDiff);
        // check for transaction status and update user accordinly

        await db.query(`select * from ${transactions_table} where chatid = '${chat.id}' and id = ${txID} LIMIT 1`);
        if (db.count() > 0) {
            const result = db.first()
            if (result.status === 'cancelled') {
                clearInterval(paymentWaitInterval)
                bot.sendMessage(chat.id, `Your transaction has been cancelled`)
            } else if (result.status === 'proccessing') {
                bot.sendMessage(chat.id, `Waiting to recieve your payment`)
            }
        }

        // bot.sendMessage(chat.id, `${seconds}s passed. still waiting for your payment`)
    }, 1000);
}

function startProccess(bot, msg) {
    const chat = msg.chat;
    const message = msg.text;

    bot.sendMessage(chat.id, 'What will you like to do?', {
        reply_markup: {
            "inline_keyboard": [
                [{
                    text: "Create Account",
                    callback_data: CREATE_ACCOUNT
                }],
                [{
                    text: "Update Password",
                    callback_data: UPDATE_PASSWORD
                }],
                [{
                    text: "Load Balance",
                    callback_data: LOAD_BALANCE
                }],
                [{
                    text: "Top Up Balance",
                    callback_data: ADD_BALANCE
                }]
            ]
        }
    })
}

function no_account(bot, chat) { bot.sendMessage(chat.id, 'You do not have an account with us\n please use the command \/start or \/createaccount to register.') }

module.exports = bot;