const { EmergencyContactPpSetUpAndUpdate, UserPpSetUpAndUpdate, ServiceProviderPpSetUp } = require('../service/profileRelated');

const fetchAndUpdateEmergencyHandler = new EmergencyContactPpSetUpAndUpdate();
const fetchAndUpdateUserHandler = new UserPpSetUpAndUpdate();



let emergencyContactSetterHandler = new EmergencyContactPpSetUpAndUpdate();

class ProfileController {
    // create emergency
    async emergencySetter(req, res) {
        try {
            let { userId } = req.decodedAccess;

            let firstContactPic;
            let secondContactPic;
            let thirdContactPic;
            let fourthContactPic;
            let fifthContactPic

            if (Object.keys(req.files).length !== 0) {
                firstContactPic = req.files['first-emergency']?.[0].buffer;
                secondContactPic = req.files['second-emergency']?.[0].buffer;
                thirdContactPic = req.files['third-emergency']?.[0].buffer;
                fourthContactPic = req.files['fourth-emergency']?.[0].buffer;
                fifthContactPic = req.files['fifth-emergency']?.[0].buffer;
            }


            let { firstEmergName, firstEmergEmail, firstEmergRelation,
                secondEmergName, secondEmergEmail, secondEmergRelation,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation
            } = req.body;


            let result = await fetchAndUpdateEmergencyHandler.setUpEmergencyContacts({
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
            });

            if (result.success) {
                return res.status(201).json({ message: "Successfully saved profile" });
            }

            res.status(400).json({ message: "Bad request" })
        } catch (Err) {
            console.log("Error while EmergecyContactSetter.emergencySetter ", Err.message);
            return res.status(500).json({ message: "Internal server error" })
        }
    }

    // fetch my own
    async fetchMyOwn(req, res) {
        try {
            const { userId } = req.decodedAccess;

            const result = await fetchAndUpdateUserHandler.fetchMyProfile(userId);

            if (result.success) {
                return res.status(200).json(result.data);
            }

            return res.status(400).json({ message: result.reason || "Profile not found" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.fetchMyOwn: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    // update my own
    async updateMyOwn(req, res) {
        try {
            const { userId } = req.decodedAccess;
            const updatedProfile = req.body; // Fullname, birthDate, allergies, etc.

            const result = await fetchAndUpdateUserHandler.updateMyProfile({ userId, updatedProfile });

            if (result.success) {
                return res.status(200).json({
                    message: "Profile updated successfully",
                    data: result.data
                });
            }

            return res.status(400).json({ message: result.reason || "Failed to update profile" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.updateMyOwn: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    // update emergency
    async updateMyEmergencyContact(req, res) {
        try {
            const { id, name, email, relationship } = req.body;

            // Basic validation check before hitting service
            if (!id) return res.status(400).json({ message: "Contact ID is required" });

            const result = await fetchAndUpdateEmergencyHandler.updateEmergencyContact({ id, name, email, relationship });

            if (result.success) {
                return res.status(200).json({
                    message: "Emergency contact updated",
                    data: result.data
                });
            }

            return res.status(400).json({ message: result.reason || "Bad Request" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.updateMyEmergencyContact: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    // fetch emergency
    async fetchMyEmergencyContacts(req, res) {
        try {
            const { userId } = req.decodedAccess;

            const result = await fetchAndUpdateEmergencyHandler.fetchEmergencyProfiles(userId);

            if (result.success) {
                return res.status(200).json(result.data);
            }

            return res.status(400).json({ message: result.reason || "No contacts found" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.fetchMyEmergencyContacts: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }


    // create my own
    async userProfile(req, res) {
        try {
            let { userId } = req.decodedAccess;
            let profile = req.files.profilePic[0].buffer;
            // let frontBuffer = req.files.front[0].buffer;
            // let backBuffer = req.files.back[0].buffer;

            let { gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoName } = req.body;


            let result = await profileSetterServiceHandler.userProfile({
                userId,
                gender,
                allergies,
                healthState,
                // includes bloodType , 
                // diabetes ,
                HmoEnrollId,
                HmoCoveragePlan,
                CompanyName,
                HmoName,
                profile
                // frontBuffer,
                // backBuffer
            });

            if (result.success) {
                return res.status(201).json({ message: "Successfuly created profile" });
            }

            return res.status(400).json({ message: 'Bad Request' })

        } catch (error) {
            console.log("Error while ProfileCreateController.userProfile ", error.message);
            return res.status(500).json({ message: 'Internal Server error' });
        }
    }


    // create service provider
    async serviceProfile(req, res) {
        try {
            let { userId } = req.decodedAccess;


            let licensePicture = req.file.buffer;

            // location : { latitude , longitude }

            let { location, subCity, individual, licenseExp, city, identifyingLandmark } = req.body;

            let result = await profileSetterServiceHandler.serviceProfile({
                location,
                licensePicture,
                individual,
                licenseExp,
                city,
                identifyingLandmark,
                subCity,
                userId
            })


            if (result.success) {
                return res.status(201).json({ message: "Success in setting profile" })
            }


            return res.status(400).json({ message: "Bad Request" })



        } catch (error) {
            console.log("Error while ProfileCreateController.serviceProfile ", error.message);
            return res.status(500).json({ message: 'Internal Server error' });
        }
    }


}




module.exports = ProfileController;