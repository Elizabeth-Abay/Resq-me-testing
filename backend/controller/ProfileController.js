const ProfileSetterService = require('../service/profileSetUpService');

const profileSetterServiceHandler = new ProfileSetterService();

class ProfileCreateController {
    async userProfile(req, res) {
        try {
            let { userId } = req.decodedAccess;
            let frontBuffer = req.files.front[0].buffer;
            let backBuffer = req.files.back[0].buffer;

            let { gender, allergies, healthState, HmoEnrollId, HmoCoveragePlan, CompanyName, HmoName } = req.body;


            let result = await profileSetterServiceHandler.userProfile({
                userId,
                gender,
                allergies,
                healthState,
                HmoEnrollId,
                HmoCoveragePlan,
                CompanyName,
                HmoName,
                frontBuffer,
                backBuffer
            });

            if (result.success) {
                return res.status(201).json({ message: "Successfuly created profile" });
            }

            return res.status(400).json({ message: 'Bad Request' })

        } catch (error) {
            console.log("Error while ProfileCreateController.userProfile ", error.message);
            return res.status(500).json({ message: 'Internal Server error' });
        }
    }

    async serviceProfile(req, res) {
        try {
            let { userId } = req.decodedAccess;


            let licensePicture = req.file.buffer;

            // location : { latitude , longitude }

            let { location, subCity , individual, licenseExp, city, identifyingLandmark } = req.body;

            let result = await profileSetterServiceHandler.serviceProfile({
                location,
                licensePicture,
                individual,
                licenseExp,
                city,
                identifyingLandmark,
                subCity,
                userId
            })


            if (result.success) {
                return res.status(201).json({ message: "Success in setting profile" })
            }


            return res.status(400).json({ message: "Bad Request" })



        } catch (error) {
            console.log("Error while ProfileCreateController.serviceProfile ", error.message);
            return res.status(500).json({ message: 'Internal Server error' });
        }
    }
}



// req.files = {
//   "front": [  // This is an array!
//     {
//       fieldname: 'front',
//       originalname: 'my_id_front.jpg',
//       mimetype: 'image/jpeg',
//       buffer: <Buffer ff d8 ff e0 ...>, // This is the actual image bits
//       size: 52428
//     }
//   ],
//   "back": [ same array ]
// }

module.exports = ProfileCreateController;