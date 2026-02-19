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
    },
    {
        name : 'profilePic',
        maxCount : 1
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


const multiEmergencySetter = multer(
    {
        storage
    }
).fields([
    {
        name: 'first-emergency',
        maxCount: 1
    },
    {
        name: 'second-emergency',
        maxCount: 1
    },
    {
        name: 'third-emergency',
        maxCount: 1
    },
    {
        name: 'fourth-emergency',
        maxCount: 1
    },
    {
        name: 'fifth-emergency',
        maxCount: 1
    }
])

module.exports = { multiUploads, singleUpload, multiEmergencySetter };


