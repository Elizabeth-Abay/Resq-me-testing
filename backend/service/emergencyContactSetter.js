const uploadFilesToCloud = require('../utils/cloudinaryStreamHelper');
const EmergencyContactSetterModel = require('../model/emergencyContactSetter')

let emergencyContactSetterModelHandler = new EmergencyContactSetterModel();

class EmergencyContactSetter {
    async emergencyContacts(sentInfo) {
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



            let result = await emergencyContactSetterModelHandler.setEmergencyContacts({
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

            console.log("Result given from db to service " , result )
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
}


module.exports = EmergencyContactSetter;