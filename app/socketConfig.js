var fs = require('fs');
// ========
module.exports = {
    isSecure: false, //set to true to use certs in https connection
    cert: {
        key: fs.readFileSync(process.cwd() + '/cert/private.key', 'utf8'),
        cert: fs.readFileSync(process.cwd() + '/cert/certificate.crt', 'utf8'),
        ca: fs.readFileSync(process.cwd() + '/cert/ca_bundle.crt', 'utf8')
    },
}