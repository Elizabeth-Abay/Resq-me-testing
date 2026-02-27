const resend = require('../config/resendAIConfig');

async function sendToManyUsers({to, subject , html}) {
    // 1. Map your array of emails into the format Resend expects
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
            return;
        }
        console.log("Batch emails sent successfully!", data);
    } catch (err) {
        console.error("Batch process failed", err);
    }
}



module.exports = sendToManyUsers;