var listDiv = document.getElementById("device-list");
var connectBtn = document.getElementById("connect-btn");
var remoteDisplayBtn = document.getElementById("remote-display-btn");

self.port.on("update-device", function updateDeviceList(devices) {
  while (listDiv.firstChild) {
    listDiv.removeChild(listDiv.firstChild);
  }

  for (var device of devices)  {
    var option = document.createElement("option");
    option.value = device;
    option.textContent = device;
    listDiv.appendChild(option);
  }
});

connectBtn.addEventListener("click", function connectToDevice() {
  self.port.emit('connect', listDiv.selectedOptions[0].value);
});

remoteDisplayBtn.addEventListener("click", function dispalyOnDevice() {
  self.port.emit('browse');
});
