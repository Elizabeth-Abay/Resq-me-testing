const bcrypt = require('bcrypt');

async function bcryptCompare(plainText, hashedValue) {
    try {
        let result = await bcrypt.compare(plainText, hashedValue);
        return result;
    } catch (err) {
        console.log("Error in bcryptCompare ", err.message);
        return false;
    }
}

module.exports = bcryptCompare;