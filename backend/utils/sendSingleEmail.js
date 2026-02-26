const resend = require('../config/resendAIConfig');

async function sendSingleEmail({ to, subject, html }) {
    try {
        const emailData = {
            from: 'ResQMission <noreply@resqmission.com>',
            to,
            subject,
            html
        };

        const result = await resend.emails.send(emailData);
        return { success: true, result };
    } catch (error) {
        console.error("Error sending email:", error.message);
        return { success: false, error: error.message };
    }
}

module.exports = sendSingleEmail;