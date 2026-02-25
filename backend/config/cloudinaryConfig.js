const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const path = require('path');


dotenv.config({
    path : path.join( __dirname , '../../.env')
});

const { CLOUDINARY_CLOUD_NAME , CLOUDINARY_API_KEY , CLOUDINARY_API_SECRET } = process.env;

cloudinary.config({
    cloud_name : CLOUDINARY_CLOUD_NAME,
    api_key : CLOUDINARY_API_KEY,
    api_secret : CLOUDINARY_API_SECRET
});







module.exports = cloudinary;