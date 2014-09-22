/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require('sdk/panel');
var self = require('sdk/self');
var tabs = require('sdk/tabs');
var tmr = require('sdk/timers');

var pageMod = require('sdk/page-mod');
const server = require('presentation-server.js');

var button = ToggleButton({
  id: 'device-search-button',
  label: 'Device List',
  icon: self.data.url('device-icon.png'),
  onChange: handleChange
});

function handleChange (state) {
  if (state.checked) {
    panel.show({
      position: button
    });
  }
}

// door hang for device selection
var panel = panels.Panel({
  contentURL: self.data.url('device-list.html'),
  contentScriptFile: self.data.url('device-list.js'),
  onHide: handleHide,
  height: 70,
  width: 200,
});

function handleHide() {
  button.state('window', {checked: false});
}

// mapping channel to device
let channelMap = {};
let available = false;
let timeout = null;

// provide expose discvered device to content
var presentationDiscoveryMod = pageMod.PageMod({
  include: '*',
  contentScriptFile: self.data.url('presentation-primary.js'),
  onAttach: function(worker) {
    //primary
    worker.port.on('requestSession', function({url, offer}) {
      //provide port of remote control channel
      button.click();
      panel.port.once('SelectDevice:Return', function(device) {
        panel.hide();
        console.log('connect to ' + JSON.stringify(device));

        server.requestSession(device, url, offer);
        server.once('requestSession:Answer', function(answer) {
          channelMap[answer] = device;
          worker.port.emit('requestSession:Return', answer);
        });
      });
    });

    //XXX
    worker.port.on('peekDevice', function() {
      worker.port.emit('device-available', available);
    });

    worker.port.on('sessionSend', function({channelId, message}) {
      let device = channelMap[channelId];
      if (!device) {
        console.log('sessionSend fail: unknown channelId');
        return;
      }
      server.sessionSend(device, channelId, message);
    });

    server.on('ondata', function(msg) {
      worker.port.emit('ondata', msg);
    });

    worker.port.on('sessionClose', function({localId, remoteId}) {
      let device = channelMap[remoteId];
      if (!device) {
        console.log('sessionClose fail: unknown channelId');
        return;
      }
      server.sessionClose(device, localId);
      delete channelMap[remoteId];
    });

    server.on('sessionClose', function(channelId) {
      worker.port.emit('sessionClose', channelId);
    });
  },
});


function updateDevice(devices) {
  console.log('update-device');
  available = (devices.length > 0);
  panel.port.emit('update-device', devices);
}

function onSessionClose(channelId) {
  let device = channelMap[channelId];
  if (!device) {
    console.log('remote sessionClose fail: unknown channelId');
    return;
  }
  delete channelMap[channelId];
}

function onRequestSession({device, url, offer}) {
  tabs.open({
    url: url,
    onReady: function(tab) {
      console.log(url + ' is opened');
      let worker = tab.attach({
        contentScriptFile: self.data.url('presentation-secondary.js'),
      });
      worker.port.emit('requestSession', offer);
      worker.port.once('responseSession', function(answer) {
        channelMap[offer] = device;
        server.responseSession(device, answer);
      });
    },
  });
}

exports.main = function(options, callbacks) {
  server.on('update-device', updateDevice);

  server.on('sessionClose', onSessionClose);

  //secondary
  server.on('requestSession', onRequestSession);

  timeout = tmr.setInterval(function() {
    server.scanForDevices();
  }, 10000);
};

exports.onUnload = function(reason) {
  if (timeout) {
    tmr.clearInterval(timeout)
    timeout = null;
  }
  server.off('update-device', updateDevice);

  server.off('sessionClose', onSessionClose);

  //secondary
  server.off('requestSession', onRequestSession);
  server.deinit();
};

