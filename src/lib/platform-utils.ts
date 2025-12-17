export const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
export const isProduction = process.env.NODE_ENV === 'production';
export const isServer = typeof window === 'undefined';

export function checkNativeFeatureAvailability(featureName: string, checkFn: () => boolean): boolean {
  try {
    const isAvailable = checkFn();
    if (isAvailable) {
      console.log(`Funcionalidade nativa '${featureName}' está disponível`);
    } else {
      console.warn(`Funcionalidade nativa '${featureName}' não está disponível`);
    }
    return isAvailable;
  } catch (error) {
    console.warn(`Erro ao verificar disponibilidade de '${featureName}':`, error);
    return false;
  }
}

export const platformInfo = {
  platform: typeof process !== 'undefined' ? process.platform : 'browser',
  arch: typeof process !== 'undefined' ? process.arch : 'unknown',
  nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
  isWindows,
  isProduction,
  isServer
};

export default {
  isWindows,
  isProduction,
  isServer,
  checkNativeFeatureAvailability,
  platformInfo
};