const TokenGenerationServiceHandler = require('../service/tokenGenerationService');

let tokenGenHandler = new TokenGenerationServiceHandler();

async function generateAccessFromRef(req, res) {
    try {
        let { randomString } = req.body;

        let result = await tokenGenHandler.generateAccessFromRefresh(randomString);

        if (!result.success) {
            return res.status(400).json({ message: "Invalid Refresh Token" });
        }

        return res.status(200).json( result.data );

    } catch (err) {
        console.log("Error while generateAccessFromRefresh ", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }

}


module.exports = generateAccessFromRef;