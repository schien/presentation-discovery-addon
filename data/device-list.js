var listDiv = document.getElementById('device-list');
var connectBtn = document.getElementById('connect-btn');

self.port.on('update-device', function updateDeviceList(devices) {
  while (listDiv.firstChild) {
    listDiv.removeChild(listDiv.firstChild);
  }

  for (var device of devices)  {
    var option = document.createElement('option');
    option.value = JSON.stringify(device);
    option.textContent = device.name;
    listDiv.appendChild(option);
  }
});

connectBtn.addEventListener('click', function connectToDevice() {
  self.port.emit('SelectDevice:Return', JSON.parse(listDiv.selectedOptions[0].value));
});
