import { PublicClientApplication, LogLevel } from '@azure/msal-browser'

/**
 * MSAL configuration.
 * clientId and tenantId are fetched at runtime from GET /api/users/auth-config
 * and injected via initMsal() before use.
 */

let _msalInstance = null

export async function initMsal(clientId, tenantId) {
  if (_msalInstance) return _msalInstance

  const msalConfig = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin + '/login'
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return
          if (level === LogLevel.Error) console.error('[MSAL]', message)
        },
        logLevel: LogLevel.Warning
      }
    }
  }

  _msalInstance = new PublicClientApplication(msalConfig)
  await _msalInstance.initialize()
  return _msalInstance
}

export function getMsalInstance() {
  return _msalInstance
}

export const AZURE_AD_SCOPES = ['openid', 'profile', 'email']
