import * as admin from 'firebase-admin';

// Initialize admin app once here
admin.initializeApp();

export { registerVoice } from './registerVoice';
export { generateAudio } from './generateAudio';
export { generateStory, generatePhotoStory, translateContent, generateImageCF, geminiGenerate, registerAdminLogin } from './geminiProxy';
export { addVoiceFunction, generateSpeechFunction, deleteVoiceFunction } from './elevenlabs';
