const twilio = require('twilio');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
})


let { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;


let client = twilio(
    TWILIO_ACCOUNT_SID, 
    TWILIO_AUTH_TOKEN
)

module.exports = client;