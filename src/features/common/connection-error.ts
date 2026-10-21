import type { TFunction } from 'i18next';

const ERROR_KEYS: Record<string, string> = {
  unauthorized: 'errors.unauthorized',
  expired: 'errors.tokenExpired',
  device_deactivated: 'errors.deviceDeactivated',
  not_connected: 'errors.notConnected',
  close_4001: 'errors.unauthorized',
  close_4003: 'errors.forbidden',
  close_4004: 'errors.deviceGone',
  close_4005: 'errors.tokenRevoked',
};

/** Maps raw connection error codes from the manager to i18n strings. */
export function connectionError(t: TFunction, error: string | null): string | null {
  if (!error) return null;
  const key = ERROR_KEYS[error];
  return key ? t(key) : t('common.error');
}
