import rateLimit from "express-rate-limit";

// Rate limit geral da API.
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit mais restritivo para login (mitiga brute-force - seção 4).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, message: "Too many login attempts, try again later" },
});
