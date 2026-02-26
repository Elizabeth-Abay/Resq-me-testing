const client = require('../config/assemblyAIConfig');

// then send the voice message to the ai and then recive the transcription
async function transcribeAudio(filestream) {
    try {
        let result = await client.transcripts.transcribe({
            audio : filestream
        });


        if (!result) {
            return {
                success: false,
                reason: "Problem receiving the transcribed info"
            }
        }

        console.log("Result from assembly ai's transcription is ", result.text);

        return {
            success: true,
            data: result.text
        }

    } catch (err) {
        console.log("Error while transcribeAudio ", err.message);
        return {
            success: false,
            reason: "Failed to do voice transcription"
        }
    }

}

module.exports = transcribeAudio;