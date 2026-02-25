const { AuthModelHandler } = require("../model/AuthModel");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

const randomStringGenerator = require('../utils/randomStringGenerator');
const cryptoHasher = require('../utils/cryptoHasher');
const tokenModel = require('../model/tokenModel');

dotenv.config(
    {
        path: path.resolve(__dirname, '../../.env')
    }
)


let tokenModelHandler = new tokenModel();
let { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;



class TokenGenerationServiceHandler {
    accessTokenGenerator({ userId, role }) {
        // access token expires every 1 hr
        let oneHr = 3600; // 1 hr = 3600 sec;
        let current = Math.floor(Date.now() / 1000); // to convert 
        let accessToken = jwt.sign({
            userId,
            role,
            exp: current + oneHr
        }, ACCESS_TOKEN_SECRET)


        return {
            success: true,
            accessToken
        }
    }


    async refreshTokenGenerator({ userId , role }) {
        try {
            // we need 2 obj - one to send to client and one to save in database
            let randomString = randomStringGenerator();
            let randomStringHashed = cryptoHasher(randomString);
            let twenty_days_from_now = 20 * 24 * 60 * 60; // 20 days in seconds
            let exp = Date.now() / 1000 + twenty_days_from_now;

            let objSentToClient = {
                randomString,
                exp
            }

            let sentToDataBase = {
                userId,
                randomStringHashed,
                role
            }

            console.log("sent to the database " , sentToDataBase )

            let res = await tokenModelHandler.putRefreshTokenInfo(sentToDataBase);

            if (!res.success) {
                return {
                    success: false
                }
            }

            let refreshToken = jwt.sign(objSentToClient, REFRESH_TOKEN_SECRET);

            return {
                success: true,
                refreshToken
            }

        } catch (err) {
            console.log("Error while refreshTokenGenerator ", err.message)
            return {
                success: false
            }
        }
    }


    async generateAccessFromRefresh(randomString) {
        try {
            // sentInfo = decoded refresh token from client
            let randomStringHashed = cryptoHasher(randomString);

            let res = await tokenModelHandler.findRefreshToken({ randomStringHashed }); // also invalidates ref

            if (!res.success) {
                return {
                    success: false
                    // means the string has been tampered or the refresh token has been invalidated by the user
                }
            }

            let { userId , role } = res.data;

            // bc this things are implicitly called and they are methods of the obj calling generateAccessFromRefresh
            let accessToken = this.accessTokenGenerator({ userId , role });
            let ref = await this.refreshTokenGenerator({ userId , role })
            // bc the old one is invalidated as soon as it is used, we need to generate a new refresh token and send it to the client

            if (!ref.success) {
                return {
                    success: false
                }
            }

            return {
                success: true,
                data: {
                    accessToken: accessToken.accessToken,
                    refreshToken: ref.refreshToken
                }
            }

        } catch (err) {
            console.log("Error while generateAccessFromRefresh ", err.message)
            return {
                success: false
            }
        }

    }

    async invalidateRefreshToken(sentInfo) {
        try {
            let { randomString } = sentInfo;
            let randomStringHashed = cryptoHasher(randomString);

            let res = await tokenModelHandler.invalidateRefreshToken({ randomStringHashed });

            if (!res.success) {
                return {
                    success: false
                }
            }

            return {
                success: true
            }
        } catch (err) {
            console.log("Error while invalidateRefreshToken ", err.message);
            return {
                success: false
            }
        }
    }
}



module.exports = TokenGenerationServiceHandler;






