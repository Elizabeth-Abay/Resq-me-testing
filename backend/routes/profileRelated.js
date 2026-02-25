// this route will be for users to have access to their own and their emergency contact's profile
// and also update the profile information
const express = require('express');
const { accessValidator } = require('../middleware/TokenValdiator');
const ProfileController = require('../controller/profileAndEmergencySet');
const { multiUploads , multiEmergencySetter } = require('../middleware/multerMiddleware');

const profileFetchAndUpdateHandler = new ProfileController();

const profileRouter = express.Router();

profileRouter.get('/my-own-profile', accessValidator, profileFetchAndUpdateHandler.fetchMyOwn)
profileRouter.get('/emergency-contacts-profile', accessValidator, profileFetchAndUpdateHandler.fetchMyEmergencyContacts)
profileRouter.post('/update-my-own-profile', accessValidator, profileFetchAndUpdateHandler.updateMyOwn)
profileRouter.post('/update-emergency-contacts-profile', accessValidator, profileFetchAndUpdateHandler.updateMyEmergencyContact);
profileRouter.post('/create-my-profile', accessValidator, multiUploads , profileFetchAndUpdateHandler.userProfile);
profileRouter.post('/create-provider-profile', accessValidator, profileFetchAndUpdateHandler.serviceProfile);
profileRouter.post('/create-emergency-contacts', accessValidator, multiEmergencySetter , profileFetchAndUpdateHandler.emergencySetter)




module.exports = profileRouter;
