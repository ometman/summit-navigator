import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export interface AdminFirestoreResult {
  db: Firestore | null;
  credentialSource: 'service_account_json' | 'adc' | 'unavailable';
  error?: string;
}

const ADMIN_APP_NAME = 'summit-navigator-admin-cron';

function getOrInitAdminApp(): {
  app: App | null;
  credentialSource: 'service_account_json' | 'adc' | 'unavailable';
  error?: string;
} {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existing) {
    return {
      app: existing,
      credentialSource: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? 'service_account_json'
        : 'adc',
    };
  }

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson) as ServiceAccount;
      const app = initializeApp(
        {
          credential: cert(parsed),
          projectId: parsed.projectId || firebaseConfig.projectId,
        },
        ADMIN_APP_NAME
      );
      return { app, credentialSource: 'service_account_json' };
    } catch (err) {
      return {
        app: null,
        credentialSource: 'unavailable',
        error:
          err instanceof Error
            ? `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`
            : 'Invalid FIREBASE_SERVICE_ACCOUNT_JSON.',
      };
    }
  }

  try {
    const app = initializeApp(
      {
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      },
      ADMIN_APP_NAME
    );
    return { app, credentialSource: 'adc' };
  } catch (err) {
    try {
      const fallback = getApp(ADMIN_APP_NAME);
      return { app: fallback, credentialSource: 'adc' };
    } catch {
      return {
        app: null,
        credentialSource: 'unavailable',
        error:
          err instanceof Error
            ? err.message
            : 'Application Default Credentials unavailable.',
      };
    }
  }
}

export function getAdminFirestore(): AdminFirestoreResult {
  const { app, credentialSource, error } = getOrInitAdminApp();
  if (!app) {
    return { db: null, credentialSource: 'unavailable', error };
  }

  try {
    const db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    return { db, credentialSource };
  } catch (err) {
    return {
      db: null,
      credentialSource: 'unavailable',
      error:
        err instanceof Error
          ? err.message
          : 'Failed to connect Admin Firestore.',
    };
  }
}
