const  pool = require('../config/pgConnection')

class EmergencyContactSetterModel {
    async setEmergencyContacts(sentInfo) {
        try {
            // batch insert
            let {
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
            } = sentInfo;

            let query = `
                INSERT INTO emergency_contacts(patient_id ,  name , email , relationship , imageUrl)
                VALUES 
                    ($1 , $2 , $3 , $4 , $5),
                    ($1 , $6 , $7 , $8 , $9),
                    ($1, $10 , $11 , $12 , $13),
                    ($1, $14 , $15 , $16 , $17),
                    ($1, $18, $19 , $20 , $21)
            `

            let values = [
                userId,
                firstEmergName, firstEmergEmail, firstEmergRelation, firstUserUrl,
                secondEmergName, secondEmergEmail, secondEmergRelation, secondUserUrl,
                thirdEmergName, thirdEmergEmail, thirdEmergRelation, thirdUserUrl,
                fourthEmergName, fourthEmergEmail, fourthEmergRelation, fourthUserUrl,
                fifthEmergName, fifthEmergEmail, fifthEmergRelation, fifthUserUrl
            ];

            let result = await pool.query( query , values);

            console.log("Inputting into model is done " , result.rowCount)

            if (result.rowCount === 0){
                return {
                    success : false,
                    reason : "Database insertion problem"
                }
            }

            return {
                success : true
            }

        } catch (Err) {
            console.log('Error while EmergencyContactSetterModel.setEmergencyContacts ', Err.message);
            return {
                success: false,
                reason: "Error while EmergencyContactSetterModel.setEmergencyContacts"
            }
        }
    }
}


module.exports = EmergencyContactSetterModel;