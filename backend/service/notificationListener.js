const { ServiceProviderRelated } = require('../model/ProcessModel');
const { contactServiceProviders } = require('./emailSendingService');
const getAddressFromCoords = require('../utils/addressDecoder')

let serviceProviderHandler = new ServiceProviderRelated();


// this will listen to the event emitted by the database
class EmergencyNotificationService {
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
            let nearbyProviders = await serviceProviderHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });

            if (nearbyProviders.success && nearbyProviders.data.length === 0) {
                // try by increasing the radius
                searchRadiusKm = 15;
                nearbyProviders = await serviceProviderHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });
            }

            console.log(`Found ${nearbyProviders.length} nearby providers`);


            console.log("Location from the decoded latitude and longitude ", location);

            if (!location.success) {
                return {
                    success: false,
                    reason: "Couldn't reverse decode the latitude and longitude"
                }
            }


            // decoding the location information in here 

            // Contact each provider
            const contactPromises = nearbyProviders.data.map(provider =>
                this.contactProvider(provider, emergencyData)
                // { location, healthState, allergies, distanceKm, emergency_id, providerId }
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

}


module.exports = EmergencyNotificationService;