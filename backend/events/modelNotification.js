const EmergencyNotificationHandlerObj = require('../model/notifListener');
const EmergencyNotificationService = require('../service/notificationListener');

const emergencyNotificationHandler = new EmergencyNotificationService();

async function HandleEvent(payload) {
    try {
        // 'emergency_id','allergies', 'health_state','latitude','longitude'
        let result = await emergencyNotificationHandler.processEmergencyRequest(payload);

        if (!result.success) {
            return {
                success: false,
                reason: "Error while emergencyNotificationHandler.processEmergencyRequest(payload)"
            }
        }

        return {
            success: true
        }

    } catch (Err) {
        console.log("Error while HandleEvent ", Err.message);
        return {
            success: false,
            reason: "Error while HandleEvent "
        }
    }
}


EmergencyNotificationHandlerObj.on('emergency_request_made', (payload) => {
    // We call the async function but attach a .catch to the promise 
    // to ensure no background crashes happen.
    HandleEvent(payload).catch(err => {
        console.error("CRITICAL SYSTEM ERROR: Emergency event failed to execute", err);
    });
});