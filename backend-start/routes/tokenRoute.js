// used to generate access tokens from refresh
const express = require('express');

const { refreshValidator } = require('../middleware/TokenValdiator');
const generateAccessFromRef = require('../controller/TokenController');

const tokenRouter = express.Router();

tokenRouter.post('/generate-access-token' , refreshValidator , generateAccessFromRef); // checked

module.exports = tokenRouter;