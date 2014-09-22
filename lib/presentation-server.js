/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cu, CC, Cc, Ci } = require("chrome");
const { emit, on, once, off } = require("sdk/event/core");
const discovery = require("discovery");

const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

const PRESENTATION_SERVICE = "presentation";

XPCOMUtils.defineLazyGetter(this, "converter", () => {
  let conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
             createInstance(Ci.nsIScriptableUnicodeConverter);
  conv.charset = "utf8";
  return conv;
});

let logging = true;
function log(msg) {
  if (logging) {
    console.log("Presentation Server: " + msg);
  }
}

function Device(name, ip, port) {
  this.name = name;
  this.ip = ip;
  this.port = port;
}

function SignalingChannel() {
  this._socket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket);
  this._socket.init(-1, false);
  this._socket.asyncListen(this);
}

SignalingChannel.prototype = {
  onmessage: null,

  //nsIUDPSocketListener
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIUDPSocketListener]),

  onPacketReceived : function(aSocket, aMessage){
    console.log('receive remote message: ' + aMessage.data);
    let device = new Device('remote', aMessage.fromAddr.address, aMessage.fromAddr.port);
    let rawData = [];
    for (let i = 0; i < aMessage.rawData.length; i++) {
      rawData[i] = aMessage.rawData[i];
    }
    let msg = JSON.parse(converter.convertFromByteArray(rawData, rawData.length));
    if (this.onmessage) {
      this.onmessage(device, msg);
    }
  },

  onStopListening: function(aSocket, aStatus){
    this.onmessage = null;
  },

  send: function(device, msg) {
    log("Send to " + JSON.stringify(device) + ": " + JSON.stringify(msg, null, 2));

    let message = JSON.stringify(msg);
    let rawMessage = converter.convertToByteArray(message);
    try {
      this._socket.send(device.ip, device.port, rawMessage, rawMessage.length);
    } catch(e) {
      log("Failed to send message: " + e);
    }
  },

  close: function() {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
  },

  get port() {
    return this._socket.port;
  },
};

function PresentationServer() {
  this.on = on.bind(null, this);
  this.off = off.bind(null, this);
  this.once = once.bind(null, this);
  this.init();
}

/*
|Scan|
            scanForDevices() -> discovery.scan()
emit(update-device| devices) <- emit(presentation-device-added|updated|removed)

|requestSession|
          requestSession(offer)      ->     send(reqeustSession{offer})    ==> emit(requestSession, offer)
emit(requestSession:Answer, answer) <== send(requestSession:Answer{answer}) <- responseSession(answer)
 */
PresentationServer.prototype = {
  _waitForResponse: [],

  init: function() {
    this._channel = new SignalingChannel();
    this._channel.onmessage = this._handleMessage.bind(this);
    discovery.addService(PRESENTATION_SERVICE, { port: this._channel.port });
    discovery.on("presentation-device-added", this._updateDevice.bind(this));
    discovery.on("presentation-device-updated", this._updateDevice.bind(this));
    discovery.on("presentation-device-removed", this._updateDevice.bind(this));
  },

  deinit: function() {
    if (this._channel) {
      this._channel.close();
    }
    discovery.removeService(PRESENTATION_SERVICE);
  },

  scanForDevices: function() {
    discovery.scan();
  },

  requestSession: function(device, url, offer) {
    log('requestSession to ' + JSON.stringify(device) + ': ' + url + ', ' + JSON.stringify(offer));
    let msg = {
      type: 'requestSession',
      url: url,
      offer: offer,
    };
    this._channel.send(device, msg);
    this._waitForResponse.push(device);
  },

  responseSession: function(device, answer) {
    log('response to ' + JSON.stringify(device) + ': ' + JSON.stringify(answer));
    let msg = {
      type: 'requestSession:Answer',
      answer: answer,
    };
    this._channel.send(device, msg);
  },

  _updateDevice: function() {
    var devices = [];
    for (let device of discovery.getRemoteDevicesWithService(PRESENTATION_SERVICE)) {
      let service = discovery.getRemoteService(PRESENTATION_SERVICE, device);
      log('found device ' + device + ' on ' + service.host + ':' + service.port);
      devices.push(new Device(device, service.host, service.port));
    }

    emit(this, "update-device", devices);
  },

  _handleMessage: function(device, msg) {
    log('handleMessage from ' + JSON.stringify(device) + ': ' + JSON.stringify(msg));
    switch (msg.type) {
      case 'requestSession':
        emit(this, 'requestSession', {
          device: device,
          url: msg.url,
          offer: msg.offer,
        });
        break;
      case 'requestSession:Answer':
        // TODO match with waiting list, probably need a requestId
        this._waitForResponse.shift();
        emit(this, 'requestSession:Answer', msg.answer);
        break;
      case 'ondata':
        emit(this, 'ondata', msg);
        break;
      case 'sessionClose':
        emit(this, 'sessionClose', msg.channelId);
        break;
    }
  },

  sessionSend: function(device, channelId, message) {
    log('sessionSend to ' + JSON.stringify(device) + ': ' + JSON.stringify(message));
    let msg = {
      type: 'ondata',
      channelId: channelId,
      message: message,
    };
    this._channel.send(device, msg);
  },

  sessionClose: function(device, channelId) {
    log('sessionClose to ' + JSON.stringify(device) + ': ' + JSON.stringify(channelId));
    let msg = {
      type: 'sessionClose',
      channelId: channelId,
    };
    this._channel.send(device, msg);
  },
};

let presentationServer = new PresentationServer();
module.exports = presentationServer;
