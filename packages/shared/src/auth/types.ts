export type ApsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type StoredAccSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope?: string;
  tokenType?: string;
};

export type AuthStatus = {
  loggedIn: boolean;
  expiresAt?: number;
  scope?: string;
};

export type StartLoginResult = {
  // para no romper tools viejas:
  url: string;
  // para que tu tool destructuree bonito:
  authorizationUrl: string;

  state: string;
  scope: string;
  redirectUri: string;

  // texto de ayuda para el usuario
  instructions: string;
  note: string;
};