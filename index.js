var devices = {};
var characteristics = {};

let serviceUuid = "bf88b656-0000-4a61-86e0-69840a842c4f";
let statusUuid = "bf88b656-0001-4a61-86e0-69840a842c4f";
let startUuid = "bf88b656-0002-4a61-86e0-69840a842c4f";
let stopUuid = "bf88b656-0005-4a61-86e0-69840a842c4f";
let filenameUuid = "bf88b656-0003-4a61-86e0-69840a842c4f";
let rtcTimeUuid = "bf88b656-0004-4a61-86e0-69840a842c4f";

function setupStatusChar(service, id) {
    return service.getCharacteristic(statusUuid).then(characteristic => {
        characteristic.readValue().then(dv => {
            setStatusIndicator(dv, id);
        });
        return characteristic.startNotifications().then(_ => {
            console.log('Status setup!');
            characteristic.addEventListener('characteristicvaluechanged',
                (event) => handleNotifications(event, id));
        });
    })
}

function setupStartChar(service, id) {
    return service.getCharacteristic(startUuid).then(characteristic => {
        characteristics[id][startUuid] = characteristic;
        console.log('Start setup!');
    });
}

function setupStopChar(service, id) {
    return service.getCharacteristic(stopUuid).then(characteristic => {
        characteristics[id][stopUuid] = characteristic;
        console.log('Stop setup!');
    });
}

function setupFilenameChar(service, id) {
    return service.getCharacteristic(filenameUuid).then(characteristic => {
        characteristics[id][filenameUuid] = characteristic;
        console.log('Filename setup!');
    });
}
function setupTimeChar(service, id) {
    return service.getCharacteristic(rtcTimeUuid).then(characteristic => {
        let timeBuf = new Uint32Array(1);
        timeBuf[0] = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).getTime() / 1000 | 0;
        characteristic.writeValue(timeBuf);
    });
}

function onConnectClick(id) {


    console.log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice({filters: [{services: [serviceUuid]}]})
        .then(device => {
            console.log('Connecting to GATT Server...');
            document.getElementById('status-' + id).value = "Connecting...";
            device.addEventListener('gattserverdisconnected', () => onDisconnected(id));
            devices[id] = device;
            return device.gatt.connect();
        })
        .then(server => {
            console.log('Getting Service...');
            return server.getPrimaryService(serviceUuid);
        })
        .then(service => {
            console.log('Getting Characteristic...');
            characteristics[id] = {};

            return Promise.all([setupStatusChar(service, id), setupStartChar(service, id), setupStopChar(service, id), setupFilenameChar(service, id), setupTimeChar(service, id)]);
        })
        .catch(error => {
            console.log('Argh! ' + error);
        });
}

const delayedCommandDuration = 100;

async function onStartRecordClick() {
    // for (const id of requiredPaired) {
    //     if (!devices[id] || !devices[id].gatt.connected) {
    //         console.log(`cannot start recording, ${id} not connected`);
    //         return;
    //     }
    // }
    let date = new Date();
    let dateString = date.toLocaleString()
        .replaceAll(", ", "-")
        .replaceAll(" ", "-")
        .replaceAll("/", "-")
        .replaceAll(":", "-");
    let prefix = document.getElementById("filename").value;
    if (prefix === "") prefix = "dataLog";
    let filename = prefix + "-" + dateString;
    const blob = new Blob([filename], {type: 'text/plain; charset=utf-8'});
    blob.arrayBuffer().then(async buffer => {
        console.log("Filename: " + filename)
        for (const id in characteristics) {
            try {
                await characteristics[id][filenameUuid].writeValue(buffer);
            } catch (e) {console.log(e)}
        }
        let start = Date.now();
        for (const id in characteristics) {
            let status = new Uint32Array(1);
            status[0] = Math.max(0, delayedCommandDuration+start-Date.now());
            console.log(status[0]);
            characteristics[id][startUuid].writeValue(status)
        }
    });

}

async function onStopRecordClick() {
    let start = Date.now();
    for (const id in characteristics) {
        let status = new Uint32Array(1);
        status[0] = Math.max(0, delayedCommandDuration+start-Date.now());
        await characteristics[id][stopUuid].writeValue(status);
        console.log("stopping " + id);
    }
}

function onDisconnected(id) {
    console.log(`${id} disconnected!`);
    document.getElementById('status-'+id).value = "Disconnected"
    document.getElementById('status-'+id).style.backgroundColor = "red"
    delete devices.id;
    delete characteristics.id;
}

function setStatusIndicator(intval, id) {
    if (intval === 1) {
        document.getElementById('status-' + id).value = "Recording"
        document.getElementById('status-' + id).style.backgroundColor = "lightblue"
    } else if (intval === 2) {
        document.getElementById('status-' + id).value = "Error"
        document.getElementById('status-' + id).style.backgroundColor = "yellow"
    } else if (intval === 0) {
        document.getElementById('status-' + id).value = "Connected, Idle"
        document.getElementById('status-' + id).style.backgroundColor = "lightgreen"
    }
}

function handleStatusDataView(value, id) {
    let a = [];
    // Convert raw data bytes to hex values just for the sake of showing something.
    // In the "real" world, you'd use data.getUint8, data.getUint16 or even
    // TextDecoder to process raw data bytes.
    for (let i = 0; i < value.byteLength; i++) {
        a.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    console.log('> ' + a.join(' '));

    let intval = value.getInt32(0, true);
    setStatusIndicator(intval, id);
}

function handleNotifications(event, id) {
    let value = event.target.value;
    handleStatusDataView(value, id);

}
