'use strict';

const config = require('./config');
const publicIp = require('public-ip');
const cloudflare = require('cloudflare')(config.cloudflare);

const getZone = async () => {
  let zones = await cloudflare.zones.browse();
  return zones.result.find((z) => z.name === config.cloudflare.domain);
};

const getADnsRecord = async (zoneId) => {
  let dnsRecords = await cloudflare.dnsRecords.browse(zoneId);
  return dnsRecords.result.find((record) => {
    return record.type === 'A' && record.name === config.cloudflare.domain;
  });
};

const updateDns = async (zoneId, dnsRecordId, ipv4) => {
  let dnsData = {
    type: 'A',
    name: config.cloudflare.domain,
    content: ipv4,
    proxied: true
  };

  await cloudflare.dnsRecords.edit(zoneId, dnsRecordId, dnsData);

  console.log(`IP address updated to ${ipv4}`);
};

const checkAndUpdate = async () => {
  try {
    let ipv4 = await publicIp.v4();

    if (!ipv4) {
      console.log('Public IP not found');
      return;
    }

    let zone = await getZone();
    let dnsRecord = await getADnsRecord(zone.id);

    if (ipv4 === dnsRecord.content) {
      return;
    }

    await updateDns(zone.id, dnsRecords.id, ipv4);

  } catch (err) {
    console.error(err);
  }
};

const getInterval = async () => {
  let p = new Promise((resolve) => {
    setTimeout(resolve, config.interval * 1000);
  });

  return p;
}

const startChecking = async () => {
  while (true) {
    try {
      await checkAndUpdate();
    } catch (err) {
      console.error(err);
    }

    await getInterval();
  }
};

startChecking();
