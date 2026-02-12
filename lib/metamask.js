const METAMASK_DOWNLOAD_URL = "https://metamask.io/download/";
const MOBILE_USER_AGENT_REGEX = /android|iphone|ipad|ipod|mobile/i;

export function hasInjectedEthereumProvider() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const isTouchMac =
    /Macintosh/i.test(userAgent) && Number(navigator.maxTouchPoints) > 1;
  return MOBILE_USER_AGENT_REGEX.test(userAgent) || isTouchMac;
}

export function getMetaMaskDeepLinkForCurrentPage() {
  if (typeof window === "undefined") return METAMASK_DOWNLOAD_URL;
  const { host, pathname, search, hash } = window.location;
  const dappPath = `${host}${pathname}${search}${hash}`;
  return `https://metamask.app.link/dapp/${encodeURI(dappPath)}`;
}

export function openMetaMaskForCurrentDevice() {
  if (typeof window === "undefined") return METAMASK_DOWNLOAD_URL;
  if (isLikelyMobileDevice()) {
    const deepLink = getMetaMaskDeepLinkForCurrentPage();
    window.location.href = deepLink;
    return deepLink;
  }
  window.open(METAMASK_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  return METAMASK_DOWNLOAD_URL;
}

export function getMissingMetaMaskMessage({ opening = false } = {}) {
  if (isLikelyMobileDevice()) {
    if (opening) {
      return "MetaMask not detected. Opening MetaMask app...";
    }
    return "MetaMask not detected. Open this page in the MetaMask app to continue.";
  }
  return "MetaMask not detected. Install the MetaMask extension to continue.";
}
