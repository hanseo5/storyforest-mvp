import * as admin from 'firebase-admin';

// Initialize admin app once here
admin.initializeApp();

export * from './registerVoice';
export * from './generateAudio';
export * from './geminiProxy';
export * from './elevenlabs';
