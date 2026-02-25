// this route will be for users to have access to their own and their emergency contact's profile
// and also update the profile information
const express = require('express');
const { accessValidator } = require('../middleware/TokenValdiator');
const ProfileFetchAndUpdate = require('../controller/ppFetch&Update');

const profileFetchAndUpdateHandler = new ProfileFetchAndUpdate();

const profileRouter = express.Router();

profileRouter.get('/my-own-profile', accessValidator , profileFetchAndUpdateHandler.fetchMyOwn )
profileRouter.get('/emergency-contacts-profile', accessValidator , profileFetchAndUpdateHandler.fetchMyEmergencyContacts )
profileRouter.post('/update-my-own-profile', accessValidator , profileFetchAndUpdateHandler.updateMyOwn )
profileRouter.post('/update-emergency-contacts-profile', accessValidator , profileFetchAndUpdateHandler.updateMyEmergencyContact );



module.exports = profileRouter;
