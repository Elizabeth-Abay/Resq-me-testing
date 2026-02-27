const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.join(__dirname, '../../.env')
});

let { EMAIL_SENDING_URL, EMAIL, EMAIL_SENDING_API_KEY } = process.env;


async function sendEmail({ to, subject, htmlContent }) {
    try {
        // Check if required environment variables are set
        if (!EMAIL_SENDING_URL || !EMAIL || !EMAIL_SENDING_API_KEY) {
            console.error("Missing email configuration:");
            console.error("EMAIL_SENDING_URL:", EMAIL_SENDING_URL ? "SET" : "MISSING");
            console.error("EMAIL:", EMAIL ? "SET" : "MISSING");
            console.error("EMAIL_SENDING_API_KEY:", EMAIL_SENDING_API_KEY ? "SET" : "MISSING");
            return {
                success: false,
                reason: "Email service not configured properly"
            }
        }

        // to = [ { name , email}] or just string email
        const sender = { email: EMAIL, name: "ResQMe Notification" };

        let emailData = {
            sender,
            to,
            subject,
            htmlContent,
        };

        console.log("Sending email to:", to);
        console.log("Email service URL:", EMAIL_SENDING_URL);

        let response = await fetch(
            EMAIL_SENDING_URL,
            {
                method: 'POST',
                headers: {
                    'api-key': EMAIL_SENDING_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(emailData)
            }
        );

        console.log("Email service response status:", response.status);

        if (!response.ok) {
            let errorText = await response.text();
            console.error("Email service error response:", errorText);
            return {
                success: false,
                reason: `Email service returned status ${response.status}: ${errorText}`
            }
        }

        let responseData = await response.json();
        console.log("Email service response data:", responseData);

        return {
            success : true,
            data: responseData
        }

    } catch (error) {
        console.error("Email sending failed:", error);
        return {
            success: false,
            reason: "Email sending error: " + error.message
        }
    }
}


module.exports = sendEmail;