const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');

const axios = require('axios');
const socketConnect = {
    start: async(io) => {
        try {
            io.on('connection', function(socket) {
                console.log('client connected')
                    //on new_connection extablished
                    //store the connection channel in an array agaist the user name
                socket.on('new_connection', data => {
                    //first message sent to confirm if client can receive message
                    socket.emit('event_response', "Welcome!");
                });

                //check online status of a connected user
                socket.on('trading', async data => {});

                //check online status of a connected user
                socket.on('abouttotrade', async data => {});

                // when the user disconnects.. perform this
                socket.on('disconnect', function() {
                    console.log('client disconnected')
                });
            });
        } catch (err) {
            console.error("Error occured: ", err)
        }
    }
}


async function asyncForEach(array, arrayCallback) {
    for (let index = 0; index < array.length; index++) {
        await arrayCallback(array[index], index, array);
    }
}

module.exports = socketConnect;