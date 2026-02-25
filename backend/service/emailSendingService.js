const sendRenderedEmail = require('../utils/sendRenderedEmail');
//  to, subject, templateName , payload this is input req for sendRenderedEmail


async function emailSendingService(sentInfo) {
    try {
        const { email, emailString, userId } = sentInfo;
        let emailLink = `https://resq-app-741m.onrender.com/auth/verify-email?userId=${userId}&tokenString=${emailString}`;


        console.log("Sent email link bla bla bla", emailLink);
        // { to, subject, html }

        let info = await sendRenderedEmail({
            to: { email },
            subject: "Verify your email",
            templateName: 'authEmail',
            payload: {
                emailLink
            }
        });

        console.log(info)

        if (!info.success) {
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



async function notificationEmailConstructor({ emails, fullname, city, sub_city, identifying_landmark }) {
    try {
        if (emails.length === 0){
            return {
                success : false,
                reason : "The emails are empty for notificationEmailConstructor"
            }
        }
        let subject = "Notifying Accident";
        let payload = { fullname, city, sub_city, identifying_landmark }

        let emailSending = await sendRenderedEmail({
            templateName: 'notifyEmergContacts',
            to: emails,
            // emails = [ { email }]
            subject,
            payload
        })

        if (!emailSending.success) {
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
        let { location, healthState, allergies, distanceKm ,  emergency_id , providerId} = payload;

        // create acceptance link
        let acceptanceLink = `http://localhost:3000/report/accept?report_id=${emergency_id}&provider_id=${providerId}`;
        
        // Simple HTML email without templates
        let html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e74c3c;">🚨 Emergency Alert</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>Patient Information:</h3>
                    <p><strong>Location:</strong> ${location}</p>
                    <p><strong>Health State:</strong> ${healthState}</p>
                    <p><strong>Allergies:</strong> ${allergies}</p>
                    <p><strong>Distance:</strong> ${distanceKm} km away</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptanceLink}" 
                       style="background-color: #28a745; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Emergency Request
                    </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    This is an automated emergency notification from ResQMission.
                </p>
            </div>
        `

        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                // Send email directly without template
                let emailSending = await sendRenderedEmail({
                    to: email,
                    subject: "🚨 Emergency Alert - Patient Needs Help",
                    htmlContent: html // Send HTML directly
                });

                if (emailSending && emailSending.success) {
                    console.log(`Email sent successfully to ${email} on attempt ${attempts + 1}`);
                    return { success: true };
                } else {
                    throw new Error("Email service returned failure");
                }
            } catch (error) {
                attempts++;
                console.log(`Email attempt ${attempts} failed for ${email}:`, error.message);
                
                if (attempts >= maxAttempts) {
                    console.log(`Failed to send to ${email} after ${maxAttempts} attempts`);
                    return { success: false, reason: "Email delivery failed after retries" };
                }
                
                // Wait before retry: 1s, 2s, 3s
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }

        return { success: false, reason: "Email delivery failed" };

    } catch (err) {
        console.log("Error while contactServiceProviders ", err.message);
        return {
            success: false,
            reason: "Error while contactServiceProviders "
        }
    }

}

module.exports = { emailSendingService, notificationEmailConstructor, contactServiceProviders };