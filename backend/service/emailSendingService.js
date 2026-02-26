const sendRenderedEmail = require('../utils/sendRenderedEmail');
//  to, subject, templateName , payload this is input req for sendRenderedEmail



async function emailSendingService(sentInfo) {
    try {
        const { email, emailString, userId } = sentInfo;
        let emailLink = `https://resq-app-741m.onrender.com/auth/verify-email?userId=${userId}&tokenString=${emailString}`;


        console.log("Sent email link bla bla bla", emailLink);
        // { to, subject, html }

        let info = await sendRenderedEmail({
            to: email ,
            subject: "Verify your email",
            templateName: 'authEmail',
            payload: {
                emailLink
            },
            emailCase : "Authentication"
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
        if (emails.length === 0) {
            return {
                success: false,
                reason: "The emails are empty for notificationEmailConstructor"
            }
        }
        let subject = "Notifying Accident";
        let payload = { fullname, city, sub_city, identifying_landmark }

        let emailArray = emails.map(obj => obj.email);

        let emailSending = await sendRenderedEmail({
            templateName: 'notifyEmergContacts',
            to: emailArray,
            // emails = [  email ]
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
        let { location, healthState, allergies, distanceKm, emergency_id, providerId } = payload;


        let allergyArray = [];

        if (allergies && typeof allergies === 'object') {
            // If it's already an array, just use it
            if (Array.isArray(allergies)) {
                allergyArray = allergies;
            } else {
                // If it's an object {"pollen": "high"}, turn it into ["pollen (high)"]
                allergyArray = Object.entries(allergies).map(([key, value]) => {
                    return `${key} (${value})`;
                });
            }
        }




        let healthSummaryArray = [];

        if (healthState && typeof healthState === 'object' && !Array.isArray(healthState)) {
            // Transform {"pulse": "80"} into ["Pulse: 80"]
            healthSummaryArray = Object.entries(healthState).map(([key, value]) => {
                // Clean up the key (e.g., 'blood_pressure' -> 'Blood Pressure')
                const cleanKey = key.replace(/_/g, ' ')
                    .replace(/\b\w/g, char => char.toUpperCase());
                return `${cleanKey}: ${value}`;
            });
        } else if (Array.isArray(healthState)) {
            healthSummaryArray = healthState;
        }


        // create acceptance link
        let acceptanceLink = `http://localhost:3000/reports/accept-request?report_id=${emergency_id}&provider_id=${providerId}`;
        console.log("Acceptance link: ", acceptanceLink);

        // Simple HTML email without templates


        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                let emailSending = await sendRenderedEmail({
                    to: email,
                    subject: "🚨 Emergency Alert - Patient Needs Help",
                    templateName: "notifyProvider", // Send HTML directly
                    payload: { location, healthState : healthSummaryArray, allergies: allergyArray, distanceKm, acceptanceLink }
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