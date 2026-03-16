const pool = require('../config/pgConnection');

class AuthModelHandler {
    async putUsersDirectlyIntoVerified(sentInfo) {
        try {
            const { deviceIdentifier } = sentInfo;
            let query = `INSERT INTO verified_users (deviceIdentifier ) VALUES ($1 ) RETURNING id`;
            let values = [deviceIdentifier];
            // u will use this for emergency contacts only

            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true
                }
            }
            return {
                success: false
            }
        } catch (err) {
            if (err.code === '23505') {
                // this error code is for unique violation, which means that either email or phone number is already in use
                console.log("Email or phone number or device already in use ", err.detail);
            }
            console.log("Error in AuthModelHandler.putUsersDirectlyIntoVerified  ", err.message)
            return {
                success: false
            }
        }
    }

    async deleteEmergencyOnly(deviceIdentifier) {
        try {
            let query = `DELETE  FROM verified_users WHERE deviceIdentifier = $1 AND userRole = 'emergency_only'`;
            let values = [deviceIdentifier];

            let result = await pool.query(query, values);

            // either the user exist and is deleted or not
            return {
                success: true
            }
        } catch (err) {
            console.log("Error in AuthModelHandler.emailPhoneUniqueCheck  ", err.message)
            return {
                success: false
            }
        }
    }
    async emailPhoneDeviceIdUniqueCheck(sentInfo) {
        try {
            // to grasp early on the email and phone uniqueness before otp generation
            let { email, phone , deviceIdentifier } = sentInfo;

            let query = `SELECT * FROM verified_users WHERE email = $1 OR phone_number = $2 OR deviceIdentifier = $3`;
            let values = [email, phone , deviceIdentifier];

            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: false
                }
            }

            return {
                success: true
            }

        } catch (err) {
            console.log("Error in AuthModelHandler.emailPhoneUniqueCheck  ", err.message)
            return {
                success: false
            }
        }
    }

    async signUp(sentInfo) {
        try {
            const { deviceIdentifier, fullname, email, phone, otpHashed, passwordHashed, emailStringHashed, role , birthDate } = sentInfo;

            // EXCLUDED - means the row u tried to insert
            // , phone_number , deviceIdentifier ?? - how can u include this too
            const query = `
                INSERT INTO 
                pending_users (deviceIdentifier, fullname, email, phone_number, otp_hashed, password_hashed , email_verification_token_hashed , userRole , birthDate) 
                VALUES ($1, $2, $3, $4, $5, $6 , $7 , $8 , $9)
                ON CONFLICT (email)
                DO UPDATE SET
                    fullname = EXCLUDED.fullname ,
                    email = EXCLUDED.email ,
                    phone_number = EXCLUDED.phone_number ,
                    otp_hashed = EXCLUDED.otp_hashed,
                    password_hashed = EXCLUDED.password_hashed ,
                    email_verification_token_hashed = EXCLUDED.email_verification_token_hashed ,
                    userRole = EXCLUDED.userRole,
                    deviceIdentifier = EXCLUDED.deviceIdentifier,
                    birthDate = EXCLUDED.birthDate
                RETURNING id`;
            const values = [deviceIdentifier, fullname, email, phone, otpHashed, passwordHashed, emailStringHashed, role , birthDate];

            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    data: result.rows[0].id
                }
            }
            return {
                success: false
            }

        } catch (err) {
            console.log("Error in AuthModelHandler.signUp  ", err.message)
            return {
                success: false
            }
        }

    }


    // async otpVerification(pendingUserId) {
    //     try {
    //         const query = `SELECT otp_hashed , userRole FROM pending_users WHERE id = $1`;
    //         const values = [pendingUserId];
    //         let result = await pool.query(query, values);
    //         if (result.rows.length > 0) {
    //             let { otp_hashed, userrole } = result.rows[0];
    //             return {
    //                 success: true,
    //                 data: {
    //                     otpHashed: otp_hashed,
    //                     role: userrole
    //                 }
    //             }
    //         }
    //         return {
    //             success: false
    //         }
    //     } catch (err) {
    //         if (err.code === '23505') {
    //             // this error code is for unique violation, which means that either email or phone number is already in use
    //             console.log("Email or phone number or device already in use ", err.detail);
    //         }
    //         console.log("Error in AuthModelHandler.otpVerification  ", err.message)
    //         return {
    //             success: false
    //         }
    //     }
    // }


    async emailVerification(sentInfo) {
        try {
            let { userId } = sentInfo;


            let query = `SELECT email_verification_token_hashed , userRole FROM pending_users WHERE id = $1`;
            let values = [userId];

            let res = await pool.query(query, values);

            if (res.rowCount === 0) {
                return {
                    success: false
                }
            }

            let { email_verification_token_hashed, userrole } = res.rows[0];
            return {
                success: true,
                data: {
                    emailVerificationToken: email_verification_token_hashed,
                    role: userrole
                }
            }

        } catch (err) {
            if (err.code === '23505') {
                // this error code is for unique violation, which means that either email or phone number is already in use
                console.log("Email or phone number or device already in use ", err.detail);
            }
            console.log("Error in AuthModelHandler.emailVerification ", err.message)
            return {
                success: false
            }
        }
    }

    async putUserIntoVerified(pendingUserId) {
        try {
            let query = 'SELECT * FROM move_users_into_verified( $1 )'
            let value = [pendingUserId];

            let result = await pool.query(query, value);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    pendingUser: result.rows[0]
                }
            }
            return {
                success: false
            }



        } catch (err) {
            console.log("Error in AuthModelHandler.putUserIntoVerified ", err.message)
            return {
                success: false
            }
        }
    }


    // async resendOtp(sentInfo) {
    //     try {
    //         const { otpHashed, userId } = sentInfo;
    //         const query = `UPDATE pending_users SET otp_hashed = $1 WHERE id = $2 RETURNING phone_number`;
    //         const values = [otpHashed, userId];
    //         let result = await pool.query(query, values);

    //         if (result.rows.length > 0) {
    //             return {
    //                 success: true,
    //                 phone: result.rows[0].phone_number
    //             }
    //         }
    //         return {
    //             success: false
    //         }
    //     } catch (err) {
    //         console.log("Error in AuthModelHandler.resendOtp  ", err.message)
    //         return {
    //             success: false
    //         }
    //     }
    // }


    async resendEmailVerification(sentInfo) {
        try {
            let { emailStringHashed, userId } = sentInfo;
            let query = `UPDATE pending_users SET email_verification_token_hashed = $2 WHERE id = $1 RETURNING email`;
            let values = [userId, emailStringHashed];

            let result = await pool.query(query, values);

            if (result.rowCount === 0) {
                return {
                    success: false
                }
            }

            return {
                success: true,
                email: result.rows[0].email
            }

        } catch (err) {
            console.log("Error in AuthModelHandler.resendEmailVerification ", err.message)
            return {
                success: false
            }
        }
    }

    async findPendingUserByEmail(email) {
        try {
            let query = `SELECT id FROM pending_users WHERE email = $1`;
            let values = [email];

            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    userId: result.rows[0].id
                }
            }
            return {
                success: false
            }

        } catch (err) {
            console.log("Error in AuthModelHandler.findPendingUserByEmail ", err.message)
            return {
                success: false
            }
        }
    }

    async deletePendingUser(pendingUserId) {
        try {
            // first collect all pendingUserIds that need to be deleted, then pass that array to the query
            // to have batch delete functionality, we can use ANY operator in SQL and pass an array of pendingUserIds
            const query = `DELETE FROM pending_users WHERE id = ANY($1)`;
            const values = [pendingUserId];
            let result = await pool.query(query, values);
            if (result.rows.length > 0) {
                return {
                    success: true
                }
            }
            return {
                success: false
            }
        } catch (err) {
            console.log("Error in AuthModelHandler.deletePendingUser  ", err.message)
            return {
                success: false
            }
        }
    }

    async logInPhone(sentInfo) {
        try {
            // when u logIn why do we update device id
            let { phone} = sentInfo;
            let query = `SELECT password_hashed , id , userRole  FROM verified_users WHERE phone_number = $1 `; 
                // problem in here returing wont work
            let values = [phone];

            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    data: result.rows[0]
                }
            }
            return {
                success: false
            }
        } catch (err) {
            console.log("Error in AuthModelHandler.logInPhone  ", err.message)
            return {
                success: false
            }
        }
    }

    async logInEmail(sentInfo) {
        try {
            let { email} = sentInfo;
            let query = `SELECT password_hashed , id , userRole  FROM verified_users WHERE email = $1 `; 
            let values = [email];
            let result = await pool.query(query, values);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    data: result.rows[0]
                }
            }
            return {
                success: false
            }
        } catch (err) {
            console.log("Error in AuthModelHandler.logInEmail  ", err.message)
            return {
                success: false
            }
        }
    }

}

module.exports = { AuthModelHandler }