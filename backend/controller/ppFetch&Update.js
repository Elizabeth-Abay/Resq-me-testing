const FetchAndUpdatePpService = require('../service/profileUpdateService.js');
const fetchAndUpdateHandler = new FetchAndUpdatePpService();

class ProfileFetchAndUpdate {
    async fetchMyOwn(req, res) {
        try {
            const { userId } = req.decodedAccess;

            const result = await fetchAndUpdateHandler.fetchMyProfile(userId);

            if (result.success) {
                return res.status(200).json(result.data);
            }

            return res.status(400).json({ message: result.reason || "Profile not found" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.fetchMyOwn: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    async updateMyOwn(req, res) {
        try {
            const { userId } = req.decodedAccess;
            const updatedProfile = req.body; // Fullname, birthDate, allergies, etc.

            const result = await fetchAndUpdateHandler.updateMyProfile({ userId, updatedProfile });

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

    async updateMyEmergencyContact(req, res) {
        try {
            const { id, name, email, relationship } = req.body;

            // Basic validation check before hitting service
            if (!id) return res.status(400).json({ message: "Contact ID is required" });

            const result = await fetchAndUpdateHandler.updateEmergencyContact({ id, name, email, relationship });

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


    async fetchMyEmergencyContacts(req, res) {
        try {
            const { userId } = req.decodedAccess;

            const result = await fetchAndUpdateHandler.fetchEmergencyProfiles(userId);

            if (result.success) {
                return res.status(200).json(result.data);
            }

            return res.status(400).json({ message: result.reason || "No contacts found" });

        } catch (Err) {
            console.error("Error while ProfileFetchAndUpdate.fetchMyEmergencyContacts: ", Err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }
}

module.exports = ProfileFetchAndUpdate;