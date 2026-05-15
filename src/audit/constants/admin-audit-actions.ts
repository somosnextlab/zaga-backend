export const AdminAuditAction = {
  ADMIN_LOGIN_SUCCESS: 'ADMIN_LOGIN_SUCCESS',
  ADMIN_LOGIN_FAILED: 'ADMIN_LOGIN_FAILED',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  ADMIN_SESSION_REVOKED: 'ADMIN_SESSION_REVOKED',
} as const;

export type AdminAuditActionValue =
  (typeof AdminAuditAction)[keyof typeof AdminAuditAction];
