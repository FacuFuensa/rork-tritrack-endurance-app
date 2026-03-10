export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.includes('integrations') || path.includes('account') || path.includes('auth')) {
    console.log('[NativeIntent] Passing through deep link:', path);
    return path;
  }
  if (initial) {
    return '/';
  }
  return path;
}
