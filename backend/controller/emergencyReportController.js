const { User , ServiceProvider } = require('../service/emergReport')

const reporterObj = new User();
const accepterObj = new ServiceProvider();

class ReportHandler {
    async reportNow(req, res) {
        try {
            let audioBuffer = req.file.buffer;
            let userId = req.decodedAccess.userId;
            let { latitude, longitude } = req.body;

            let result = await reporterObj.makeRequest({ userId, latitude, longitude, audioBuffer });

            if (result.success) {
                return res.status(200).json({
                    message: "Successful request"
                })
            }

            res.status(400).json({ message: "bad request" })

        } catch (err) {
            console.log("Error while reportNow ", err.message);
            return {
                success: false,
                reason: "Error while reportNow "
            }
        }
    }

    async acceptRequest(req, res) {
        try {
            let {report_id , provider_id } = req.query;

            let result = await accepterObj.acceptEmergency({ acceptorId : provider_id , requestId : report_id  });

            if (result.success){
                return res.status(200).json({message : "Request Accepted Successfully"});
            }

            return res.status(400).json({message : "Request already taken"})

        } catch (err) {
            console.log("Error while acceptRequest ", err.message);
            return {
                success: false,
                reason: "Error while acceptRequest "
            }
        }
    }
}


module.exports = ReportHandler;