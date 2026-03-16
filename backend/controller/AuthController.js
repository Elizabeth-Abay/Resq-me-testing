const SignUpServiceHandler = require('../service/AuthService');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

const { MOBILE_REDIRECT_URL } = process.env;

let signUpServiceHandler = new SignUpServiceHandler();

class AuthController {
    async signUp(req, res) {
        try {
            console.log(req.validatedBody, "is this req.validatedBody")
            let { fullname, email, phone, password, deviceIdentifier, role, birthDate } = req.validatedBody;

            let result = await signUpServiceHandler.signUp({
                fullname,
                email,
                phone,
                password,
                deviceIdentifier,
                role,
                birthDate
            });
            if (result.success) {
                return res.status(200).json(result.data);
            } else {
                return res.status(400).json(result);
            }
        } catch (err) {
            console.log("Error while AuthController.signUp ", err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    // async validateOtp(req, res) {
    //     try {
    //         let { userId, otp } = req.validatedBody;
    //         let result = await signUpServiceHandler.validateOtp({ userId, otp });
    //         if (result.success) {
    //             return res.status(200).json(result.data);
    //         } else {
    //             return res.status(400).json(result);
    //         }
    //     } catch (err) {
    //         console.log("Error while AuthController.validateOtp ", err.message);
    //         return res.status(500).json({ message: "Internal Server Error" });
    //     }
    // }


    // send the access and ref token through the redirect
    async validateEmail(req, res) {
        try {
            let { userId, tokenString } = req.validatedParams;
            // bc this is a get request
            let result = await signUpServiceHandler.validateEmailLink({ userId, tokenString });

            if (result.success) {
                let { accessToken, refreshToken } = result.data;

                // redirect users to their app
                const deepLink = `${MOBILE_REDIRECT_URL}?accessToken=${accessToken}&refreshToken=${refreshToken}`;


                return res.render('successRedirect' , {deepLink});
            } else {
                return res.status(400).json(result);
            }
        } catch (err) {
            console.log("Error while AuthController.validateEmail ", err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // async resendOtp(req, res) {
    //     try {
    //         let { userId } = req.validatedParams;
    //         let result = await signUpServiceHandler.resendOtp(userId);

    //         if (result.success) {
    //             return res.status(200).json({ message: "OTP resent successfully" });
    //         } else {
    //             return res.status(400).json(result);
    //         }
    //     } catch (err) {
    //         console.log("Error while AuthController.resendOtp ", err.message);
    //         return res.status(500).json({ message: "Internal Server Error" });
    //     }
    // }


    async resendEmailVerificationLink(req, res) {
        try {
            let { userId } = req.validatedParams;
            let result = await signUpServiceHandler.resendEmail(userId);

            if (result.success) {
                return res.status(200).json({ message: "Email verification link resent successfully" });
            } else {
                return res.status(400).json(result);
            }
        } catch (err) {
            console.log("Error while AuthController.resendEmailVerificationLink ", err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    async logIn(req, res) {
        let { logInVia, phone, email, password } = req.validatedBody;
        try {
            let result;
            if (logInVia === "email") {
                result = await signUpServiceHandler.logInWithEmail({ email, password });
            } else if (logInVia === "phone") {
                result = await signUpServiceHandler.logInWithPhone({ phone, password });
            } else {
                return res.status(400).json({ message: "Invalid log in method" });
            }
            if (result.success) {
                return res.status(200).json(result.data);
            } else {
                return res.status(400).json(result);
            }
        } catch (err) {
            console.log("Error while AuthController.logIn ", err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    async logOut(req, res) {
        try {
            let { randomString } = req.validatedBody; // random string from the refresh token that we want to invalidate
            let result = await signUpServiceHandler.logOut({ randomString });
            if (result.success) {
                return res.status(200).json({ message: "Logged out successfully" });
            } else {
                return res.status(400).json(result);
            }
        } catch (err) {
            console.log("Error while AuthController.logOut ", err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }
}


module.exports = AuthController;