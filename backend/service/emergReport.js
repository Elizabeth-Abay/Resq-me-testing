const { ReportRelated, ServiceProviderRelated, UserRelated, EmergencyContactRelated } = require('../model/ProcessModel');
const { contactServiceProviders, notificationEmailConstructor } = require('./emailSendingService');
const EventEmitter = require('events'); // bc it needs to send email notification to emergency contacts
// this will be triggered once the pg emits notifications for the request
const getAddressFromCoords = require('../utils/addressDecoder');
const transcribeAudio = require('../service/voiceTranscription');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { MODEL_URL } = process.env;


const reportMaker = new ReportRelated();
const serviceProviderHandler = new ServiceProviderRelated();
const userHandler = new UserRelated();
const emergencyContactHandler = new EmergencyContactRelated();


class ServiceProvider {
    async acceptEmergency(sentInfo) {
        try {
            // notify the user and update the table
            let { acceptorId, requestId } = sentInfo;
            // notify the emergency contacts
            let res = await reportMaker.acceptReport({ acceptorId, requestId });

            if (!res.success) {
                return {
                    success: false,
                    reason: res.reason
                }
            }

            // select emails and payload to notify emergency contacts


            let emergencyContactInfo = await this.getEmergencyContacts(requestId);

            if (!emergencyContactInfo.success) {
                return {
                    success: false,
                    reason: "Problem while calling this.getEmergencyContacts "
                }
            }

            let { data } = emergencyContactInfo;
            // fetch emergency contacts
            // notify emergency contacts

            // access the emails
            let { emails, fullname, city, sub_city, identifying_landmark } = data;

            // then send for all emails

            let emailSent = await notificationEmailConstructor({ emails, fullname, city, sub_city, identifying_landmark });

            // maybe send email to the patient too
            if (!emailSent.success) {
                return {
                    success: false,
                    reason: "Email sending problem for the emergency users"
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


    async getEmergencyContacts(requestId) {
        try {
            let emergencyContacts = await emergencyContactHandler.selectingToNotifyEmergContacts(requestId);

            // then send them emails

            if (!emergencyContacts.success) {
                return {
                    success: false,
                    reason: emergencyContacts.reason
                }
            }

            let { data } = emergencyContacts;

            return {
                success: true,
                data
            }

        } catch (Err) {
            console.log("Error while EmergencyDealerService.contactEmergencyContacts ", Err.message);
            return {
                success: false,
                reason: "Error while EmergencyDealerService.contactEmergencyContacts"
            }
        }
    }
}

class User {
    async makeRequest(sentInfo) {
        try {
            let { userId, latitude, longitude, audioBuffer } = sentInfo;

            // first transcribe
            if (audioBuffer) {
                console.log("Audio buffer received, starting transcription...", audioBuffer);
                if (!audioBuffer) {
                    // make the request directly and notify criticality
                }
                let sentToAI = await this.sendToAI({ audioBuffer, userId });

                if (!sentToAI.success) {
                    return {
                        success: false,
                        reason: "Error while sending to ai microservice"
                    }
                }

                // {"severity" : "Critical","priority_level"1,"recommended_action""Senhelimmediately","first_aid_steps"["Checfovisiblinjuries","Cleasmalwoundipossible","Keethvicticomfortable.","Monitofodizziness","Stawitthvictim"]

                // see the ai thing
                let { severity, first_aid_steps } = sentToAI.data;


                let puttingIntoTable = await this.putIntoTable({ severity, userId, latitude, longitude });



                if (puttingIntoTable.success) {
                    if (severity.toLowerCase() === 'low') {
                        return {
                            success: true,
                            firstAid: first_aid_steps,
                            message: "You have first aid"
                        }
                    }
                    return {
                        success: true,
                        message: "A service provider will be contacted Immediately",
                        firstAid: first_aid_steps
                    }
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

    async makeRequestWithoutAudio(sentInfo) {
        try {

        } catch (Err) {
            console.log("Error while ReportEmergency.makeRequestWithoutAudio", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.makeRequestWithtoutAudio"
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
            // let consent = await emergencyReportMaker.healthProfileSelector(userId);

            // if (!consent.success) {
            //     return {
            //         success: false,
            //         reason: "Error while fetching the health profile"
            //     }
            // }

            // let { data } = consent;

            // if (data.consent_to_share_information_ai) {
            //     // then add it to payload
            //     sentPayload.gender = data.gender,
            //         sentPayload.healthInformatuion = data.health_state,
            //         sentPayload.allergies = data.allergies
            // }

            // then do a post request to the ai end point to microservice ai

            console.log("Sending payload to AI microservice: ", sentPayload);
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

            if (!aiMessage.ok) {
                console.log("AI microservice responded with an error: ", aiMessage.statusText);
                return {
                    success: false,
                    reason: "AI microservice error: " + aiMessage.statusText
                };
            }

            let aiResponse = await aiMessage.json();
            console.log("AI Response: ", aiResponse);
        
            if (!aiResponse.error) {
                return {
                    success: true,
                    data: aiResponse
                }
            }

            return {
                success: false
            }
        } catch (Err) {
            console.log("Error while ReportEmergency.sendToAI ", Err);
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

            let placingIntoRequest = await reportMaker.createAReport({ severity, userId, latitude, longitude });

            if (!placingIntoRequest.success) {
                return {
                    success: false,
                    reason: "Error while emergencyReportMaker.createAReport"
                }
            }


            // check if ranked severity is low -> then display messages to the user
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

}


module.exports = { User, ServiceProvider }


