const EmergencyNotificationHandlerObj = require('../../backend/model/notifListener');
const { contactServiceProviders, notificationEmailConstructor } = require('./emailSendingService');
const EmergencyContactSetterModel = require('../model/emergencyContactModel');
const { EmergencyDealerModel, EmergencyReportMaker } = require('../model/emergencyReport');
const EventEmitter = require('events'); // bc it needs to send email notification to emergency contacts
// this will be triggered once the pg emits notifications for the request
const getAddressFromCoords = require('../utils/addressDecoder')


const emergencyContactSetterModelHandler = new EmergencyContactSetterModel();
const emergencyDealerHandler = new EmergencyDealerModel();

class EmergencyNotificationService extends EventEmitter {
    constructor() {
        super();
        // this.on()
    };

    async processEmergencyRequest(emergencyData) {
        try {
            // used to select the service providers nearby
            // and also send emails automatically to the service providers
            // emergencyData - the payload from the pg notification
            // this will be called to process the notification emitted by postgresql
            let { latitude, longitude, allergies, health_state, emergency_id } = emergencyData;

            console.log(`Processing emergency request ${emergencyData.emergency_id}`);

            let searchRadiusKm = 5;
            // first find nearby 5 km providers
            // Find nearby service providers
            let nearbyProviders = await EmergencyNotificationHandlerObj.findNearbyProviders({ latitude, longitude, searchRadiusKm });

            if (nearbyProviders.success && nearbyProviders.data.length === 0) {
                // try by increasing the radius
                searchRadiusKm = 15;
                nearbyProviders = await EmergencyNotificationHandlerObj.findNearbyProviders({ latitude, longitude, searchRadiusKm });
            }

            console.log(`Found ${nearbyProviders.length} nearby providers`);


            // decoding the location information in here 

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
            let { latitude, longitude, allergies, health_state, emergency_id } = emergencyData;
            let { email, distanceKm, userId } = provider;
            let providerId = userId;

            // call the decoder here 
            let locationDecoded = await getAddressFromCoords(latitude, longitude);

            // decode the location for the service providers here

            const payload = {
                emergency_id,
                providerId,
                location: locationDecoded,
                //  "Textual description of the lat and long explained",
                healthState: health_state,
                allergies: allergies,
                distanceKm,
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


    // when the users click the link i sent to the email then accepted means like we need to contact the emergency contacts
    async contactEmergencyContacts(requestId) {
        try {
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


            // 1. Create an array of Promises (one for each email)
            const emailPromises = emails.map(email =>
                notificationEmailConstructor({
                    email,
                    fullname,
                    city,
                    sub_city,
                    identifying_landmark
                })
            );

            let emailSending = await Promise.allSettled(emailPromises);

            let successfulEmergencyNotification = 0;

            emailSending.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to send to ${emails[index]}:`, result.reason);
                } else {
                    successfulEmergencyNotification++;
                    console.log(`Successfully sent to ${emails[index]}`);
                }
            });

            if (successfulEmergencyNotification === 0){
                return {
                    success : false,
                    reason : "Email not being sent out"
                }
            }

            return {
                success : true
            }

        } catch (err) {
            // Log failed contact attempt
            await this.logProviderContact(provider.id, emergencyData.emergency_id, 'failed', error.message);

            console.error(`Failed to contact provider ${provider.id}:`, error.message);
            throw error;
        }
    }




}

module.exports = EmergencyNotificationService;
