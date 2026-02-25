const crypto = require('crypto');

function randomStringGenerator(){
    return crypto.randomBytes(64).toString('hex');
}


module.exports = randomStringGenerator;