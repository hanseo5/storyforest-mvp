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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortOneClient = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const PORTONE_API_URL = 'https://api.iamport.kr';
class PortOneClient {
    apiKey;
    apiSecret;
    accessToken = null;
    tokenExpiresAt = 0;
    constructor() {
        // Use Firebase config or fallback to environment variables
        // For MVP, if config is missing, it might fail.
        // User needs to set these via: firebase functions:config:set portone.api_key="..." portone.api_secret="..."
        this.apiKey = functions.config().portone?.api_key || process.env.PORTONE_API_KEY || '';
        this.apiSecret = functions.config().portone?.api_secret || process.env.PORTONE_API_SECRET || '';
    }
    async getToken() {
        if (!this.apiKey || !this.apiSecret) {
            console.warn('PortOne API keys missing. Using MOCK mode.');
            return 'mock-token';
        }
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }
        try {
            const response = await axios_1.default.post(`${PORTONE_API_URL}/users/getToken`, {
                imp_key: this.apiKey,
                imp_secret: this.apiSecret
            });
            if (response.data.code !== 0) {
                throw new Error(`PortOne Token Error: ${response.data.message}`);
            }
            const { access_token, expired_at } = response.data.response;
            this.accessToken = access_token;
            this.tokenExpiresAt = expired_at * 1000 - 60000; // Buffer 1 min
            return access_token;
        }
        catch (error) {
            console.error('Failed to get PortOne token:', error.response?.data || error.message);
            throw new Error('Authentication with Payment Gateway failed');
        }
    }
    /**
     * One-time payment using a billing key
     */
    async paymentList(userId) {
        // Implementation for checking history if needed
        return [];
    }
    /**
     * Make a payment using a billing key (registered card/account)
     */
    async payWithBillingKey(params) {
        const token = await this.getToken();
        if (token === 'mock-token') {
            console.log(`[MOCK] payWithBillingKey: ${params.amount} KRW, merchant_uid: ${params.merchantUid}`);
            return {
                imp_uid: `mock_imp_${Date.now()}`,
                merchant_uid: params.merchantUid,
                amount: params.amount,
                status: 'paid'
            };
        }
        try {
            const response = await axios_1.default.post(`${PORTONE_API_URL}/subscribe/payments/again`, {
                customer_uid: params.customerUid,
                merchant_uid: params.merchantUid,
                amount: params.amount,
                name: params.name,
                buyer_name: params.buyerName,
                buyer_email: params.buyerEmail
            }, {
                headers: { Authorization: token }
            });
            if (response.data.code !== 0) {
                // Payment failed
                throw new Error(response.data.message);
            }
            return response.data.response;
        }
        catch (error) {
            console.error('Payment with billing key failed:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Schedule a future payment
     */
    async schedulePayment(params) {
        const token = await this.getToken();
        if (token === 'mock-token') {
            console.log(`[MOCK] schedulePayment: ${params.amount} KRW at ${new Date(params.scheduleAt * 1000).toISOString()}`);
            return {
                customer_uid: params.customerUid,
                merchant_uid: params.merchantUid,
                schedule_at: params.scheduleAt,
                amount: params.amount
            };
        }
        try {
            const response = await axios_1.default.post(`${PORTONE_API_URL}/subscribe/payments/schedule`, {
                customer_uid: params.customerUid,
                schedules: [{
                        merchant_uid: params.merchantUid,
                        schedule_at: params.scheduleAt,
                        amount: params.amount,
                        name: params.name,
                        buyer_name: params.buyerName,
                        buyer_email: params.buyerEmail
                    }]
            }, {
                headers: { Authorization: token }
            });
            if (response.data.code !== 0) {
                throw new Error(response.data.message);
            }
            return response.data.response;
        }
        catch (error) {
            console.error('Scheduling payment failed:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Cancel scheduled payments
     */
    async unschedule(customerUid) {
        const token = await this.getToken();
        if (token === 'mock-token') {
            console.log(`[MOCK] unschedule for ${customerUid}`);
            return { code: 0, message: 'Mock unschedule success' };
        }
        try {
            const response = await axios_1.default.post(`${PORTONE_API_URL}/subscribe/payments/unschedule`, {
                customer_uid: customerUid
            }, {
                headers: { Authorization: token }
            });
            return response.data.response;
        }
        catch (error) {
            console.error('Unscheduling failed:', error.response?.data || error.message);
            // Don't throw if just not found
        }
    }
    /**
     * Cancel a payment (Refund)
     */
    async cancelPayment(impUid, reason) {
        const token = await this.getToken();
        if (token === 'mock-token') {
            console.log(`[MOCK] cancelPayment ${impUid}`);
            return { code: 0, message: 'Mock cancel success' };
        }
        try {
            const response = await axios_1.default.post(`${PORTONE_API_URL}/payments/cancel`, {
                imp_uid: impUid,
                reason: reason
            }, {
                headers: { Authorization: token }
            });
            if (response.data.code !== 0) {
                throw new Error(response.data.message);
            }
            return response.data.response;
        }
        catch (error) {
            console.error('Refund failed:', error.response?.data || error.message);
            throw error;
        }
    }
}
exports.PortOneClient = PortOneClient;
//# sourceMappingURL=portone.js.map