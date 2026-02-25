const ejs = require('ejs');
const path = require('path');
const sendEmail = require('./emailSender');


async function sendRenderedEmail(sentInfo) {
    try {
        let { to, subject, templateName , payload} = sentInfo;

        // to, subject, htmlContent - expected by sendEmail
        // construct the path
        let templatePath = path.join(__dirname, `../views/${templateName}.ejs`);

        let htmlContent = await ejs.renderFile(templatePath, payload);

        let sentEmail = await sendEmail({
            to,
            subject,
            htmlContent
        })

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
