const { ServiceProviderRelated } = require('../model/ProcessModel');
const { contactServiceProviders } = require('./emailSendingService');
const getAddressFromCoords = require('../utils/addressDecoder')

let serviceProviderHandler = new ServiceProviderRelated();


// this will listen to the event emitted by the database
class EmergencyNotificationService {
    constructor() {
        // No super() needed - this is not extending EventEmitter
    };

    async processEmergencyRequest(emergencyData) {
        try {
            // used to select the service providers nearby
            // and also send emails automatically to the service providers
            // emergencyData - the payload from the pg notification
            // this will be called to process the notification emitted by postgresql
            let { latitude, longitude, allergies, health_state, emergency_id } = emergencyData;

            emergencyData.allergies = allergies ? JSON.parse(allergies) : {};
            emergencyData.health_state = health_state ? JSON.parse(health_state) : {};

            console.log(`Processing emergency request ${emergencyData}`);

            let searchRadiusKm = 5;
            // first find nearby 5 km providers
            // Find nearby service providers
            let nearbyProviders = await serviceProviderHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });

            if (nearbyProviders.success && nearbyProviders.data.length === 0) {
                // try by increasing the radius
                searchRadiusKm = 15;
                nearbyProviders = await serviceProviderHandler.findNearbyProviders({ latitude, longitude, searchRadiusKm });
                // { success: true, data: [ { userId , name ,phone,email,city , subCity , landmark , distanceKm} ] }
            }

            console.log(`Found ${nearbyProviders.data.length} nearby providers`);

            // decoding location information in here 
            let locationDecoded = await getAddressFromCoords(latitude, longitude);

            if (!locationDecoded.success) {
                console.log("Location decode failed, using coordinates directly");
                locationDecoded = { data: `Latitude: ${latitude}, Longitude: ${longitude}` };
            }

            console.log("Location from decoded latitude and longitude ", locationDecoded.data);

            // Contact each provider
            const contactPromises = nearbyProviders.data.map(provider =>
                this.contactProvider(provider, emergencyData, locationDecoded.data)
                // { location, healthState, allergies, distanceKm, emergency_id, providerId }
                // providerInfo = { userId , name ,phone,email,city , subCity , landmark , distanceKm}
            );

            let emailsAll = nearbyProviders.data.map(provider => provider.email);


            // results will be an array of each async tasks completion
            //  [ { status: "rejected"/"fulfilled", reason: "Connection Timeout" } ]
            const results = await Promise.allSettled(contactPromises);

            let successful = 0;
            // Log results
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successful++;
                    console.log(`Successfully contacted provider ${nearbyProviders.data[index].id}`);
                } else {
                    console.error(`Failed to contact provider ${nearbyProviders.data[index].id}:`, result.reason);
                }
            });

            if (successful === 0) {
                return {
                    success: false,
                    reason: "Failed to contact any providers"
                }
            }

            // but if even one provider is communicated properly
            return {
                success: true,
                message: `Successfully contacted ${successful} out of ${nearbyProviders.data.length} providers`
            }


        } catch (error) {
            console.error('Error processing emergency request:', error);
            return {
                success: false,
                reason: "Error processing emergency request"
            }
        }
    }



    async contactProvider(provider, emergencyData, location) {
        try {
            let { latitude, longitude, allergies, health_state, emergency_id } = emergencyData;
            let { email, distanceKm, userId } = provider;
            let providerId = userId;

            const payload = {
                emergency_id,
                providerId,
                location: location,
                //  "Textual description of lat and long explained",
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