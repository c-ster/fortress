export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  iterations: number;
  schemaVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface UserProfile {
  id: string;
  email: string;
  milEmail: string | null;
  milVerified: boolean;
  mfaEnabled: boolean;
  payGrade: string | null;
  createdAt: string;
}
