/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cu, CC, Cc, Ci } = require("chrome");
var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require("sdk/panel");
var self = require("sdk/self");
var notifications = require("sdk/notifications");
var tabs = require('sdk/tabs');
const discovery = require("discovery");
//const discovery = require("devtools/toolkit/discovery/discovery");

const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

const PRESENTATION_SERVICE = "presentation";

var button = ToggleButton({
  id: "device-search-button",
  label: "Device List",
  icon: self.data.url("device-icon.png"),
  onChange: handleChange
});

var panel = panels.Panel({
  contentURL: self.data.url("device-list.html"),
  contentScriptFile: self.data.url("device-list.js"),
  onHide: handleHide,
  height: 70,
  width: 200,
});

var connectedDevice = {
  send: function(msg) {
    let str = JSON.stringify(msg);
    let rawData = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      rawData[i] = str.charCodeAt(i);
    }
    this._socket.send(this.host, this.port, rawData, rawData.length);
    console.log('socket send to ' + this.host + ':' + this.port + ' = ' + str);
  },
  connect: function(host, port) {
    if (!this._socket) {
      this._socket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket);
      this._socket.init(-1, false);
      this._socket.asyncListen({
        QueryInterface : XPCOMUtils.generateQI([Ci.nsIUDPSocketListener]),
        onPacketReceived : function(aSocket, aMessage){
          console.log('receive remote message: ' + aMessage.data);
          let msg = JSON.parse(aMessage.data);
          switch (msg.type) {
            case 'remote-action':
              handleRemoteAction(msg.action);
              break;
          }
        },
        onStopListening: function(aSocket, aStatus){}
      });
    }

    this.host = host;
    this.port = port;
    this.send({ type: 'connect' });
  },

  disconnect: function() {
    this.send({ type: 'disconnect' });
  }
};

function handleRemoteAction(action) {
  switch (action.type) {
    case "notification":
      notifications.notify({
        title: 'Remote Notification',
        text: action.msg,
        iconURL: self.data.url('incoming-call.png')
      });
      break;
  }
}

function handleChange (state) {
  if (state.checked) {
    panel.show({
      position: button
    });
    discovery.scan();
  }
}

function handleHide() {
  button.state('window', {checked: false});
}

function updateDevice() {
  var devices = [];
  for (let device of discovery.getRemoteDevicesWithService(PRESENTATION_SERVICE)) {
    let service = discovery.getRemoteService(PRESENTATION_SERVICE, device);
    console.log('found device ' + device + ' on ' + service.host + ':' + service.port);
    devices.push(device);
  }

  panel.port.emit("update-device", devices);
}

discovery.on("presentation-device-added", updateDevice);
discovery.on("presentation-device-updated", updateDevice);
discovery.on("presentation-device-removed", updateDevice);

panel.port.on('connect', function(device) {
  console.log('connect to ' + device);
  let service = discovery.getRemoteService(PRESENTATION_SERVICE, device);
  connectedDevice.connect(service.host, service.port);
});
panel.port.on('browse', function() {
  let url = tabs.activeTab.url;
  console.log('send browse command: ' + url);
  connectedDevice.send({
    type: 'remote-command',
    command: {
      type: 'browse',
      url: url
    }
  });
});
