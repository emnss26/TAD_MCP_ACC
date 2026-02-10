export type AccTokens = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;     // seconds
  scope?: string;
  obtained_at: number;    // epoch ms
};

export type AccAuthStatus = {
  loggedIn: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;     // epoch ms
  scope?: string;
  projectId?: string;
};