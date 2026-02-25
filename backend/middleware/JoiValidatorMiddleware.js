const { valiatoreCreator , validatorForParams } = require('../utils/JoiValidatorFunc');
const { signUpInputSchema, otpInputSchema, resendOtpSchema, logOutSchema, emailInputSchema, resendEmailSchema, logInSchema } = require('../validators/schemaValidators')

let signUpInputValidator = valiatoreCreator(signUpInputSchema);
let otpInputValidator = valiatoreCreator(otpInputSchema);
let resendOtpValidator = validatorForParams(resendOtpSchema);
let logOutValidator = valiatoreCreator(logOutSchema);
let emailInputValidator = validatorForParams(emailInputSchema);
let resendEmailValidator = validatorForParams(resendEmailSchema);
let logInValidator = valiatoreCreator(logInSchema);



module.exports = {
    signUpInputValidator,
    // otpInputValidator,
    // resendOtpValidator,
    logOutValidator,
    emailInputValidator,
    resendEmailValidator,
    logInValidator
}