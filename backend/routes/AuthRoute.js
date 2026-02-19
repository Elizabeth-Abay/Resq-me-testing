const express = require("express");

let authRouter = express.Router();
const AuthController = require('../controller/AuthController');
const { signUpInputValidator,otpInputValidator,resendOtpValidator,logOutValidator,emailInputValidator,resendEmailValidator,logInValidator } = require('../middleware/JoiValidatorMiddleware');
const { refreshValidator } = require('../middleware/TokenValdiator');

let authController = new AuthController();

// authRouter.post('/verify-otp', otpInputValidator, authController.validateOtp);
// authRouter.get('/resend-otp', resendOtpValidator, authController.resendOtp);


authRouter.post('/sign-up', signUpInputValidator, authController.signUp); // checked
authRouter.get('/verify-email', emailInputValidator, authController.validateEmail); // checked
authRouter.get('/resend-email-verification-link', resendEmailValidator, authController.resendEmailVerificationLink); // test it
authRouter.post('/log-in' , logInValidator , authController.logIn); // checked
authRouter.post('/log-out' , refreshValidator  , logOutValidator , authController.logOut); // checked


module.exports = authRouter;
