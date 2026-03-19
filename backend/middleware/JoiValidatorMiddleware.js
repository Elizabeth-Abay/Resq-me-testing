const { valiatoreCreator, validatorForParams } = require('../utils/JoiValidatorFunc');
const { signUpInputSchema, otpInputSchema, resendOtpSchema, logOutSchema, emailInputSchema, resendEmailSchema, checkPendingExistAndResendSchema, logInSchema } = require('../validators/schemaValidators')

let signUpInputValidator = valiatoreCreator(signUpInputSchema);
let otpInputValidator = valiatoreCreator(otpInputSchema);
let resendOtpValidator = validatorForParams(resendOtpSchema);
let logOutValidator = valiatoreCreator(logOutSchema);
let resendEmailValidator = (resendEmailSchema);
let emailInputValidator = validatorForParams(emailInputSchema);
let checkPendingExistAndResendValidator = valiatoreCreator(resendEmailSchema);
let logInValidator = valiatoreCreator(logInSchema);

module.exports = {
    signUpInputValidator,
    otpInputValidator,
    resendOtpValidator,
    // otpInputValidator,
    // resendOtpValidator,
    logOutValidator,
    emailInputValidator,
    resendEmailValidator,
    checkPendingExistAndResendValidator,
    logInValidator
}
