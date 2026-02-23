const CRITICAL_BLOOD_RISKS = {
    bleeding_disorders: [/hemophilia/i, /vwd/i, /von willebrand/i, /thrombocytopenia/i],
    liver_issues: [/cirrhosis/i, /liver failure/i, /hepatitis c/i],
    medications: [/warfarin/i, /eliquis/i, /heparin/i, /clopidogrel/i, /aspirin/i],
    thrombosis: [/factor v/i, /dv\+t/i, /pulmonary embolism/i]
};

function calculatePriorityCorrection(healthProfile, aiResult) {
    try {
        // Only correct if AI hasn't already marked it as Priority 1
        if (aiResult.priority_level === 1) return 1;

        const profileString = JSON.stringify(healthProfile).toLowerCase();

        // Check for any matches in our Risk Map
        for (const category in CRITICAL_BLOOD_RISKS) {
            const hasMatch = CRITICAL_BLOOD_RISKS[category].some(regex => regex.test(profileString));

            if (hasMatch && aiResult.detected_symptoms.includes('bleeding')) {
                console.log(`Priority BUMP: Match found in ${category}`);
                aiResult.priority_level = 1 // Elevate to Critical
            }
            // bc all the listed things in the category are critical
        }

        if (aiResult.number_of_people >= 4 && aiResult.priority_level > 3){
            aiResult.priority_level = 3
        }

        return aiResult;

    } catch (Err) {
        console.log("Error while aiResultCorrection ", Err.message);
        return {
            success: false,
            reason: "Error while aiResultCorrection "
        }
    }

}


module.exports = calculatePriorityCorrection;