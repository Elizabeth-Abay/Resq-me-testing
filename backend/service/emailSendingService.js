const sendEmail = require('../utils/emailSender');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

let { EMAIL } = process.env;

async function emailSendingService(sentInfo) {
    try {
        const { email, emailString, userId } = sentInfo;
        let emailLink = `https://resq-app-741m.onrender.com/auth/verify-email?userId=${userId}&tokenString=${emailString}`;


        console.log("Sent email link", emailLink);
        // { to, subject, html }

        let info = await sendEmail({
            to: email,
            subject: "Verify your email",
            html: `<p>Click on the link to verify your email: <a href="${emailLink}">Verify Email</a></p>`
        });

        if (!info) {
            return {
                success: false
            }
        }


        console.log("Email sent successfully to ", email);
        return {
            success: true
        }

    } catch (err) {
        console.log("Error in emailSendingService ", err.message);
        return {
            success: false
        }
    }
}



async function notificationEmailConstructor({ email, userName, serviceProviderInfo }) {
    let html = `
        <h3>Hello</h3> 
        <h4><p> We want to notify you that ${userName} has been reported to an accident. Help is on the way and the patient will first be admitted to ${serviceProviderInfo}</p></h4
    `
    
    let subject = "Notifying Accident";

    let emailSending = await sendEmail({
        to : email,
        subject,
        html
    })

    if (!emailSending){
        return {
            success : false
        }
    }

    return {
        success : true
    }

    

}


module.exports = emailSendingService , notificationEmailConstructor;