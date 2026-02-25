const client = require('../config/twilioConfig');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { TWILIO_PHONE_NUMBER } = process.env;

async function smsMessageSending(sentInfo) {
    try {
        const { phone, otp } = sentInfo;
        console.log("Sending SMS to ", phone, " with OTP ", otp);

        let message = await client.messages.create({
            body: `Your OTP for ResQMissionAfrica is ${otp}`,
            from: TWILIO_PHONE_NUMBER,
            to: phone
        });

        console.log("Twilio response ", message);

        if (message.sid) {
            console.log("SMS sent successfully to ", phone);
            return {
                success: true
            }
        }

        return {
            success: false
        }
    } catch (err) {
        console.log("Error in smsMessageSending ", err.message);
        return {
            success: false
        }
    }
    
}


module.exports = smsMessageSending;