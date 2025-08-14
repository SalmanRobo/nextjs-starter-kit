/**
 * Cross-Domain Authentication Types
 * Enterprise-grade type definitions for secure cross-domain SSO and communication
 */

import { UserProfile, AuthErrorDetails } from './types';
import { CrossDomainMessage, CrossDomainAuthToken } from './types-utils';

// === DOMAIN CONFIGURATION TYPES ===

export interface DomainConfig {
  name: string;
  hostname: string;
  isAuthDomain: boolean;
  isMainApp: boolean;
  allowedOrigins: string[];
  csrfProtection: boolean;
  secureCookies: boolean;
  cookieDomain: string;
}

export interface CrossDomainConfig {
  authDomain: string;
  appDomain: string;
  allowedDomains: string[];
  tokenExpiryMinutes: number;
  maxRedirectDepth: number;
  csrfSecret: string;
  encryptionKey: string;
}

// === CROSS-DOMAIN AUTHENTICATION FLOW TYPES ===

export interface CrossDomainAuthFlow {
  initiatingDomain: string;
  targetDomain: string;
  returnUrl: string;
  state: string;
  nonce: string;
  timestamp: number;
  challengeMethod?: 'S256' | 'plain';
  codeChallenge?: string;
}

export interface CrossDomainAuthResult {
  success: boolean;
  token?: CrossDomainAuthToken;
  user?: UserProfile;
  redirectUrl?: string;
  error?: AuthErrorDetails;
  metadata: {
    flowId: string;
    completedAt: number;
    duration: number;
    securityLevel: 'low' | 'medium' | 'high';
  };
}

// === MESSAGE TYPES FOR CROSS-DOMAIN COMMUNICATION ===

// Authentication token message
export interface CrossDomainTokenMessage extends CrossDomainMessage<CrossDomainAuthToken> {
  type: 'AUTH_TOKEN';
  payload: CrossDomainAuthToken & {
    tokenId: string;
    issuer: string;
    audience: string;
    scopes: string[];
  };
  signature?: string;
}

// Authentication error message
export interface CrossDomainErrorMessage extends CrossDomainMessage<AuthErrorDetails> {
  type: 'AUTH_ERROR';
  payload: AuthErrorDetails & {
    domain: string;
    flowId: string;
    recoverable: boolean;
    retryAfter?: number;
  };
}

// Authentication success message
export interface CrossDomainSuccessMessage extends CrossDomainMessage<{
  user: Pick<UserProfile, 'id' | 'email' | 'user_metadata'>;
  sessionId: string;
}> {
  type: 'AUTH_SUCCESS';
  payload: {
    user: Pick<UserProfile, 'id' | 'email' | 'user_metadata'>;
    sessionId: string;
    loginMethod: 'password' | 'oauth' | 'sso';
    twoFactorCompleted: boolean;
  };
}

// Logout message
export interface CrossDomainLogoutMessage extends CrossDomainMessage<{
  sessionId: string;
  reason: string;
}> {
  type: 'AUTH_LOGOUT';
  payload: {
    sessionId: string;
    reason: 'user_initiated' | 'session_expired' | 'security_logout' | 'admin_logout';
    logoutAllDevices: boolean;
    redirectUrl?: string;
  };
}

// Token refresh message
export interface CrossDomainRefreshMessage extends CrossDomainMessage<{
  refreshToken: string;
}> {
  type: 'AUTH_REFRESH';
  payload: {
    refreshToken: string;
    sessionId: string;
    requestId: string;
  };
}

// Union type for all cross-domain messages
export type CrossDomainAuthMessage = 
  | CrossDomainTokenMessage
  | CrossDomainErrorMessage
  | CrossDomainSuccessMessage
  | CrossDomainLogoutMessage
  | CrossDomainRefreshMessage;

// === SECURE COMMUNICATION TYPES ===

export interface SecureCrossDomainMessage<T = any> {
  version: '1.0';
  messageId: string;
  timestamp: number;
  fromDomain: string;
  toDomain: string;
  messageType: string;
  payload: T;
  signature: string;
  nonce: string;
  expiresAt: number;
}

export interface MessageSignature {
  algorithm: 'HMAC-SHA256' | 'RSA-SHA256';
  value: string;
  keyId: string;
}

export interface CrossDomainKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  algorithm: string;
  createdAt: number;
  expiresAt: number;
}

// === TOKEN EXCHANGE TYPES ===

export interface TokenExchangeRequest {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  refreshToken?: string;
  redirectUri: string;
  clientId: string;
  codeVerifier?: string;
  state?: string;
}

export interface TokenExchangeResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
  idToken?: string;
}

export interface TokenIntrospectionRequest {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
}

export interface TokenIntrospectionResponse {
  active: boolean;
  scope?: string;
  clientId?: string;
  username?: string;
  tokenType?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string[];
  iss?: string;
  jti?: string;
}

// === SESSION SYNCHRONIZATION TYPES ===

export interface CrossDomainSession {
  sessionId: string;
  userId: string;
  domains: string[];
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
  securityLevel: 'low' | 'medium' | 'high';
  metadata: {
    userAgent: string;
    ipAddress: string;
    location?: {
      country: string;
      city: string;
    };
  };
}

