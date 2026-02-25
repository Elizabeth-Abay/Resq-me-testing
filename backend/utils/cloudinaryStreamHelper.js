const cloudinary = require('../config/cloudinaryConfig');

async function uploadFilesToCloud({ buffer, folder }) {
    return new Promise((resolve, reject) => {
        // upload_stream returns stream obj and it is call back based
        let stream = cloudinary.uploader.upload_stream(
            {
                folder 
            },
            (error, result) => {
                if (result) {
                    resolve(result.secure_url);
                    // this is reached once stream.end is called
                }
                else reject(error)

            }
        );

        // the resolve will be called once u are done with the stream.end
        stream.end(buffer);
    })

}



module.exports = uploadFilesToCloud;