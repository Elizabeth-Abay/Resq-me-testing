const ReportHandler = require('../controller/emergencyReportController');
const { singleUpload } = require('../middleware/multerMiddleware');
const express = require('express');
const { accessValidator } = require('../middleware/TokenValdiator');

const reportHandler = new ReportHandler();


const reportRouter = express.Router();


reportRouter.post('/emergency', accessValidator , singleUpload, reportHandler.reportNow);
reportRouter.get('/accept-request' , reportHandler.acceptRequest );

// flow from the user perspective
// user inputs voice
// upload to the local storage buffer
// send to open ai - to get json
// contact the external ai model
// then receive the input
// contact the service providers - pg_notify - listen to that event and the listener contact
// in that email link construct the email link  - listener - link both user id and request id - need to be sent
// get request sent - update the table and send the emergency email to the contact

module.exports = reportRouter;


