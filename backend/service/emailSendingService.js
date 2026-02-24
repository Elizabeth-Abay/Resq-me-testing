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
        to: email,
        subject,
        html
    })

    if (!emailSending) {
        return {
            success: false
        }
    }

    return {
        success: true
    }
}



async function contactServiceProviders(sentInfo) {
    try {
        let { email, payload } = sentInfo;

        let { location, healthState, allergies, urgencyLevel, distanceKm } = payload;

        // create acceptance link
        let acceptanceLink = ``;
        // have a link in there to accept the notification   
        let html = `
            <h2> A patient is located at ${location} and their health state is
            ${healthState}.</h2>
            <h2>The patient have got this allergies ${allergies}.
            It is predicted their level is ${urgencyLevel}. 
            The patient is located at ${distanceKm} away from your head location.
            To accept the patient's admittance 
            <a href = ${acceptanceLink}> click this link</a> .</h2>
        `

        let emailSending = await sendEmail({
            to: email,
            subject: "Emergency Report",
            html
        })

        if (!emailSending) {
            return {
                success: false
            }
        }

        return {
            success: true
        }

    } catch (err) {
        console.log("Error while contactServiceProviders ", err.message);
        return {
            success: false,
            reason: "Error while contactServiceProviders "
        }
    }

}

module.exports = { emailSendingService, notificationEmailConstructor , contactServiceProviders };