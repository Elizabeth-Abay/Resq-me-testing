const EmergencyNotificationModel = require('../model/pgConnectionListener');
const { contactServiceProviders } = require('./emailSendingService');
const EventEmitter = require('events'); // bc it needs to send email notification to emergency contacts
// const dotenv = require('dotenv');
// const path = require('path');

// dotenv.config({
//     path: path.resolve(__dirname, '../../.env')
// });

const emergencyNotificationModelHandler = new EmergencyNotificationModel();

class EmergencyNotificationService extends EventEmitter {
    constructor() {
        super()
    };

    async processEmergencyRequest(emergencyData) {
        try {
            // emergencyData - the payload from the pg notification
            // this will be called to process the notification emitted by postgresql
            let { latitude, longitude, allergies, health_state } = emergencyData;
            console.log(`Processing emergency request ${emergencyData.emergency_id}`);

            let searchRadiusKm = 5;
            // first find nearby 5 km providers
            // Find nearby service providers
            let nearbyProviders = await emergencyNotificationModelHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });

            if (nearbyProviders.success && nearbyProviders.data.length === 0) {
                // try by increasing the radius
                searchRadiusKm = 15;
                nearbyProviders = await emergencyNotificationModelHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });
            }

            console.log(`Found ${nearbyProviders.length} nearby providers`);

            // Contact each provider
            const contactPromises = nearbyProviders.data.map(provider =>
                this.contactProvider(provider, emergencyData)
                // providerInfo = { userId , name ,phone,email,city , subCity , landmark , distanceKm}
            );


            // results will be an array of each async tasks completion
            //  [ { status: "rejected"/"fulfilled", reason: "Connection Timeout" } ]
            const results = await Promise.allSettled(contactPromises);

            let successful = 0;
            // Log results
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successful++;
                    console.log(`Successfully contacted provider ${nearbyProviders[index].id}`);
                } else {
                    console.error(`Failed to contact provider ${nearbyProviders[index].id}:`, result.reason);
                }
            });

            if (successful === 0){
                return {
                    success : false
                }
            }

            // but if even one provider is communicated properly
            // send the email to the contact 


        } catch (error) {
            console.error('Error processing emergency request:', error);
            this.emit('error', error);
        }
    }



    async contactProvider(provider, emergencyData) {
        try {
            let { latitude, longitude, allergies, health_state } = emergencyData;
            let { email, distanceKm } = provider;

            // decode the location for the service providers here

            const payload = {
                location: "Textual description of the lat and long explained",
                healthState: health_state,
                allergies: allergies,
                urgencyLevel: urgency_level,
                distanceKm: distanceKm,
                timestamp: new Date().toISOString()
            };

            // send emails to providers
            let emailSending = await contactServiceProviders({email, payload});


            if (!emailSending.success){
                return {
                    success : false
                }
            }


            return {
                success : true
            };

        } catch (error) {
            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
        }
    }


    async contactEmergencyContacts(userId){
        try{
            // this will be done once the report has been accepted
            // when the providers click the link then it will include the report id
            // them clicking - check if accepted if not and accept if it is
            // when they accept then contact them 

            let result = await



        } catch (err){
             // Log failed contact attempt
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'failed', error.message);

            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
        }
    }




}

module.exports = EmergencyNotificationService;
