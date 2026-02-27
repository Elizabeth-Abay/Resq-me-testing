const EmergencyNotificationService = require('../service/notificationListener');

const emergencyNotificationHandler = new EmergencyNotificationService();


console.log(' [EVENT] Event listener setup complete');

async function HandleEvent(payload) {
    try {
        console.log(' [EVENT] Processing emergency event:', payload);
        
        // 'emergency_id','allergies', 'health_state','latitude','longitude'
        let result = await emergencyNotificationHandler.processEmergencyRequest(payload);

        if (!result.success) {
            console.error(' [EVENT] Failed to process emergency event:', result.reason);
            return {
                success: false,
                reason: "Error while emergencyNotificationHandler.processEmergencyRequest(payload): " + (result.reason || "Unknown error")
            }
        }

        console.log(' [EVENT] Emergency event processed successfully:', result.message);
        return {
            success: true,
            message: result.message
        }

    } catch (Err) {
        console.error(' [EVENT] Critical error in HandleEvent:', Err.message);
        console.error(' [EVENT] Stack trace:', Err.stack);
        return {
            success: false,
            reason: "Error while HandleEvent: " + Err.message
        }
    }
}


module.exports = HandleEvent;


