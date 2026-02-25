const { multiUploads, singleUpload, multiEmergencySetter } = require('../middleware/multerMiddleware');
const express = require('express');
let { accessValidator } = require('../middleware/TokenValdiator');
const EmergecyContactSetter = require('../controller/emergencyUserSetter');
const ProfileCreateController = require('../controller/ProfileController');


const profileRouter = express.Router();

const profileCreateControllerHandler = new ProfileCreateController();
const emergencyContactSetterHandler = new EmergecyContactSetter();


profileRouter.post('/set-user-profile', accessValidator, multiUploads, profileCreateControllerHandler.userProfile);
profileRouter.post('/set-service-profile', accessValidator, singleUpload.single('license-picture'), profileCreateControllerHandler.serviceProfile);
profileRouter.post('/user/set-emergency-contacts', accessValidator, multiEmergencySetter ,emergencyContactSetterHandler.emergencySetter);


module.exports = profileRouter;

