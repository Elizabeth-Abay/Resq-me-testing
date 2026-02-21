const { Resend } = require('resend');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

let { RESEND_API_KEY } = process.env;


const resend = new Resend(RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
    try {
        const response = await resend.emails.send({
            from: "ResQMe <onboarding@resend.dev>",
            to,
            subject,
            html,
        });

        return response;
    } catch (error) {
        console.error("Email sending failed:", error);
        throw error;
    }
}

module.exports = sendEmail;