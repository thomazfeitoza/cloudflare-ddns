'use strict';

const appPackage = require('./package');
const config = require('./config');
const publicIp = require('public-ip');
const cloudflare = require('cloudflare')(config.cloudflare);
const bunyan = require('bunyan');

const log = bunyan.createLogger({
  name: appPackage.name,
  version: appPackage.version,
  level: config.logLevel,
  stream: process.stdout
});

let lastIpv4 = '';

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
  lastIpv4 = ipv4;

  log.info(`DNS A record with key ${config.cloudflare.domain} is now pointing to ${ipv4}`);
};

const checkAndUpdate = async () => {
  let ipv4 = await publicIp.v4();

  if (!ipv4) {
    log.warn('Public ipv4 not found');
    return;
  }

  if (ipv4 === lastIpv4) {
    log.trace('Public ipv4 unchanged');
    return;
  }

  let zone = await getZone();

  if (!zone) {
    log.warn('Cloudflare zone not found');
  }

  let dnsRecord = await getADnsRecord(zone.id);

  if (!dnsRecord) {
    log.warn('DNS A record not found');
  }

  if (ipv4 === dnsRecord.content) {
    log.trace('DNS record does not need to be updated');
    lastIpv4 = ipv4;
    return;
  }

  await updateDns(zone.id, dnsRecord.id, ipv4);
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
      log.error(err, 'Unhandled error');
    }

    await getInterval();
  }
};

startChecking();
