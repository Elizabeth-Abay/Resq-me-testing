const pool = require('../config/pgConnection');


class FetchAndUpdatePpModel {
    async updateEmergencyContact(sentInfo) {
        try {
            const { id, name, email, relationship } = sentInfo;

            const fields = [];
            const values = [];
            let index = 2; // $1 is reserved for id

            if (name != null) {
                fields.push(`name = $${index++}`);
                values.push(name);
            }

            if (email != null) {
                fields.push(`email = $${index++}`);
                values.push(email);
            }

            if (relationship != null) {
                fields.push(`relationship = $${index++}`);
                values.push(relationship);
            }

            if (fields.length === 0) {
                return { success: false, reason: "No fields to update" };
            }

            const query = `
            UPDATE emergency_contacts
            SET ${fields.join(', ')}
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


    async getEmergencyContacts(userId) {
        try {
            let query = `SELECT name, email, relationship, imageUrl FROM emergency_contacts WHERE patient_id = $1`
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

    async getMyProfile(userId) {
        try {
            let query = `
            SELECT up.gender, up.allergies, up.health_state ,  vu.fullname
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




module.exports = FetchAndUpdatePpModel;