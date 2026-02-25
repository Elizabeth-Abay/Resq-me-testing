const otp = require('otp-generator');


function otpGenerator(){
    return otp.generate(
        6,
        {
            upperCaseAlphabets : true,
            lowerCaseAlphabets : true,
            digits: true
        }
    )
}

module.exports = otpGenerator;