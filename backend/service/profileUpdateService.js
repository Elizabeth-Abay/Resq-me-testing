const FetchAndUpdatePpModel = require('../model/profileUpdateModel.js');
const fetchAndUpdateHandler = new FetchAndUpdatePpModel();


class FetchAndUpdatePpService {
    async updateEmergencyContact({ id, name, email, relationship }) {
        try {
            let res = await fetchAndUpdateHandler.updateEmergencyContact({ id, name, email, relationship });

            if (!res.success) {
                return {
                    success: false,
                    reason: "Error while calling  fetchAndUpdateHandler.updateEmergencyContact from service "
                }
            }

            return {
                success: true,
                data: res.data
            }


        } catch (Err) {
            console.log("Error while FetchAndUpdatePpService.updateEmergencyContact ", Err.message);
            return {
                success: false,
                reason: "Error while FetchAndUpdatePpService.updateEmergencyContact "
            }
        }
    }


    async fetchEmergencyProfiles(userId) {
        try {
            let result = await fetchAndUpdateHandler.getEmergencyContacts(userId);
            // id , name, email, relationship, imageUrl

            if (result.success) {
                return {
                    success: true,
                    data: result.data
                }
            }

            return {
                success: false,
                reason: "Error while fetching contacts"
            }

        } catch (Err) {
            console.log("Error while FetchAndUpdatePpService.fetchEmergencyProfiles ", Err.message);
            return {
                success: false,
                reason: "Error while FetchAndUpdatePpService.fetchEmergencyProfiles "
            }
        }
    }


    async fetchMyProfile(userId) {
        try {
            let res = await fetchAndUpdateHandler.getMyProfile(userId);

            if (!res.success) {
                return {
                    success: false,
                    reason: "Error while finding profile"
                }
            }

            return {
                success: true,
                data: res.data
            }
        } catch (Err) {
            console.log("Error while FetchAndUpdatePpService.fetchEmergencyProfiles ", Err.message);
            return {
                success: false,
                reason: "Error while FetchAndUpdatePpService.fetchEmergencyProfiles "
            }
        }
    }


    async updateMyProfile({ userId , updatedProfile}) {
        try {
            let res = await fetchAndUpdateHandler.updateMyProfile({ userId , updatedProfile});
            // fullname,birthDate,gender,allergies,health_state,Hmo_enroll_id - info in updatedProfile

            if (res.success){
                return {
                    success : true,
                    data : res.data
                }
            }

            return {
                success : false,
                reason : "Failure to update the profile"
            }

        } catch (Err) {
            console.log("Error while FetchAndUpdatePpService.updateMyProfile ", Err.message);
            return {
                success: false,
                reason: "Error while FetchAndUpdatePpService.updateMyProfile "
            }
        }
    }
}


module.exports = FetchAndUpdatePpService;