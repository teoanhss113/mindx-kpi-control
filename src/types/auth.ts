// Firebase Identity Toolkit response
export interface FirebaseSignInResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string; // seconds as string
  localId: string;   // Firebase UID
  displayName: string;
  email: string;
  registered: boolean;
}

// Stored session in localStorage / context
export interface AuthSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number;  // timestamp ms
  uid: string;
  displayName: string;
  email: string;
  provider?: 'supabase' | 'firebase'; // Auth provider
  // Role removed - no longer using Supabase permissions
}
