const ejs = require('ejs');
const path = require('path');
const sendEmail = require('./emailSender');


async function sendRenderedEmail(sentInfo) {
    try {
        let { to, subject, templateName , payload} = sentInfo;

        // to, subject, htmlContent - expected by sendEmail
        // construct the path
        let templatePath = path.join(__dirname, `../views/${templateName}.ejs`);
        console.log("Template path " , templatePath)

        let htmlContent = await ejs.renderFile(templatePath, payload);
        // console.log("html Content " , htmlContent)

        let sentEmail = await sendEmail({
            to,
            subject,
            htmlContent
        })

        console.log("Sent Email " , sentEmail);

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
