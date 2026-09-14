const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = process.env.DATAMART_BASE_URL || "https://api.datamartgh.shop/api";
const API_KEY = process.env.DATAMART_API_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Network name -> DataMartGH network code, matches their docs exactly.
const NETWORK_CODES = {
  MTN: "YELLO",
  TELECEL: "TELECEL",
  AIRTELTIGO: "AT_PREMIUM",
};

/** Fetch live bundle list + prices for a network. */
async function getDataPackages(networkCode) {
  const res = await client.get("/data-packages", {
    headers: { "X-API-Key": API_KEY },
    params: { network: networkCode },
  });
  return res.data;
}

/** Verify a recipient number is valid/active before purchase (optional step). */
async function verifyNumber(phoneNumber, networkCode) {
  const res = await client.post(
    "/verify-number",
    { phoneNumber, network: networkCode },
    { headers: { "X-API-Key": API_KEY } }
  );
  return res.data;
}

/**
 * Place a real data bundle purchase.
 * idempotencyKey prevents double-charging if a request is retried
 * (e.g. bot restarts mid-request) — always pass a stable, unique value
 * per order attempt.
 */
async function purchaseBundle({ phoneNumber, networkCode, capacityGB, idempotencyKey }) {
  const key = idempotencyKey || crypto.randomUUID();
  const res = await client.post(
    "/purchase",
    {
      phoneNumber,
      network: networkCode,
      capacity: capacityGB,
      gateway: "wallet", // funds already deducted from Priceless Bundle wallet, not paid live here
    },
    {
      headers: {
        "X-API-Key": API_KEY,
        "X-Idempotency-Key": key,
      },
    }
  );
  return res.data; // expect a reference/order id back
}

async function getOrderStatus(reference) {
  const res = await client.get(`/order-status/${encodeURIComponent(reference)}`, {
    headers: { "X-API-Key": API_KEY },
  });
  return res.data;
}

module.exports = {
  NETWORK_CODES,
  getDataPackages,
  verifyNumber,
  purchaseBundle,
  getOrderStatus,
};
