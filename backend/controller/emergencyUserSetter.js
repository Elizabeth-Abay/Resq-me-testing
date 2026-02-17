const EmergencyContactSetter = require('../service/emergencyContactSetter');

let emergencyContactSetterHandler = new EmergencyContactSetter();

class EmergecyContactSetter {
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


            let result = await emergencyContactSetterHandler.emergencyContacts({
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

            if (result.success){
                return res.status(201).json({message : "Successfully saved profile"});
            }

            res.status(400).json({message : "Bad request"})
        } catch (Err) {
            console.log("Error while EmergecyContactSetter.emergencySetter ", Err.message);
            return res.status(500).json({ message: "Internal server error" })
        }
    }
}

module.exports = EmergecyContactSetter;