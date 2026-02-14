"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.portOneWebhook = exports.cancelSubscription = exports.subscribeToPlan = exports.deleteVoiceFunction = exports.generateSpeechFunction = exports.addVoiceFunction = exports.registerAdminLogin = exports.geminiGenerate = exports.generateImageCF = exports.translateContent = exports.generatePhotoStory = exports.generateStory = exports.generateAudio = exports.registerVoice = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize admin app once here
admin.initializeApp();
var registerVoice_1 = require("./registerVoice");
Object.defineProperty(exports, "registerVoice", { enumerable: true, get: function () { return registerVoice_1.registerVoice; } });
var generateAudio_1 = require("./generateAudio");
Object.defineProperty(exports, "generateAudio", { enumerable: true, get: function () { return generateAudio_1.generateAudio; } });
var geminiProxy_1 = require("./geminiProxy");
Object.defineProperty(exports, "generateStory", { enumerable: true, get: function () { return geminiProxy_1.generateStory; } });
Object.defineProperty(exports, "generatePhotoStory", { enumerable: true, get: function () { return geminiProxy_1.generatePhotoStory; } });
Object.defineProperty(exports, "translateContent", { enumerable: true, get: function () { return geminiProxy_1.translateContent; } });
Object.defineProperty(exports, "generateImageCF", { enumerable: true, get: function () { return geminiProxy_1.generateImageCF; } });
Object.defineProperty(exports, "geminiGenerate", { enumerable: true, get: function () { return geminiProxy_1.geminiGenerate; } });
Object.defineProperty(exports, "registerAdminLogin", { enumerable: true, get: function () { return geminiProxy_1.registerAdminLogin; } });
var elevenlabs_1 = require("./elevenlabs");
Object.defineProperty(exports, "addVoiceFunction", { enumerable: true, get: function () { return elevenlabs_1.addVoiceFunction; } });
Object.defineProperty(exports, "generateSpeechFunction", { enumerable: true, get: function () { return elevenlabs_1.generateSpeechFunction; } });
Object.defineProperty(exports, "deleteVoiceFunction", { enumerable: true, get: function () { return elevenlabs_1.deleteVoiceFunction; } });
var subscription_1 = require("./subscription");
Object.defineProperty(exports, "subscribeToPlan", { enumerable: true, get: function () { return subscription_1.subscribeToPlan; } });
Object.defineProperty(exports, "cancelSubscription", { enumerable: true, get: function () { return subscription_1.cancelSubscription; } });
Object.defineProperty(exports, "portOneWebhook", { enumerable: true, get: function () { return subscription_1.portOneWebhook; } });
//# sourceMappingURL=index.js.map