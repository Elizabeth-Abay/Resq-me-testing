const notificationPool = require('../config/pgNotificationConn');
const EventEmitter = require('events');


class EmergencyNotificationModel extends EventEmitter{
    constructor(){
        super();
    }
}