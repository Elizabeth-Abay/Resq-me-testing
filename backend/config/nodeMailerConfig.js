const nodeMailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config(
    { path: path.join(__dirname, '../../.env') }
)


let { EMAIL, EMAIL_PASSWORD } = process.env;

let emailTransporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com', // means the emails i send live here 
    port: 465, // use this port to send out the emails
    secure: true,
    auth: {
        user: EMAIL,
        pass: EMAIL_PASSWORD // is the password for the app to be able to send 
        // emails through the provided email not ur actual email password
    },
    tls: { rejectUnauthorized: false } // bypass certificate validation  for development only reverse this once through dev't
})


module.exports = emailTransporter;