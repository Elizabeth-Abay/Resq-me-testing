const resend = require('../config/resendAIConfig');

async function sendToManyUsers({ to, subject, html }) {
    // 1. Map your array of emails into the format Resend expects
    console.log("sendToManyUsers called with: ", { to, subject, html });
    const batchData = to.map(email => ({
        from: 'ResQMission <alerts@resqmeapp.win>',
        to: email,
        subject,
        html,
    }));

    try {
        // 2. Send the entire list in ONE request
        const { data, error } = await resend.batch.send(batchData);

        if (error) {
            console.error("Batch error:", error);
            return {
                success: false,
                reason: "Error while sending batch emails: " + error.message
            };
        }
        console.log("Batch emails sent successfully!", data);
        return {
            success: true
        }
    } catch (err) {
        console.error("Batch process failed", err);
        return {
            success: false,
            reason: "Error while sending batch emails: " + error.message
        };
    }
}



module.exports = sendToManyUsers;