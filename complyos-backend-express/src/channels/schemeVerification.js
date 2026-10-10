export function isOfficialSchemeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === 'gov.in'
      || hostname.endsWith('.gov.in')
      || hostname === 'nic.in'
      || hostname.endsWith('.nic.in')
      || hostname === 'odopup.in'
      || hostname.endsWith('.odopup.in');
  } catch {
    return false;
  }
}

export function hasSchemeVerificationMetadata(scheme) {
  const sourceUrl = String(scheme?.sourceUrl || '').trim();
  const checkedBy = String(scheme?.checkedBy || '').trim();
  return Boolean(
    sourceUrl
      && checkedBy
      && !/TODO\s*\(\s*owner\s*\)/i.test(sourceUrl)
      && !/TODO\s*\(\s*owner\s*\)/i.test(checkedBy),
  );
}

export function isVerifiedScheme(scheme) {
  return hasSchemeVerificationMetadata(scheme) && isOfficialSchemeSourceUrl(scheme.sourceUrl);
}

export default { hasSchemeVerificationMetadata, isOfficialSchemeSourceUrl, isVerifiedScheme };
