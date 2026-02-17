const { multiUploads, singleUpload } = require('../middleware/multerMiddleware');
const express = require('express');
let { accessValidator } = require('../middleware/TokenValdiator');

const profileRouter = express.Router();
const ProfileCreateController = require('../controller/ProfileController');

const profileCreateControllerHandler = new ProfileCreateController();


profileRouter.post('/set-user-profile', accessValidator, multiUploads, profileCreateControllerHandler.userProfile);
profileRouter.post('/set-service-profile', accessValidator, singleUpload.single('license-picture'), profileCreateControllerHandler.serviceProfile);


module.exports = profileRouter;

