const pool = require('../config/pgConnection');


class ServiceProviderRelated {
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
}


class UserRelated {

}

class EmergencyContactRelated {


}



module.exports = { ServiceProviderRelated, UserRelated, EmergencyContactRelated }