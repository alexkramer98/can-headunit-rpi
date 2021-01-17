const SerialPort = require('serialport');
const ReadLine = require('@serialport/parser-readline');
const { exec } = require("child_process");
const KeySender = require('node-key-sender');
const _ = require('lodash');

exec('stty -F /dev/ttyUSB0 -hupcl');
setTimeout(init, 5000);

function init() {
    const arduino = new SerialPort('/dev/ttyUSB0', {
        baudRate: 115200,
    });
    const parser = arduino.pipe(new ReadLine({ delimiter: '\n' }));
    parser.on('data', data => {
        const splitData = data.trim().split(':');
        const entity = splitData[0];
        let state = splitData[1];
        if (/^\d+$/.test(state)) {
            state = Number.parseInt(state);
        }
        handleSerialInput(entity, state);
    });
}

let previousStates = {};
let isDaytime = 1;

let pressKeysDebounced = _.debounce(keys => {
    if (_.isArray(keys)) {
        KeySender.sendCombination(keys);
    } else {
        KeySender.sendKey(keys);
    }
    console.log(keys);
}, 150, {
    leading: true,
    trailing: false,
});


let wasPressedBefore = false;
let singlePressHandler = null;

const handleMultiButton = _.debounce((singlePress, doublePress) => {
    if (!wasPressedBefore) {
        singlePressHandler = setTimeout(() => {
            KeySender.sendKey(singlePress);
        }, 500);
        wasPressedBefore = true;
    } else {
        KeySender.sendKey(doublePress);
        clearTimeout(singlePressHandler);
    }
    setTimeout(() => {
        wasPressedBefore = false;
    }, 500);
}, 150, {
    leading: true,
    trailing: false,
});

function handleSerialInput(entity, state) {
    if (entity === 'inReverse') {
        if (state !== previousStates[entity]) {
            if (!state) {
                exec('kill -9 mplayer');
                KeySender.sendKey('f12');
            } else {
                exec('mplayer tv:// -tv driver=v4l2 -vf scale -zoom -fs -x 800 -y 480');
            }
        }
    } else if (entity === 'brightness') {
        if (state !== previousStates[entity]) {
            exec(`echo ${state} > /sys/class/backlight/rpi_backlight/brightness`);
        }
    } else if (entity === 'dayTime') {
        if (state !== previousStates[entity] && state !== isDaytime) {
            isDaytime = state;
            KeySender.sendKey('f2');
        }
    } else if (entity === 'activeSwcButton') {
        switch(state) {
            case 'volUp':
                pressKeysDebounced('f8');
                break;
            case 'volDown':
                pressKeysDebounced('f7');
                break;
            case 'phone':
                handleMultiButton('p', 'o');
                break;
            case 'mute':
                pressKeysDebounced(['control', 'f11']);
                break;
            case 'talk':
                pressKeysDebounced('m');
                break;
            case 'up':
                pressKeysDebounced('2');
                break;
            case 'down':
                pressKeysDebounced('1');
                break;
            case 'previous':
                pressKeysDebounced('v');
                break;
            case 'next':
                pressKeysDebounced('n');
                break;
            case 'src':
                handleMultiButton('enter', 'f');
        }
    } else {
        throw new Error('Unknown entity!');
    }
    previousStates[entity] = state;
}