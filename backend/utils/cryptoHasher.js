const crypto = require('crypto');

function cryptoHasher( valToBeHashed ){
    return crypto.createHash('sha-256').update(valToBeHashed).digest('hex');
}

module.exports = cryptoHasher;