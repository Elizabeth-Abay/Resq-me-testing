const ProfileSetModel = require('../model/profileSetter');
const uploadFilesToCloud = require('../utils/cloudinaryStreamHelper');

const profileModelHandler = new ProfileSetModel();

class ProfileSetterService {
    async userProfile(sentInfo) {
        try {
            let { userId, gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoName, frontBuffer, backBuffer } = sentInfo;

            let frontUrl = await uploadFilesToCloud({ buffer: frontBuffer, folder: "ResqMissionIds" });
            let backUrl = await uploadFilesToCloud({ buffer: backBuffer, folder: "ResqMissionIds" });

            let idPicPath = JSON.stringify({
                frontUrl,
                backUrl
            })


            let res = await profileModelHandler.HMOSelecter(HmoName);



            if (!res.success) {
                return {
                    success: false,
                    reason: "HMO doesn't exist"
                }
            }

            let { HmoId } = res;

            allergies = JSON.stringify(allergies);
            healthState = JSON.stringify(healthState);
            // the image url will be converted here



            let finalUpload = await profileModelHandler.profileSetUp(
                { userId, gender, allergies, healthState , HmoEnrollId, HmoCoveragePlan, CompanyName, HmoId, idPicPath }
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


    async serviceProfile(sentInfo) {
        try {
            let { licensePicture, location, licenseExp, city, identifyingLandmark, subCity, individual , userId} = sentInfo
            // is_individual_service_provider 

            console.log({ licensePicture, location, licenseExp, city, identifyingLandmark, subCity, individual , userId});

            let licenseUrl = await uploadFilesToCloud({ buffer: licensePicture, folder: 'Licencses' });

            // console.log({ licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual , userId })
            location = JSON.parse(location)
            let result = await profileModelHandler.providersProfileSetUp(
                { licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual , userId }
            )

            if (result.success){
                return {
                    success : true
                }
            }

            return {
                success : false,
                reason : "Database problem"
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


module.exports = ProfileSetterService;