/* Device Discovery adapter */
// primary screen:
//  1. navigator.requestSession(offer);
//  2. window.addEventListener('message', function(evt) { /* handle evt.data.answer */ });
function requestSession(url, offer) {
  self.port.emit('requestSession', {url: url, offer: offer});

  self.port.once('requestSession:Return', function(answer) {
    let msg = {
      type: 'requestSession:Return',
      answer: answer,
    };
    window.postMessage(msg, '*');
  });
}

exportFunction(requestSession, unsafeWindow.navigator, {defineAs: "requestSession"});

//XXX
function peekDevice() {
  self.port.emit('peekDevice');
}

self.port.on('device-available', function(available) {
  let msg = {
    type: 'device-available',
    available: available,
  };
  window.postMessage(msg, '*');
});

function createOffer() {
  return Date.now();
}

function sessionSend(channelId, message) {
  self.port.emit('sessionSend', {channelId: channelId, message: message});
}

self.port.on('ondata', function(msg) {
  window.postMessage(msg, '*');
});

exportFunction(peekDevice, unsafeWindow.navigator, {defineAs: "peekDevice"});
exportFunction(createOffer, unsafeWindow.navigator, {defineAs: "createOffer"});
exportFunction(sessionSend, unsafeWindow.navigator, {defineAs: "sessionSend"});
