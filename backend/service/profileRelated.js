const uploadFilesToCloud = require('../utils/cloudinaryStreamHelper');
const { EmergencyContactRelated } = require('../model/ProcessModel');

let emergencyContactHandler = new EmergencyContactRelated();

class EmergencyContactPpSetUpAndUpdate {
    // create
    async setUpEmergencyContacts(sentInfo) {
        try {
            console.log("Reached the service layer")
            let {
                userId,
                firstEmergName, firstEmergEmail, firstEmergRelation,
                secondEmergName, secondEmergEmail, secondEmergRelation,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation,
                firstContactPic,
                secondContactPic,
                thirdContactPic,
                fourthContactPic,
                fifthContactPic
            } = sentInfo;




            // first upload to cloud
            let firstUserUrl = (firstContactPic != undefined) ? await uploadFilesToCloud({ buffer: firstContactPic, folder: 'Emergency_Contacts' }) : null;
            console.log("Done with the first picture");
            let secondUserUrl = (secondContactPic != undefined) ? await uploadFilesToCloud({ buffer: secondContactPic, folder: 'Emergency_Contacts' }) : null;
            console.log("Done with the second picture");
            let thirdUserUrl = (thirdContactPic != undefined) ? await uploadFilesToCloud({ buffer: thirdContactPic, folder: 'Emergency_Contacts' }) : null;
            console.log("Done with the third picture");
            let fourthUserUrl = (fourthContactPic != undefined) ? await uploadFilesToCloud({ buffer: fourthContactPic, folder: 'Emergency_Contacts' }) : null;
            console.log("Done with the fourth picture");
            let fifthUserUrl = (fifthContactPic != undefined) ? await uploadFilesToCloud({ buffer: fifthContactPic, folder: 'Emergency_Contacts' }) : null;
            console.log("Done with the fifth picture");


            // also change from string to array
            firstEmergRelation = JSON.parse(firstEmergRelation);
            secondEmergRelation = JSON.parse(secondEmergRelation);
            thirdEmergRelation = JSON.parse(thirdEmergRelation);
            fourthEmergRelation = JSON.parse(fourthEmergRelation);
            fifthEmergRelation = JSON.parse(fifthEmergRelation);



            let result = await emergencyContactHandler.setEmergencyContacts({
                userId,
                firstEmergName, firstEmergEmail, firstEmergRelation,
                secondEmergName, secondEmergEmail, secondEmergRelation,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation,
                firstUserUrl,
                secondUserUrl,
                thirdUserUrl,
                fourthUserUrl,
                fifthUserUrl
            })

            console.log("Result given from db to service ", result)
            if (result.success) {
                return {
                    success: true
                }
            }

            return {
                success: false,
                reason: "Data base Insertion problem"
            }

        } catch (Err) {
            console.log("Error while EmergencyContactSetter.emergencyContacts  ", Err.message);
            return {
                success: false,
                reason: "Error while EmergencyContactSetter.emergencyContacts"
            }
        }
    }

    // update
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


    // read
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
}


class UserPpSetUpAndUpdate {
    // create
    async userProfile(sentInfo) {
        try {
            let {
                userId, gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoName, profile
                // , frontBuffer, backBuffer
            } = sentInfo;

            // frontUrl - for now will be the profile of the user
            let profileUrl = await uploadFilesToCloud({ buffer: profile, folder: "User-Profile-storage" })
            // let frontUrl = await uploadFilesToCloud({ buffer: frontBuffer, folder: "ResqMissionIds" });
            // let backUrl = await uploadFilesToCloud({ buffer: backBuffer, folder: "ResqMissionIds" });

            // let idPicPath = JSON.stringify({
            //     frontUrl,
            //     backUrl
            // })


            let HmoId;
            if (!HmoName) {
                let res = await profileModelHandler.HMOSelecter(HmoName);
                if (!res.success) {
                    return {
                        success: false,
                        reason: "HMO doesn't exist"
                    }
                }

                HmoId = res.HmoId;
            }



            allergies = JSON.stringify(allergies);
            healthState = JSON.stringify(healthState);
            // the image url will be converted here



            let finalUpload = await profileModelHandler.profileSetUp(
                { userId, gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoId, profileUrl }
            )

            if (!finalUpload.success) {
                return {
                    success: false
                }
            }

            return {
                success: true
            }


        } catch (err) {
            console.log("Error while  ProfileSetterService.userProfile ", err.message);
            return {
                success: false,
                reason: "Error while  ProfileSetterService.userProfile"
            }
        }
    }

    // read
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


    // update
    async updateMyProfile({ userId, updatedProfile }) {
        try {
            let res = await fetchAndUpdateHandler.updateMyProfile({ userId, updatedProfile });
            // fullname,birthDate,gender,allergies,health_state,Hmo_enroll_id - info in updatedProfile

            if (res.success) {
                return {
                    success: true,
                    data: res.data
                }
            }

            return {
                success: false,
                reason: "Failure to update the profile"
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


class ServiceProviderPpSetUp {
    async serviceProfile(sentInfo) {
        try {
            let { licensePicture, location, licenseExp, city, identifyingLandmark, subCity, individual, userId } = sentInfo
            // is_individual_service_provider 

            console.log({ licensePicture, location, licenseExp, city, identifyingLandmark, subCity, individual, userId });

            let licenseUrl = await uploadFilesToCloud({ buffer: licensePicture, folder: 'Licencses' });

            // console.log({ licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual , userId })
            location = JSON.parse(location)
            let result = await profileModelHandler.providersProfileSetUp(
                { licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual, userId }
            )

            if (result.success) {
                return {
                    success: true
                }
            }

            return {
                success: false,
                reason: "Database problem"
            }

        } catch (err) {
            console.log("Error while  ProfileSetterService.serviceProfile ", err.message);
            return {
                success: false,
                reason: "Error while  ProfileSetterService.serviceProfile"
            }
        }
    }
}

module.exports = { EmergencyContactPpSetUpAndUpdate, UserPpSetUpAndUpdate, ServiceProviderPpSetUp };

