const Joi = require('joi');

// is there uuid type in Joi

// create schemas that validate user input from the mobile
// other sign up schema
// .when('primaryValidator', {
//     is: 'email',
//     then: Joi.required(),
//     otherwise: Joi.optional().empty(null)
// }),
// phone: Joi.string().trim().when('primaryValidator', {
//     is: 'phone',
//     then: Joi.required(),
//     otherwise: Joi.optional().empty(null)
// }),
// primaryValidator: Joi.string().trim().valid('phone', 'email').required(),

let signUpInputSchema = Joi.object(
    {
        fullname: Joi.string().required(),
        password: Joi.string().trim().required(),
        deviceIdentifier: Joi.string().uuid({ version: 'uuidv4' }).trim().required(),
        role: Joi.string().trim().valid('user', 'ambulance', 'hospital').required(),
        birthDate: Joi.date().max('now').required(),
        email: Joi.string().email().trim().required(),
    }, {
    abortEarly: false
}
);


let otpInputSchema = Joi.object(
    {
        // we send in the pendingUserId and otpHashed
        userId: Joi.string().uuid({ version: 'uuidv4' }).trim().required(),
        otp: Joi.string().trim().required()
    }, {
    abortEarly: false
}
)


let emailInputSchema = Joi.object(
    {
        userId: Joi.string().uuid({ version: 'uuidv4' }).trim().required(),
        tokenString: Joi.string().trim().required()
        // both are from req.params
    }
    , {
        abortEarly: false
    }
)


let resendOtpSchema = Joi.object(
    {
        // we send in the pendingUserId and otpHashed
        userId: Joi.string().uuid({ version: 'uuidv4' }).trim().required()
    }, {
    abortEarly: false
}
)

let resendEmailSchema = Joi.object(
    {
        email : Joi.email().trim().required()
    },
    { abortEarly: false }
)

let checkPendingExistAndResendSchema = Joi.object(
    {
        email: Joi.string().email().trim().required()
    },
    { abortEarly: false }
)

let logInSchema = Joi.object(
    {
        logInVia: Joi.string().trim().valid('phone', 'email').required(),
        email: Joi.string().email().trim().when('logInVia', {
            is: 'email',
            then: Joi.required(),
            otherwise: Joi.optional().empty(null)
        }),
        phone: Joi.string().trim().when('logInVia', {
            is: 'phone',
            then: Joi.required(),
            otherwise: Joi.optional().empty(null)
        }),
        password: Joi.string().trim().required()
    },
    { abortEarly: false }
)



let logOutSchema = Joi.object(
    {
        randomString: Joi.string().trim().required(),
        exp: Joi.date().timestamp().required(),
        iat: Joi.number() // optional
    },
    { abortEarly: false }
)




module.exports = {
    signUpInputSchema,
    otpInputSchema,
    resendOtpSchema,
    logOutSchema,
    emailInputSchema,
    resendEmailSchema,
    checkPendingExistAndResendSchema,
    logInSchema
}