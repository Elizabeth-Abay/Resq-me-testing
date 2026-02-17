const multer = require('multer');

let storage = multer.memoryStorage();
// means store the thing in memory

const multiUploads = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
        // bc we will use RAM to store the things 
    }
}).fields([
    {
        name: 'front',
        maxCount: 1
    },
    {
        name: 'back',
        maxCount: 1
    }

])
// since we use 2 pics for the id - front and back


const singleUpload = multer(
    {
        storage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5 MB
            // bc we will use RAM to store the things 
        }
    }
)


module.exports = { multiUploads, singleUpload };


