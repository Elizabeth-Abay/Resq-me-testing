const EmergencyNotificationHandlerObj = require('./model/notifListener');

console.log('🧪 [TEST] PostgreSQL Notification Test Script');
console.log('==========================================');

async function testNotificationSystem() {
    try {
        console.log('1️⃣ [TEST] Checking if listener is healthy...');
        const isHealthy = await EmergencyNotificationHandlerObj.isHealthy();
        console.log('   Health status:', isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY');

        if (!isHealthy) {
            console.log('❌ [TEST] Cannot proceed - listener is not healthy');
            return;
        }

        console.log('2️⃣ [TEST] Sending test notification...');
        
        // Send a test notification
        const testResult = await EmergencyNotificationHandlerObj.testNotification();
        
        if (testResult.success) {
            console.log('✅ [TEST] Test notification sent successfully!');
            console.log('📡 [TEST] Check your console logs above for the notification flow');
        } else {
            console.log('❌ [TEST] Test notification failed:', testResult.error);
        }

        console.log('3️⃣ [TEST] Manual database test...');
        console.log('   To manually test, run this SQL in your database:');
        console.log('   ```sql');
        console.log('   SELECT pg_notify(\'emergency_happened\', \'{\"test\": true, \"emergency_id\": \"manual-test\", \"message\": \"Manual test notification\"}\');');
        console.log('   ```');

    } catch (error) {
        console.error('❌ [TEST] Test failed:', error.message);
        console.error('❌ [TEST] Full error:', error);
    }
}

// Run the test
testNotificationSystem();

// Also test if this file is being imported properly
console.log('✅ [TEST] Test script loaded successfully');
console.log('🔧 [TEST] Run this script with: node testNotification.js');
