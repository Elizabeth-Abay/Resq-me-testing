const openai = require('../config/openAIConfig');
const { toFile } = require('openai');

// then send the voice message to the ai and then recive the transcription
async function transcribeAudio(filestream) {
    try {
        let fileForm = await toFile(filestream , 'audio.m4a');
        let result = await openai.audio.transcriptions.create({
            file: fileForm,
            model: "whisper-1",
            response_format: "json"
        });

        console.log("Result from open ai's transcription is ", result);

        if (!result) {
            return {
                success: false,
                reason: "Problem receiving the transcribed info"
            }
        }

        return {
            success: true,
            data: result
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