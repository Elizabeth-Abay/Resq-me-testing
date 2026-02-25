const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.join(__dirname, '../../.env')
});

let { EMAIL_SENDING_URL, EMAIL, EMAIL_SENDING_API_KEY } = process.env;


async function sendEmail({ to, subject, htmlContent }) {
    try {
        // to = [ { name , email}]
        const sender = { email: EMAIL, name: "ResQMe Notification" };

        let emailData = {
            sender,
            to,
            subject,
            htmlContent,
        };


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

        if (!response.ok) {
            return {
                success: false,
                reason: "Error while sending emails to receivers"
            }
        }

        return {
            success : true
        }

    

    } catch (error) {
        console.error("Email sending failed:", error);
        throw error;
    }
}


module.exports = sendEmail;