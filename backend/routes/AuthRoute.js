const express = require("express");

let authRouter = express.Router();
const AuthController = require('../controller/AuthController');
const { signUpInputValidator,otpInputValidator,resendOtpValidator,logOutValidator,emailInputValidator,resendEmailValidator,logInValidator, checkPendingExistAndResendValidator } = require('../middleware/JoiValidatorMiddleware');
const { refreshValidator } = require('../middleware/TokenValdiator');

let authController = new AuthController();

// authRouter.post('/verify-otp', otpInputValidator, authController.validateOtp);
// authRouter.get('/resend-otp', resendOtpValidator, authController.resendOtp);


authRouter.post('/sign-up', signUpInputValidator, authController.signUp); // checked
authRouter.get('/verify-email', emailInputValidator, authController.validateEmail); // checked
authRouter.post('/resend-verification', checkPendingExistAndResendValidator, authController.resendEmailVerificationViaEmail); // new route for Flutter
authRouter.post('/log-in' , logInValidator , authController.logIn); // checked
authRouter.post('/log-out' , refreshValidator  , logOutValidator , authController.logOut); // checked


module.exports = authRouter;
