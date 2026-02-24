const { ReportEmergency } = require('../service/emergencyReport');

const reporterObj = new ReportEmergency();

class ReportHandler {
    async reportNow(req, res) {
        try {
            let audioBuffer = req.file.buffer;
            let userId = req.decodedAccess.userId;
            let { latitude, longitude } = req.body;

            let result = await reporterObj.makeRequest({ userId, latitude, longitude, audioBuffer });

            if (result.success) {
                return res.status(200).json({
                    message : "Successful request"
                })
            }

            res.status(400).json({message : "bad request"})

        } catch (err) {
            console.log("Error while reportNow ", err.message);
            return {
                success: false,
                reason: "Error while reportNow "
            }
        }
    }
}


module.exports = ReportHandler;