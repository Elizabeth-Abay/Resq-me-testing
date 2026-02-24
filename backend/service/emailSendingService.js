const sendEmail = require('../utils/emailSender');



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



async function notificationEmailConstructor({ email, fullname, city, sub_city, identifying_landmark }) {
    try {
        let html = `
        <div style="font-family: Arial, sans-serif; border: 2px solid #e74c3c; padding: 20px; border-radius: 10px;">
            <h2 style="color: #e74c3c; margin-top: 0;">🚨 Emergency Status Update</h2>
            
            <p>This is an automated alert from <strong>ResQMission</strong>.</p>
            
            <p>We are notifying you that <strong>${fullname}</strong> was involved in an emergency situation. Professional medical help has arrived and is currently assisting them.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
                <p style="margin: 0;"><strong>Medical Facility/Location:</strong></p>
                <p style="margin: 5px 0;">${city}, ${sub_city}</p>
                <p style="margin: 5px 0;"><em>Note: Near ${identifying_landmark}</em></p>
                <br>
            </div>

            <p style="font-size: 0.9em; color: #555;">
                <strong>Next Steps:</strong> You may attempt to contact ${fullname}'s primary phone or proceed to the location mentioned above. Please stay calm and keep this line open for further updates.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 0.8em; color: #888;">Sent via ResQMission Emergency Response System.</p>
        </div>
        `;

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

    } catch (err) {
        console.log("Error in notificationEmailConstructor ", err.message);
        return {
            success: false
        }
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

module.exports = { emailSendingService, notificationEmailConstructor, contactServiceProviders };