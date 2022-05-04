var fs = require('fs')
var path = require('path')

class Configuration {
    constructor() {}
    static getConfig() {
        const configPath = path.join(process.cwd(), 'config.json');
        const configuration = fs.readFileSync(configPath);
        const conf = JSON.parse(configuration);
        return conf;
    }
}

module.exports = Configuration;