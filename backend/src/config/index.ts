import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'node:fs';

// Determine .env file path - try multiple locations
const cwd = process.cwd();
const possiblePaths = [
  path.resolve(cwd, '.env'), // Current working directory (backend/)
  path.resolve(cwd, '../.env'), // Parent directory (project root)
];

let envLoaded = false;
let loadError: Error | null = null;
let loadedEnvPath: string | null = null;

const isDevelopment = process.env.NODE_ENV === 'development';

// Helper function for early logging (before logger is available)
const earlyLog = (message: string, isError = false) => {
  if (isError || isDevelopment) {
    const timestamp = new Date().toISOString();
    const level = isError ? 'ERROR' : 'INFO';
    const method = isError ? console.error : console.log;
    method(`[${timestamp}] [${level}] ${message}`);
  }
};

// Load environment variables
for (const envFilePath of possiblePaths) {
  if (existsSync(envFilePath)) {
    const result = dotenv.config({ 
      path: envFilePath, 
      override: true,
      debug: false // Disable dotenv debug output
    });
    if (!result.error) {
      envLoaded = true;
      loadedEnvPath = envFilePath;
      break;
    } else {
      loadError = result.error;
    }
  }
}

// Fallback: try default dotenv behavior
if (!envLoaded) {
  const result = dotenv.config({ override: true });
  if (!result.error) {
    envLoaded = true;
  } else {
    loadError = result.error;
  }
}

// Only log .env file errors in development (in production, env vars come from Render/cloud provider)
if (!envLoaded && loadError && isDevelopment) {
  earlyLog(`Error loading .env file: ${loadError.message}`, true);
}

// Required environment variables
const requiredEnvVars = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

// Check for required environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  earlyLog(`Missing required environment variables: ${missingVars.join(', ')}`, true);
  earlyLog(`Please create/update .env file in the backend/ directory.`, true);
  earlyLog(`Expected location: ${path.resolve(process.cwd(), '.env')}`, true);
  process.exit(1);
}

// Validate JWT_SECRET length (security requirement)
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  earlyLog(`JWT_SECRET must be at least 32 characters long (current: ${process.env.JWT_SECRET.length}).`, true);
  earlyLog('Generate a secure secret: openssl rand -base64 32', true);
  process.exit(1);
}

// Log environment loading status (development only)
if (isDevelopment) {
  const mongoUri = process.env.MONGODB_URI!;
  const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  earlyLog(`Environment loaded - MongoDB: ${maskedUri}`);
  if (loadedEnvPath) {
    earlyLog(`Loaded .env from: ${loadedEnvPath}`);
  }
}

// Validate port number
const port = parseInt(process.env.PORT || '5000', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  earlyLog(`Invalid PORT value: ${process.env.PORT}. Using default: 5000`, true);
}

// Validate JWT expires in format
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
const expiresInRegex = /^\d+[smhd]$/;
if (!expiresInRegex.test(jwtExpiresIn)) {
  earlyLog(`Invalid JWT_EXPIRES_IN format: ${jwtExpiresIn}. Using default: 7d`, true);
}

// Validate email port
const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
if (isNaN(emailPort) || emailPort < 1 || emailPort > 65535) {
  earlyLog(`Invalid EMAIL_PORT value: ${process.env.EMAIL_PORT}. Using default: 587`, true);
}

export const config = {
  port: isNaN(port) || port < 1 || port > 65535 ? 5000 : port,
  nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  
  database: {
    uri: process.env.MONGODB_URI!,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: expiresInRegex.test(jwtExpiresIn) ? jwtExpiresIn : '7d',
  },
  
  google: {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    callbackURL: (process.env.GOOGLE_CALLBACK_URL || `http://localhost:${port || 5000}/api/auth/google/callback`).trim(),
  },
  
  email: {
    host: (process.env.EMAIL_HOST || 'smtp.gmail.com').trim(),
    port: isNaN(emailPort) || emailPort < 1 || emailPort > 65535 ? 587 : emailPort,
    user: (process.env.EMAIL_USER || '').trim(),
    pass: (process.env.EMAIL_PASS || '').trim(),
    from: (process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@yourapp.com').trim(),
  },
  
  frontend: {
    url: process.env.FRONTEND_URL!.trim(),
  },
  
  session: {
    secret: (process.env.SESSION_SECRET || process.env.JWT_SECRET!).trim(),
  },
};
