const sendEmail = require('../utils/emailSender');
const dotenv = require('dotenv');   
const path = require('path');

dotenv.config({
    path : path.resolve(__dirname , '../../.env')
});

let { EMAIL } = process.env;

async function emailSendingService(sentInfo) {
    try {
        const { email, emailString , userId } = sentInfo;
        let emailLink = `http://localhost:3000/auth/verify-email?userId=${userId}&tokenString=${emailString}`;
        
        
        console.log("Sent email link" , emailLink);
        // { to, subject, html }

        let info = await sendEmail({
            to : email,
            subject: "Verify your email",
            html: `<p>Click on the link to verify your email: <a href="${emailLink}">Verify Email</a></p>`
        });

        if (info.accepted.length > 0) {
            console.log("Email sent successfully to ", email);
            return {
                success: true
            }
        } 
        return {
            success : false
        }

    } catch (err){
        console.log("Error in emailSendingService ", err.message);
        return {
            success: false
        }
    }
} 


module.exports = emailSendingService;