export interface SessionSyncEvent {
  eventType: 'created' | 'updated' | 'destroyed' | 'expired';
  sessionId: string;
  userId: string;
  sourceDomain: string;
  targetDomains: string[];
  timestamp: number;
  data?: Record<string, any>;
}

export interface SessionSyncMessage extends CrossDomainMessage<SessionSyncEvent> {
  type: 'SESSION_SYNC';
  payload: SessionSyncEvent;
}

// === SECURITY & MONITORING TYPES ===

export interface CrossDomainSecurityEvent {
  eventId: string;
  eventType: 'suspicious_activity' | 'invalid_token' | 'unauthorized_domain' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceDomain: string;
  targetDomain: string;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  details: Record<string, any>;
  blocked: boolean;
}

export interface CrossDomainAuditLog {
  logId: string;
  action: string;
  userId?: string;
  sessionId?: string;
  sourceDomain: string;
  targetDomain?: string;
  success: boolean;
  error?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// === RATE LIMITING TYPES ===

export interface CrossDomainRateLimit {
  key: string; // Usually domain + IP or domain + user
  domain: string;
  requests: number;
  windowStart: number;
  windowMs: number;
  limit: number;
  blocked: boolean;
  blockedUntil?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (domain: string, ip: string, userId?: string) => string;
}

// === ERROR TYPES ===

export interface CrossDomainError extends AuthErrorDetails {
  domain: string;
  flowId?: string;
  securityEvent?: boolean;
  blocked?: boolean;
  retryAllowed?: boolean;
  retryAfter?: number;
}

// === API TYPES FOR CROSS-DOMAIN ENDPOINTS ===

export interface InitiateCrossDomainAuthRequest {
  targetDomain: string;
  returnUrl: string;
  state?: string;
  prompt?: 'none' | 'login' | 'consent';
  maxAge?: number;
}

export interface InitiateCrossDomainAuthResponse {
  success: boolean;
  authUrl?: string;
  flowId?: string;
  state?: string;
  expiresAt?: number;
  error?: CrossDomainError;
}

export interface CompleteCrossDomainAuthRequest {
  code: string;
  state: string;
  flowId: string;
}

export interface CompleteCrossDomainAuthResponse {
  success: boolean;
  token?: CrossDomainAuthToken;
  user?: UserProfile;
  redirectUrl?: string;
  error?: CrossDomainError;
}

export interface ValidateCrossDomainTokenRequest {
  token: string;
  domain: string;
}

export interface ValidateCrossDomainTokenResponse {
  valid: boolean;
  user?: UserProfile;
  expiresAt?: number;
  scopes?: string[];
  error?: CrossDomainError;
}

// === UTILITY TYPES ===

// Type guard for cross-domain messages
export type CrossDomainMessageType<T extends CrossDomainAuthMessage['type']> = 
  Extract<CrossDomainAuthMessage, { type: T }>;

// Helper type for extracting payload types
export type CrossDomainPayload<T extends CrossDomainAuthMessage> = T['payload'];

// Domain whitelist checker
export type DomainValidator = (domain: string) => boolean;

// Message handler type
export type CrossDomainMessageHandler<T extends CrossDomainAuthMessage = CrossDomainAuthMessage> = (
  message: T,
  origin: string
) => Promise<void> | void;

// === CONFIGURATION BUILDERS ===

export interface CrossDomainConfigBuilder {
  withAuthDomain(domain: string): CrossDomainConfigBuilder;
  withAppDomain(domain: string): CrossDomainConfigBuilder;
  withAllowedDomains(domains: string[]): CrossDomainConfigBuilder;
  withTokenExpiry(minutes: number): CrossDomainConfigBuilder;
  withSecurityLevel(level: 'low' | 'medium' | 'high'): CrossDomainConfigBuilder;
  build(): CrossDomainConfig;
}

// === DEVELOPMENT & TESTING TYPES ===

export interface CrossDomainTestScenario {
  name: string;
  description: string;
  setup: {
    sourceDomain: string;
    targetDomain: string;
    user?: Partial<UserProfile>;
    sessionExists?: boolean;
  };
  actions: Array<{
    type: 'navigate' | 'authenticate' | 'verify_token' | 'logout';
    data?: any;
  }>;
  expectedResult: {
    success: boolean;
    userAuthenticated: boolean;
    redirectUrl?: string;
    error?: string;
  };
}

export interface CrossDomainMockServer {
  domain: string;
  port: number;
  handlers: Map<string, CrossDomainMessageHandler>;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage<T extends CrossDomainAuthMessage>(message: T): Promise<void>;
}

// === EXPORT COLLECTIONS ===

export const CrossDomainTypes = {
  // Configuration types
  DomainConfig,
  CrossDomainConfig,
  
  // Flow types
  CrossDomainAuthFlow,
  CrossDomainAuthResult,
  
  // Message types
  CrossDomainTokenMessage,
  CrossDomainErrorMessage,
  CrossDomainSuccessMessage,
  CrossDomainLogoutMessage,
  CrossDomainRefreshMessage,
  
  // Security types
  SecureCrossDomainMessage,
  MessageSignature,
  CrossDomainKeyPair,
  
  // Session types
  CrossDomainSession,
  SessionSyncEvent,
  
  // Error types
  CrossDomainError,
  
  // Utility types
  CrossDomainMessageType,
  CrossDomainPayload,
  DomainValidator,
  CrossDomainMessageHandler,
} as const;

export default CrossDomainTypes;