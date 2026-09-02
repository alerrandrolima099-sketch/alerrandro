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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagingProvider = getMessagingProvider;
const MockProvider_1 = require("./MockProvider");
const WhatsAppCloudProvider_1 = require("./WhatsAppCloudProvider");
const config_1 = require("@whatsapp-saas/config");
let instance = null;
/** Factory - decide qual provedor usar com base em MESSAGING_PROVIDER (.env). */
function getMessagingProvider() {
    if (instance)
        return instance;
    switch (config_1.env.MESSAGING_PROVIDER) {
        case "WHATSAPP_CLOUD_API":
            instance = new WhatsAppCloudProvider_1.WhatsAppCloudProvider();
            break;
        case "MOCK":
        default:
            instance = new MockProvider_1.MockProvider();
            break;
    }
    return instance;
}
__exportStar(require("./MessagingProvider"), exports);
