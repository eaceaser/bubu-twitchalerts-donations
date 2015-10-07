'use strict';

var events = require('events');
var util = require('util');
var JSONStorage = require('node-localstorage').JSONStorage;
var storage = new JSONStorage('./db/bubu-twitchalerts-donations');

const DEFAULT_POLL_INTERVAL = 60*1000;
const LATEST_DONATION_KEY = 'latestDonation';

var TwitchAlertsDonations = function(nodecg) {
  this.nodecg = nodecg;
  this.config = nodecg.bundleConfig;

  this.pollInterval = DEFAULT_POLL_INTERVAL;
  this.latestDonationReplicant = nodecg.Replicant('latestDonation', { defaultValue: null, persistent: false});

  if (Object.keys(this.config).length) {
    if (this.config.pollInterval) {
      this.pollInterval = this.config.pollInterval;
    }
  }

  if (!nodecg.extensions.hasOwnProperty('bubu-twitchalerts')) {
    throw new Error('bubu-twitchalerts must be installed and configured.');
  }

  this.twitchalerts = nodecg.extensions['bubu-twitchalerts'];
  this.latestDonation = storage.getItem(LATEST_DONATION_KEY);

  if (this.latestDonation) {
    this.latestDonationReplicant.value = this.latestDonation;
  }

  nodecg.log.info('Starting to poll for TwitchAlerts donations.');
  this._scheduleDonationsRead();

  events.EventEmitter.call(this);
};

util.inherits(TwitchAlertsDonations, events.EventEmitter);

TwitchAlertsDonations.prototype._scheduleDonationsRead = function() {
  var opts = {};
  if (this.latestDonation) {
    opts.after = this.latestDonation.id;
    this.nodecg.log.debug('Getting donations since id '+this.latestDonation.id);
  } else {
    this.nodecg.log.debug('Getting latest donation.');
    opts.limit = 1;
  }

  this.twitchalerts.getDonations(opts, (err, body) => {
    if (err) {
      this.nodecg.log.error('Unable to poll for TwitchAlerts donations: '+err);
      setTimeout(() => { this._scheduleDonationsRead(); }, this.pollInterval);
      return;
    }

    if (!body.data) {
      this.nodecg.log.error('Invalid format for TwitchAlerts donation response');
      setTimeout(() => { this._scheduleDonationsRead(); }, this.pollInterval);
      return;
    }

    if (body.data.length == 0) {
      this.nodecg.log.debug('No new donations found.');
      setTimeout(() => { this._scheduleDonationsRead(); }, this.pollInterval);
      return;
    }

    var latest = body.data[0];
    var donation = {
      id: latest.donation_id,
      name: latest.name,
      message: latest.message,
      amount: parseFloat(latest.amount).toFixed(2)
    };

    this.latestDonation = donation;
    this.latestDonationReplicant.value = donation;

    this.emit('donation', donation);
    this.nodecg.sendMessage('donation', donation);

    storage.setItem(LATEST_DONATION_KEY, donation);
    setTimeout(() => { this._scheduleDonationsRead(); } , this.pollInterval);
  });
};

module.exports = function(api) { return new TwitchAlertsDonations(api); };
