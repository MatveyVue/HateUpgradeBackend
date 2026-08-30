const axios = require('axios');
const { Address } = require('@ton/ton');

function tonApiHeaders() {
  const headers = {};


  return headers;
}

function toRawAddress(address) {
  return Address.parse(address).toString();
}

async function getAccountEvents(address, limit = 50) {
  const base = process.env.TONAPI_BASE_URL || 'https://tonapi.io/v2';
  const rawAddress = toRawAddress(address);

  const url = `${base}/accounts/${rawAddress}/events`;

  const res = await axios.get(url, {
    headers: tonApiHeaders(),
    params: { limit },
    timeout: 15000
  });

  return res.data && Array.isArray(res.data.events)
    ? res.data.events
    : [];
}

function normalizeAddress(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (value.address) {
    return value.address;
  }

  return '';
}

function extractJettonTransfers(events) {
  const transfers = [];

  for (const event of events) {
    const actions = Array.isArray(event.actions) ? event.actions : [];

    for (const action of actions) {
      const type = action.type || '';

      if (!String(type).toLowerCase().includes('jetton')) {
        continue;
      }

      const data =
        action.JettonTransfer ||
        action.jetton_transfer ||
        action.jettonTransfer ||
        action;

      const amount = data.amount || data.value;

      const comment =
        data.comment ||
        data.payload ||
        data.message ||
        '';

      const sender = normalizeAddress(data.sender);
      const recipient = normalizeAddress(data.recipient);

      const jetton =
        normalizeAddress(data.jetton) ||
        normalizeAddress(data.jetton_master) ||
        normalizeAddress(data.asset);

      if (!amount || !comment) {
        continue;
      }

      transfers.push({
        event_id: event.event_id || event.id || null,
        tx_hash: event.event_id || event.id || event.trace_id || null,
        lt: event.lt || null,
        amount: String(amount),
        comment: String(comment),
        sender,
        recipient,
        jetton
      });
    }
  }

  return transfers;
}

module.exports = {
  getAccountEvents,
  extractJettonTransfers
};
