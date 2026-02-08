export type ApsTokenResponse = {
  access_token: string;
  token_type: "Bearer" | string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};