const { date } = require('joi');
const pool = require('../config/pgConnection');


class EmergencyDealerModel {
    async acceptReport(sentInfo) {
        try {
            let { acceptorId, requestId } = sentInfo;

            // check if no one has accepted and if it is accepted then return false else return id
            // check if acceptor is serviceprovider

            let query = `
                UPDATE emergency_report SET accepted_by = $1 WHERE id = $2 AND accepted_by = NULL
            `
            let values = [acceptorId, requestId];

            let res = await pool.query(query, values);

            if (res.rowCount === 0) {
                return {
                    success: false,
                    reason: "Request already accepted by another"
                }
            }

            return {
                success: true
            }

        } catch (err) {
            console.log("Error while EmergencyDealer.acceptReport ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealer.acceptReport"
            }
        }
    }


    async emergencyContactAndEmailedInfo(requestId) {
        try {
            // do a join between the request table and emergecny contact table
            // we need the information of the service provider


            let query = `
                SELECT ec.email , v_u.fullname , spp.city , spp.sub_city , spp.identifying_landmark  
                FROM  emergency_report er 
                INNER JOIN verified_users v_u
                ON er.reporter_id = v_u.id
                LEFT JOIN emergency_contacts ec
                ON v_u.id = ec.patient_id
                INNER JOIN service_provider_profile spp
                ON spp.service_provider_id = er.accepted_by
                WHERE er.id = $1
            `

            let values = [requestId];

            let res = await pool.query(query, values);


            if (res.rowCount === 0) {
                return {
                    success: false,
                    reason: "Not able to access the emergency contacts"
                }
            }


            let { fullname, city, sub_city, identifying_landmark } = result.rows[0];
            // structuring the input properly
            let emails = result.rows
                .map(row => row.email)
                .filter(email => email !== null);


            let payLoad = {
                fullname, 
                city, 
                sub_city, 
                identifying_landmark,
                emails
                // emails = [ of emails to contact]
            }


            return {
                success: true,
                data: payLoad
            }

        } catch (err) {
            console.log("Error while EmergencyDealer.emergencyContactSelector ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealer.emergencyContactSelector"
            }
        }
    }



    async getServiceProviderInfo(providerId) {
        try {
            let query = `
                SELECT v_u.fullname , sp.city , sp.identifying_landmark , sp.sub_city
                FROM verified_users v_u 
                INNER JOIN service_provider_profile sp
                ON v_u.id = sp.service_provider_id
                WHERE v_u.id = $1
            `

            values = [providerId];

            let res = await pool.query(query, values);

            if (res.rowCount === 0) {
                return {
                    success: false,
                    reason: "Service provider profile not found"
                }
            }

            return {
                success: true,
                data: res.rows
            }
        } catch (err) {
            console.log("Error while EmergencyDealer.getServiceProviderInfo ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealer.getServiceProviderInfo"
            }
        }
    }


    async putReport(sentInfo) {
        try {

        } catch (err) {
            console.log("Error while EmergencyDealer.putReport ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealer.putReport"
            }
        }
    }
}


class EmergencyReportMaker {
    async healthProfileSelector(userId) {
        try {
            let query = `
            SELECT  gender , health_state , allergies , consent_to_share_information_ai FROM user_profile WHERE user_id = $1
            `;

            let values = [userId];

            let result = await pool.query(query, values);


            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Problem while fetching health profile from users"
                }
            }

            return {
                success: true,
                data: result.rows[0]
            }

        } catch (err) {
            console.log("Error while EmergencyReportMaker.healthProfileSelector ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyReportMaker.healthProfileSelector"
            }
        }
    }

    async createAReport(sentInfo) {
        try {
            let { userId, severity, longitude, latitude } = sentInfo;
            let query = `SELECT * FROM  creating_a_report($1 , $2 , $3, $4)`
            let values = [userId, severity, longitude, latitude];

            let result = await pool.query(query, values);

            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Error while inserting emergency report"
                }
            }

            return {
                success: true
            }

        } catch (err) {
            console.log("Error while EmergencyReportMaker.createAReport ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyReportMaker.createAReport"
            }
        }
    }
}


module.exports = { EmergencyDealerModel, EmergencyReportMaker }; 