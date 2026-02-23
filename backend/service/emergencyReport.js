const EmergencyDealerModel = require('../model/emergencyReport');
const notificationEmailConstructor = require('./emailSendingService');

let emergencyDealerModel = new EmergencyDealerModel();


class ReportEmergency {
    // send to ai, put into correction , put into table , go on to select the service providers , notify them 
    async sendToAI(sentInfo) {
        try {


        } catch (Err) {
            console.log("Error while ReportEmergency.sendToAI ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.sendToAI "
            }
        }
    }

    async putIntoCorrection(sentInfo) {
        try {
            // if more than 1 patient < 4
            // if patient's health info is critical like blood pressure ... then high risk < 4
            // can we send the ai information about the people health

        } catch (Err) {
            console.log("Error while ReportEmergency.putIntoCorrection ", Err.message);
            return {
                success: false,
                reason: "Error while ReportEmergency.putIntoCorrection "
            }
        }
    }

    async putIntoTable(sentInfo) {
        try {

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