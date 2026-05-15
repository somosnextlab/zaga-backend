export type ZagaAdminRole = 'CEO' | 'STAFF' | 'READ_ONLY';

export type ZagaAdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: ZagaAdminRole;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
};

export type ZagaAuthMeUser = {
  id: string;
  email: string;
  fullName: string;
  role: ZagaAdminRole;
};

export type ZagaLoginOkResponse = {
  ok: true;
  sessionToken: string;
  expiresAt: string;
  user: ZagaAuthMeUser;
};
