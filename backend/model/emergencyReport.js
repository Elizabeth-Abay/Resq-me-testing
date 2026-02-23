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


    async emergencyContactSelector(requestId) {
        try {
            // do a join between the request table and emergecny contact table
            let query = `
                SELECT ec.email , v_u.fullname FROM  emergency_contacts ec
                INNER JOIN emergency_report er
                ON er.reporter_id = ec.patient_id
                JOIN verified_users v_u
                ON ec.patient_id = v_u.id
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


            return {
                success: true,
                data: res.rows
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


module.exports = EmergencyDealerModel;