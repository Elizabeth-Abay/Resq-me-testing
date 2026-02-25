const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

const url = new URL('https://nominatim.openstreetmap.org/reverse');

url.searchParams.append('format', 'json')
url.searchParams.append('addressdetails', 1)
url.searchParams.append('zoom', 18)


async function getAddressFromCoords(lat, lon) {
    try {

        url.searchParams.append('lat', lat)
        url.searchParams.append('lon', lon)

        const response = await fetch(url,
            {
                method: 'GET',
                headers: {
                    'User-Agent': 'ResQMission_Emergency_App_v1'
                }
            }
        );

        const { address, display_name } = response.data;

        return {
            success: true,
            data: {
                fullAddress: display_name,
                city: address.city || address.town || address.village,
                subCity: address.suburb || address.neighbourhood || address.county,
                road: address.road || 'Unknown Road'
            }
        };

    } catch (error) {
        console.error("Geocoding failed:", error.message);
        return { success: false, reason: "External API error" };
    }
}

module.exports = getAddressFromCoords;
