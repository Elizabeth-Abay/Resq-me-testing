const bcrypt = require('bcrypt');

// errors thrown here will be caught in the service handler and handled there
async function bcryptHasher(valToBeHashed) {
    let saltGen = await bcrypt.genSalt();
    let hashedVal = await bcrypt.hash(valToBeHashed, saltGen);
    return hashedVal;
}


module.exports = bcryptHasher;