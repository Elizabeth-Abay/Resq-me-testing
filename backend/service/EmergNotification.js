const EmergencyNotificationModel = require('../model/pgConnectionListener');
const { contactServiceProviders, notificationEmailConstructor } = require('./emailSendingService');
const EmergencyContactSetterModel = require('../model/emergencyContactModel');
const { EmergencyDealerModel, EmergencyReportMaker } = require('../model/emergencyReport');
const EventEmitter = require('events'); // bc it needs to send email notification to emergency contacts
// this will be triggered once the pg emits notifications for the request


const emergencyNotificationModelHandler = new EmergencyNotificationModel();
const emergencyContactSetterModelHandler = new EmergencyContactSetterModel();
const emergencyDealerHandler = new EmergencyDealerModel();

class EmergencyNotificationService extends EventEmitter {
    constructor() {
        super()
    };

    async processEmergencyRequest(emergencyData) {
        try {
            // used to select the service providers nearby
            // and also send emails automatically to the service providers
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

            if (successful === 0) {
                return {
                    success: false
                }
            }

            // but if even one provider is communicated properly
            return {
                success: true
            }


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
            let emailSending = await contactServiceProviders({ email, payload });


            if (!emailSending.success) {
                return {
                    success: false
                }
            }


            return {
                success: true
            };

        } catch (error) {
            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
        }
    }


    async contactEmergencyContacts({ userId, serviceProviderId }) {
        try {
            // this will be done once the report has been accepted
            // when the providers click the link then it will include the report id
            // them clicking - check if accepted if not and accept if it is
            // when they accept then contact them 
            // do a get request- inside there will be the id of the request


            let result = await emergencyDealerHandler.emergencyContactAndEmailedInfo(requestId);


            if (!result.success) {
                return {
                    success: false
                }
            }

            if (result.success && result.data.length === 0) {
                return {
                    // bc it is not the query that failed but the user didn't provide emergency contacts
                    success: true
                }
            }


            let { fullname, city, sub_city, identifying_landmark, emails } = result.data;

            




        } catch (err) {
            // Log failed contact attempt
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'failed', error.message);

            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
        }
    }




}

module.exports = EmergencyNotificationService;
