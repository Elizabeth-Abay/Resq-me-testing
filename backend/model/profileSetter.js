const pool = require('../config/pgConnection');


class ProfileSetModel {
    async HMOSelecter(name) {
        try {
            let query = 'SELECT id FROM Hmo_provider_name WHERE name = $1'
            let values = [name];
            let result = await pool.query(
                query, values
            )

            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "No HMO like this"
                }
            }


            return {
                success: true,
                HmoId: result.rows[0].id
            }

        } catch (err) {
            console.log("Error while UserProfileSetModel.profileSetUp ", err.message);
            return {
                success: false,
                reason: "Database insert problem"
            }
        }

    }

    async profileSetUp(sentInfo) {
        try {
            let { userId, gender, allergies, healthState , HmoEnrollId, HmoCoveragePlan, CompanyName, HmoId, idPicPath } = sentInfo;


            let query = `
                INSERT INTO user_profile(user_id ,gender ,allergies,health_state ,Hmo_enroll_id ,Hmo_plan  ,Company_name ,HMO_info , id_picture_path)
                VALUES ($1 , $2 , $3::jsonb , $4::jsonb ,$5 ,$6 , $7 , $8 , $9 )
                RETURNING id
            `;

            let values = [userId, gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoId, idPicPath];

            console.log("Values for the values " , values)
            let result = await pool.query(query, values);

            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Insertion profile failed"
                }
            }

            return {
                success: true
            }

        } catch (err) {
            console.log("Error while UserProfileSetModel.profileSetUp ", err.message);
            return {
                success: false,
                reason: "Database insert problem"
            }
        }
    }

    async providersProfileSetUp(sentInfo) {
        try {
            let { licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual } = sentInfo;

            let values = [location, licenseUrl, individual, licenseExp, city, identifyingLandmark, subCity , userId]
            let query = `
                INSERT INTO service_provider_profile(location, license_picture, is_individual_service_provider, license_expiration_date, city, identifying_landmark, sub_city, service_provider_id)
                VALUES ( $1 , $2 , $3 , $4 , $5 , $6 , $7 , $8 )
            `


            let result = await pool.query(
                query, values
            );

            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Database insertion problem"
                }
            }


            return {
                success: true
            }


        } catch (err) {
            console.log("Error while UserProfileSetModel.profileSetUp ", err.message);
            return {
                success: false,
                reason: "Database insert problem"
            }
        }
    }
}


module.exports = ProfileSetModel;