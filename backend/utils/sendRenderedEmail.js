const ejs = require('ejs');
const path = require('path');
const sendSingleEmail = require('../utils/sendSingleEmail');
const sendToManyUsers = require('../utils/sendBatchEmails');
const e = require('express');


async function sendRenderedEmail(sentInfo) {
    try {
        let { to, subject, templateName, payload, emailCase, type } = sentInfo;
        console.log("sendRenderedEmail called with: ", sentInfo);

        // to, subject, html - expected by sendEmail
        // construct the path
        let templatePath = path.join(__dirname, `../views/${templateName}.ejs`);
        console.log("Template path ", templatePath)

        let html = await ejs.renderFile(templatePath, payload);
        // console.log("html Content " , htmlContent)

        let cleanedEmails = to;
        if (Array.isArray(to)) {
            cleanedEmails = to.map(email => {
                if (typeof email === 'string') {
                    // Remove quotes if present and clean whitespace
                    let cleanedEmail = email.replace(/^"|"$/g, '').trim();
                    console.log(`🔧 Cleaning email: "${email}" -> "${cleanedEmail}"`);
                    return cleanedEmail;
                }
                return email;
            });
        }


        console.log("Cleaned Emails: ", cleanedEmails);

        let sentEmail;
        // check if u are sending to multiple users or single user
        if (emailCase === "Emergency-Notification") {
            // then we get many users for notification email
            // array of emails
            sentEmail = await sendToManyUsers({
                to: cleanedEmails,
                subject,
                html
            })
        }

        else {
            sentEmail = await sendSingleEmail({
                to,
                subject,
                html
            })

        }


        console.log("Sent Email ", sentEmail);

        if (!sentEmail.success) {
            return {
                success: false
            }
        }

        return {
            success: true
        }

    } catch (err) {
        console.log("Error while sendRenderedEmail ", err.message);
        return {
            success: false,
            reason: "Error while sendRenderedEmail "
        }
    }
}


module.exports = sendRenderedEmail;
