/* Device Discovery adapter */
// secondary screen
//  1. window.addEventListener('message', function(evt) {
//       var answer = ...  /* generate from evt.data.offer */
//       navigator.responseSession(answer);
//     }
function responseSession(answer) {
  self.port.emit('responseSession', answer);
}

self.port.on('requestSession', function(offer) {
  var msg = {
    type: 'requestSession',
    offer: offer,
  };
  window.postMessage(msg, '*');
});

exportFunction(responseSession, unsafeWindow.navigator, {defineAs: "responseSession"});

//XXX
function createAnswer() {
  return Date.now();
}

exportFunction(createAnswer, unsafeWindow.navigator, {defineAs: "createAnswer"});
