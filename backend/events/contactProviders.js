// it will listen to events from the model upon receiving the pg_notify
const EmergencyNotificationService = require('../service/EmergNotification');
const EmergencyNotificationHandlerObj = require('../model/pgConnectionListener');

let emergencyNotificationHandler = new EmergencyNotificationService();


EmergencyNotificationHandlerObj.on('emergency_request_made' ,sendInNotificationEmails )

async function sendInNotificationEmails(payload) {
    try {
        console.log("The event listener received this payload " , payload);
        // contact the service providers
        let contactServiceProviders = await emergencyNotificationHandler.processEmergencyRequest(payload);


        if (!contactServiceProviders.success){
            return {
                success : false,
                reason : "Error while contacting service providers"
            }
        }

        return {
            success : true
        }

    } catch (Err) {
        console.log("Error while sendInNotificationEmails ", Err.message);
        return {
            success: false,
            reason: "Error while sendInNotificationEmails "
        }
    }

}

module.exports = sendInNotificationEmails;