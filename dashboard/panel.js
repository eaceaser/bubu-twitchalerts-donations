var $panel = $bundle.filter('.twitchalerts-donations')
var latestDonation = nodecg.Replicant("latestDonation");

latestDonation.on('change', function (old, newVal) {
  var element = $panel.find('#latest-donation');
  if (newVal) {
    var pp = newVal.name + ": " + newVal.message;
    element.text(pp);
  } else {
    element.text("None.");
  }
});
