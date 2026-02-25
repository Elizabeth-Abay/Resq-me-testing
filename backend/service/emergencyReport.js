const { EmergencyDealerModel, EmergencyReportMaker } = require('../model/emergencyReport');
const notificationEmailConstructor = require('./emailSendingService');
const transcribeAudio = require('./voiceTranscription');
const calculatePriorityCorrection = require('./resultCorrection');
const { AwsContextImpl } = require('twilio/lib/rest/accounts/v1/credential/aws');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
})

const { MODEL_URL } = process.env;


let emergencyDealerModel = new EmergencyDealerModel();
let emergencyReportMaker = new EmergencyReportMaker();


class ReportEmergency {
    async makeRequest(sentInfo) {
        try {
            let { userId, latitude, longitude, audioBuffer } = sentInfo;

            // first transcribe
            if (audioBuffer) {
                let sentToAI = await this.sendToAI({ audioBuffer, userId });

                if (!sentToAI.success) {
                    return {
                        success: false,
                        reason: "Error while sending to ai microservice"
                    }
                }

                // see the ai thing
                let { severity, recommended_action, priority_level } = sentToAI.data;


                let puttingIntoTable = await this.putIntoTable({ severity, userId, latitude, longitude });

                if (puttingIntoTable.success) {
                    return {
                        success: true
                    }
                    // then there will be a notification from the data base end
                }

                return {
                    success: false,
                    reason: "Error while putting info into a report table"
                }


            }



        } catch (Err) {
            console.log("Error while ReportEmergency.makeRequest", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.makeRequest"
            }
        }
    }
    // send to ai, put into correction , put into table , go on to select the service providers , notify them 
    async sendToAI(sentInfo) {
        try {
            let { audioBuffer, userId } = sentInfo;
            // audioBuffer is the data stream
            let sentPayload = {};

            let result = await transcribeAudio(audioBuffer);

            if (!result.success) {
                return {
                    success: false,
                    reason: "Error while transcribing the voice"
                }
            }

            sentPayload.message = result.data;

            // and check consent to share with ai
            let consent = await emergencyReportMaker.healthProfileSelector(userId);

            if (!consent.success) {
                return {
                    success: false,
                    reason: "Error while fetching the health profile"
                }
            }

            let { data } = consent;

            if (data.consent_to_share_information_ai) {
                // then add it to payload
                sentPayload.gender = data.gender,
                    sentPayload.healthInformatuion = data.health_state,
                    sentPayload.allergies = data.allergies
            }

            // then do a post request to the ai end point to microservice ai
            let aiMessage = await fetch(
                MODEL_URL,
                {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(sentPayload)
                }
            )

            let aiResponse = await aiMessage.json();
            console.log("AI Response: ", aiResponse);

            if (aiResponse.error === ""){
                return {
                    success : true,
                    data : aiResponse
                }
            }

            return {
                success : false
            }
        } catch (Err) {
            console.log("Error while ReportEmergency.sendToAI ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.sendToAI "
            }
        }
    }



    async putIntoTable(sentInfo) {
        try {
            let { severity, userId, latitude, longitude } = sentInfo;
            // { userId, severity, longitude, latitude}

            let placingIntoRequest = await emergencyReportMaker.createAReport({ severity, userId, latitude, longitude });

            if (!placingIntoRequest.success) {
                return {
                    success: false,
                    reason: "Error while emergencyReportMaker.createAReport"
                }
            }

            // emit an event to notify near by people

            return {
                success: true
            }
        } catch (Err) {
            console.log("Error while ReportEmergency.putIntoTable ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.putIntoTable "
            }
        }
    }


    async selectServiceProviders(sentInfo) {
        try {

        } catch (Err) {
            console.log("Error while ReportEmergency.selectServiceProviders ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.selectServiceProviders "
            }
        }
    }

    async notifyProviders(sentInfo) {
        try {
            // catch user's health profile and allergies and send to service providers

        } catch (Err) {
            console.log("Error while ReportEmergency.putIntoCorrection ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.putIntoCorrection "
            }
        }
    }
}


class EmergencyDealerService {

    async acceptEmergency(sentInfo) {
        try {
            // notify the user and update the table
            let { acceptorId, requestId } = sentInfo;
            // notify the emergency contacts
            let res = await emergencyDealerModel.acceptReport({ acceptorId, requestId });

            if (!res.success) {
                return {
                    success: false,
                    reason: res.reason
                }
            }

            // notify emergency contacts
            let emergencyContacts = await emergencyDealerModel.emergencyContactSelector(requestId);

            if (!emergencyContacts.success && !(emergencyContacts.reason === 'Not able to access the emergency contacts')) {
                return {
                    success: false,
                    reason: emergencyContacts.reason
                }
            }


            // then send email to users
            let emailEmergencyContacts = emergencyContacts.data; // [ { email , fullname }]
            // select the service provider's info
            let serviceInfo = await emergencyDealerModel.getServiceProviderInfo(acceptorId);

            if (!serviceInfo.success) {
                return {
                    success: false,
                    reason: "Problem fetching the service provider profile"
                }
            }

            let serviceProviderData = serviceInfo.data;

            // else call the email sending
            let successfulSent = 0;

            for (let sent of emailEmergencyContacts) {
                let emailSending = await notificationEmailConstructor({
                    email: sent.email,
                    userName: sent.fullname,
                    serviceProviderInfo: serviceProviderData
                })


                if (emailSending.success) {
                    successfulSent++
                }
            }

            if (successfulSent === 0) {
                return {
                    success: false,
                    reason: "Could not reach the emergency contacts"
                }
            }


            return {
                success: true
            }




        } catch (Err) {
            console.log("Error while EmergencyDealerService.reportEmergency ", Err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealerService.reportEmergency"
            }
        }
    }


    // async rejectEmergency(sentInfo){
    //     try{


    //     } catch (Err){
    //         console.log("Error while EmergencyDealerService.reportEmergency " , Err.message);
    //         return {
    //             success : false,
    //             reason : "Error while EmergencyDealerService.reportEmergency"
    //         }
    //     }
    // }


}

module.exports = { ReportEmergency, EmergencyDealerService }