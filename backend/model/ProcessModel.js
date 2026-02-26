const pool = require('../config/pgConnection');


class ServiceProviderRelated {

    // profile set up
    async providersProfileSetUp(sentInfo) {
        try {
            // console.log("sentInfo ", sentInfo)
            let { licenseUrl, location, licenseExp, city, identifyingLandmark, subCity, individual, userId } = sentInfo;

            let { latitude, longitude } = location;
            console.log("latitude", latitude, "longitude", longitude)
            console.log("parsed latitude", parseFloat(latitude), "parsed longitude", parseFloat(longitude));


            let values = [parseFloat(longitude), parseFloat(latitude), licenseUrl, individual, licenseExp, city, identifyingLandmark, subCity, userId]
            let query = `
                INSERT INTO service_provider_profile(location, license_picture, is_individual_service_provider, license_expiration_date, city, identifying_landmark, sub_city, service_provider_id)
                VALUES ( 
                
                ST_SetSRID(
                    ST_MakePoint($1 , $2)  , 4326
                )::geography

                ,
                $3 , $4 , $5 , $6 , $7 , $8 , $9 )
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

    // for emergency reporting finding nearby
    async findNearbyProviders(sentInfo) {
        try {
            const { latitude, longitude, searchRadiusKm } = sentInfo;

            // Query to find nearby service providers using PostGIS
            const query = `
                SELECT 
                    sp.id,
                    sp.service_provider_id as user_id,
                    sp.location,
                    sp.city,
                    sp.sub_city,
                    sp.identifying_landmark,
                    sp.license_expiration_date,
                    vu.email,
                    vu.fullname,
                    -- Calculate distance
                    ST_Distance(
                        sp.location, 
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                    ) / 1000 as distance_km
                FROM service_provider_profile sp
                JOIN verified_users vu ON sp.service_provider_id = vu.id
                WHERE ST_DWithin(
                    sp.location, 
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
                    $3 * 1000
                )
                AND sp.license_expiration_date > NOW()
                ORDER BY distance_km ASC
                LIMIT 10; -- Limit to top 10 closest providers
            `;

            const result = await pool.query(query, [longitude, latitude, searchRadiusKm]);

            // service providers profile
            let data = result.rows.map(row => ({
                userId: row.user_id,
                name: row.fullname,
                email: row.email,
                location: row.location,
                distanceKm: parseFloat(row.distance_km),
                city: row.city,
                subCity: row.sub_city,
                landmark: row.identifying_landmark
            }));

            return {
                success: true,
                data
            }

        } catch (error) {
            console.error('Error finding nearby providers:', error.message);
            return {
                success: false,
                reason: "Error while findNearbyProviders"
            }
        }
    }


    // getting service provider info
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
                data: res.rows[0]
            }
        } catch (err) {
            console.log("Error while EmergencyDealer.getServiceProviderInfo ", err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealer.getServiceProviderInfo"
            }
        }
    }
}


class UserRelated {
    // to get consent to send health info
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

    // creating profile
    async profileSetUp(sentInfo) {
        try {
            let { userId, gender, allergies, healthState, profileUrl } = sentInfo;
            // , HmoEnrollId, HmoCoveragePlan, CompanyName, HmoId,idPicPath 


            console.log("userProfile in model")
            let query = `
                INSERT INTO user_profile(user_id ,gender ,allergies,health_state , profile)
                VALUES ($1 , $2 , $3::jsonb , $4::jsonb ,$5 )
                RETURNING id
            `;

            // ,Hmo_enroll_id ,Hmo_plan  ,Company_name ,HMO_info , id_picture_path ,
            let values = [userId, gender, allergies, healthState, profileUrl];

            console.log("Values for the values ", values)
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

    // selecting profile
    async getMyProfile(userId) {
        try {
            let query = `
            SELECT up.gender, up.allergies, up.health_state ,  vu.fullname , up.profile
            FROM verified_users vu
            LEFT JOIN user_profile up
            ON vu.id = up.user_id
            WHERE vu.id = $1`

            let values = [userId];

            let res = await pool.query(query, values);

            if (res.rowCount === 0) {
                return {
                    success: false,
                    reason: "User not found"
                };
            }

            return {
                success: true,
                data: res.rows[0]
            };
        } catch (err) {
            console.log("Error while getMyProfile", err.message);
            return {
                success: false,
                reason: "Error while getMyProfile"
            };
        }
    }


    // updating profile
    async updateMyProfile(sentInfo) {
        let { userId, updateData } = sentInfo;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                fullname,
                birthDate,
                gender,
                allergies,
                health_state,
                Hmo_enroll_id
            } = updateData;

            let updatedUser = {};
            let updatedProfile = {};

            // 1. Update verified_users
            const userFields = [];
            const userValues = [];
            let userIndex = 2;

            if (fullname != null) {
                userFields.push(`fullname = $${userIndex++}`);
                userValues.push(fullname);
            }
            if (birthDate != null) {
                userFields.push(`birthDate = $${userIndex++}`);
                userValues.push(birthDate);
            }

            if (userFields.length > 0) {
                const userQuery = `
                UPDATE verified_users
                SET ${userFields.join(', ')}, updated_at = NOW()
                WHERE id = $1
                RETURNING *;
            `;
                const res = await client.query(userQuery, [userId, ...userValues]);
                updatedUser = res.rows[0];
            }

            // 2. Update user_profile
            const profileFields = [];
            const profileValues = [];
            let profileIndex = 2;

            if (gender != null) {
                profileFields.push(`gender = $${profileIndex++}`);
                profileValues.push(gender);
            }
            if (allergies != null) {
                profileFields.push(`allergies = $${profileIndex++}`);
                profileValues.push(allergies);
            }
            if (health_state != null) {
                profileFields.push(`health_state = $${profileIndex++}`);
                profileValues.push(health_state);
            }
            if (Hmo_enroll_id != null) {
                profileFields.push(`Hmo_enroll_id = $${profileIndex++}`);
                profileValues.push(Hmo_enroll_id);
            }

            if (profileFields.length > 0) {
                const profileQuery = `
                UPDATE user_profile
                SET ${profileFields.join(', ')}, updated_at = NOW()
                WHERE user_id = $1
                RETURNING *;
            `;
                const res = await client.query(profileQuery, [userId, ...profileValues]);
                updatedProfile = res.rows[0];
            }

            await client.query('COMMIT');

            return {
                success: true,
                // Merge the two updated objects into one response
                data: { ...updatedUser, ...updatedProfile }
            };

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error updating profile:", err.message);
            return {
                success: false,
                reason: "Error updating profile"
            };
        } finally {
            client.release();
        }
    }


}

class EmergencyContactRelated {
    // setting up emergency contacts
    async setEmergencyContacts(sentInfo) {
        try {
            const { userId } = sentInfo;

            if (!userId) {
                return { success: false, reason: "User ID is required" };
            }

            // Build contacts array
            const contacts = [
                { name: sentInfo.firstEmergName, email: sentInfo.firstEmergEmail, rel: sentInfo.firstEmergRelation, url: sentInfo.firstUserUrl },
                { name: sentInfo.secondEmergName, email: sentInfo.secondEmergEmail, rel: sentInfo.secondEmergRelation, url: sentInfo.secondUserUrl },
                { name: sentInfo.thirdEmergName, email: sentInfo.thirdEmergEmail, rel: sentInfo.thirdEmergRelation, url: sentInfo.thirdUserUrl },
                { name: sentInfo.fourthEmergName, email: sentInfo.fourthEmergEmail, rel: sentInfo.fourthEmergRelation, url: sentInfo.fourthUserUrl },
                { name: sentInfo.fifthEmergName, email: sentInfo.fifthEmergEmail, rel: sentInfo.fifthEmergRelation, url: sentInfo.fifthUserUrl }
            ].filter(c => c.name); // keep only contacts with a name

            if (contacts.length === 0) {
                return { success: false, reason: "No contact information provided" };
            }

            const values = [];

            const placeholders = contacts.map((contact, index) => {
                const offset = index * 5;

                values.push(
                    userId,
                    contact.name,
                    contact.email || null,
                    contact.rel || null,
                    contact.url || null
                );

                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
            }).join(",");

            const query = `
            INSERT INTO emergency_contacts 
            (patient_id, name, email, relationship, imageUrl)
            VALUES ${placeholders}
            RETURNING *;
        `;

            const result = await pool.query(query, values);

            console.log(`Inserted ${result.rowCount} emergency contacts.`);

        return { success: true, count: result.rowCount };

    } catch (Err) {
        console.log('Error while EmergencyContactSetterModel.setEmergencyContacts ', Err.message);
        return {
            success: false,
            reason: "Error while EmergencyContactSetterModel.setEmergencyContacts"
        };
    }
}


    // doing an update on the emergency contact
    async updateEmergencyContact(sentInfo) {
        try {
            const { id, name, email, relationship } = sentInfo;

            const fields = [];
            const values = [];
            let index = 2; // $1 is reserved for id

            if (name != null) {
                fields.push(`name = $${ index++}`);
                values.push(name);
            }

            if (email != null) {
                fields.push(`email = $${ index++ } `);
                values.push(email);
            }

            if (relationship != null) {
                fields.push(`relationship = $${ index++ } `);
                values.push(relationship);
            }

            if (fields.length === 0) {
                return { success: false, reason: "No fields to update" };
            }

            const query = `
            UPDATE emergency_contacts
            SET ${ fields.join(', ') }
            WHERE id = $1
        RETURNING *
            `;

            const result = await pool.query(query, [id, ...values]);

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (err) {
            console.log("Error updating emergency contact", err.message);
            return {
                success: false,
                reason: "Error updating emergency contact"
            };
        }
    }

    // for ui case
    async getEmergencyContacts(userId) {
        try {
            let query = `SELECT id, name, email, relationship, imageUrl FROM emergency_contacts WHERE patient_id = $1`
            let values = [userId];

            let res = await pool.query(query, values);

            return {
                success: true,
                data: res.rows
                // the data = [] means no emergency contact for the user
            }
        } catch (err) {
            console.log("Error while getEmergencyContacts", err.message);
            return {
                success: false,
                reason: "Error while getEmergencyContacts"
            };
        }
    }

    // fetching email to send alert
    async selectEmergencyContacts(userId) {
        try {
            let query = `SELECT email FROM emergency_contacts WHERE patient_id = $1`;
            let values = [userId];

            let result = await pool.query(query, values);

            if (result.rowCount === 0) {
                return {
                    success: true,
                    data: []
                }
            }

            return {
                success: true,
                data: result.rows
                // result.rows = [{ email}]
            }

        } catch (Err) {
            console.log('Error while EmergencyContactSetterModel. selectEmergencyContacts selectEmergencyContacts ', Err.message);
            return {
                success: false,
                reason: "Error while EmergencyContactSetterModel. selectEmergencyContacts selectEmergencyContacts"
            }
        }
    }

    // preparing the emailed content in here
    async selectingToNotifyEmergContacts(requestId) {
        try {
            // do a join between the request table and emergecny contact table
            // we need the information of the service provider
            let query = `
                SELECT ec.email, v_u.fullname, spp.city, spp.sub_city, spp.identifying_landmark  
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

            let result = await pool.query(query, values);


            if (result.rowCount === 0) {
                return {
                    success: false,
                    reason: "Error while selectingToNotifyEmergContacts"
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


}


class ReportRelated {
    async createAReport(sentInfo) {
        try {
            let { userId, severity, longitude, latitude } = sentInfo;
            let query = `SELECT * FROM  creating_a_report($1, $2, $3, $4)`
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

    async acceptReport(sentInfo) {
        try {
            let { acceptorId, requestId } = sentInfo;

            // check if no one has accepted and if it is accepted then return false else return id
            // check if acceptor is serviceprovider

            let query = `
                UPDATE emergency_report SET accepted_by = $1 WHERE id = $2 AND accepted_by IS NULL
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
}



module.exports = { ServiceProviderRelated, UserRelated, EmergencyContactRelated, ReportRelated }