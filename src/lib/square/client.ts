import { SquareClient, SquareEnvironment } from "square";

// Same test/live pattern used for Dropbox Sign: everything stays pointed
// at Square's sandbox until you deliberately set SQUARE_MODE=live.
function isLiveMode() {
  return process.env.SQUARE_MODE === "live";
}

export function createSquareClient() {
  const token = isLiveMode()
    ? process.env.SQUARE_PRODUCTION_ACCESS_TOKEN
    : process.env.SQUARE_SANDBOX_ACCESS_TOKEN;

  return new SquareClient({
    token: token!,
    environment: isLiveMode() ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
}

export function getSquareLocationId() {
  return (
    isLiveMode()
      ? process.env.SQUARE_PRODUCTION_LOCATION_ID
      : process.env.SQUARE_SANDBOX_LOCATION_ID
  )!;
}

export function getSquareSignatureKey() {
  return (
    isLiveMode()
      ? process.env.SQUARE_PRODUCTION_SIGNATURE_KEY
      : process.env.SQUARE_SANDBOX_SIGNATURE_KEY
  )!;
}
