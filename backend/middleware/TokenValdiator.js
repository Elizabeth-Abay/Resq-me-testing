const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config(
    {
        path: path.join(__dirname, '../../.env')
    }
)
let { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;

function accessValidator(req, res, next) {
    try {
        // console.log(req)
        let access = req.headers['authorization'].split(' ');

        let result = jwt.verify(access[1], ACCESS_TOKEN_SECRET);

        req.decodedAccess = result;
        // console.log("Result from access decoding " , result);
        next();
    } catch (err) {
        console.log("Error while accessValidator ", err.message);
        return res.status(401).json({ message: "Unauthorized" });
    }
}



function refreshValidator(req, res, next) {
    try {
        let { refreshToken } = req.body;

        let result = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

        req.body = result;
        next();
    } catch (err) {
        console.log("Error while refreshValidator ", err.message);
        return res.status(401).json({ message: "Unauthorized" });
    }
}



module.exports = {
    accessValidator,
    refreshValidator
}