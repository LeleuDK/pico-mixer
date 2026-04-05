const ws = new WebSocket("ws://localhost:8000/key_events");
const tracksPlaying = {};
const volumeIncrement = 0.05;
const EVENT_STATE = {
  INIT: "init",
  PAUSE: "pause",
  PAUSE_ALL: "pause_all",
  START: "start",
  STOP: "stop",
  UNPAUSE: "unpause",
  UNPAUSE_ALL: "unpause_all",
  USB_CONNECTED: "usb_connected",
  USB_DISCONNECTED: "usb_disconnected",
  VOL_DOWN: "vol_down",
  VOL_UP: "vol_up",
  SWITCH_BANK: "switch_bank",
};

let currentBank = 1; // Start med bank 1
const TOTAL_TRACKS_PER_BANK = 12;

let globalPaused = false;

function roundTo2Digits(num) {
  return Math.round(num * 100) / 100;
}

function pauseTrack(audioElement, trackProgressBar) {
  if (!(audioElement.paused && trackProgressBar.classList.contains("non-playing"))) {
    audioElement.pause();
    trackProgressBar.classList.add("paused");
  }
}

function unPauseTrack(audioElement, trackProgressBar) {
  if (audioElement.paused && trackProgressBar.classList.contains("paused")) {
    audioElement.play();
    trackProgressBar.classList.remove("paused");
  }
}

function pauseAllPlayingTracks() {
  Object.entries(tracksPlaying).forEach(([key, audioElement]) => {
    const trackProgressBar = document.getElementById(`progress_track_${key}`);
    pauseTrack(audioElement, trackProgressBar);
  });
  globalPaused = true;
}

function unpauseAllPlayingTracks() {
  Object.entries(tracksPlaying).forEach(([key, audioElement]) => {
    const trackProgressBar = document.getElementById(`progress_track_${key}`);
    unPauseTrack(audioElement, trackProgressBar)
  });
  globalPaused = false;
}

function colorizeTracksKbdElements(colors) {
  const totalTracks = 24;
  for (let i = 0; i < totalTracks; i++) {
    const colorIndex = i % colors.length;
    const color = colors[colorIndex];
    const trackColoredElements = document.getElementsByClassName(`track_${i}`);
    for (const element of trackColoredElements) {
      element.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      element.style.color = 'white';
    }
  }
}

function startTrack(trackKey, trackAudioElement, trackProgressBar) {
  tracksPlaying[trackKey] = trackAudioElement;
  trackProgressBar.classList.remove("non-playing");
  trackProgressBar.classList.remove("paused");
  trackProgressBar.textContent = "100%";
  trackProgressBar.style.backgroundColor = document.getElementsByClassName(`track_${trackKey}`)[0].style.backgroundColor;
  trackAudioElement.play();
}

function stopTrack(trackKey, trackaudioElement, trackProgressBar) {
  trackProgressBar.classList.add("non-playing");
  trackProgressBar.classList.remove("paused");
  trackaudioElement.pause();
  trackaudioElement.currentTime = 0;
  trackaudioElement.volume = 1;
  trackProgressBar.style.width = '100%';
  trackProgressBar.style.backgroundColor = null;
  trackProgressBar.textContent = "";
  delete tracksPlaying[trackKey];
}

function increaseTrackVolume(trackAudioElement, trackProgressBar) {
  if (roundTo2Digits(trackAudioElement.volume + volumeIncrement <= 1)) {
    trackAudioElement.volume = roundTo2Digits(trackAudioElement.volume + volumeIncrement);
    trackProgressBar.style["width"] = trackAudioElement.volume * 100 + "%";
    trackProgressBar.textContent = trackProgressBar.style["width"];
  };
}

function decreaseTrackVolume(trackAudioElement, trackProgressBar) {
  if (roundTo2Digits(trackAudioElement.volume - volumeIncrement) >= 0) {
    trackAudioElement.volume = roundTo2Digits(trackAudioElement.volume - volumeIncrement);
    trackProgressBar.style["width"] = trackAudioElement.volume * 100 + "%";
    trackProgressBar.textContent = trackProgressBar.style["width"];
  };
}

function alertAboutTrackNotFound(trackNode) {
  warningNode = document.createElement("span");
  warningNode.className = 'track-warning';
  warningNode.textContent = "⚠ not found!️";
  trackNode.appendChild(warningNode);
}

function updateBankDisplay() {
  const totalTracks = 24;
  for (let i = 0; i < totalTracks; i++) {
    const trackDiv = document.getElementById(`track_${i}`);
    if (!trackDiv) continue;
    if (currentBank === 1 && i < TOTAL_TRACKS_PER_BANK) {
      trackDiv.style.display = "block";
    } else if (currentBank === 2 && i >= TOTAL_TRACKS_PER_BANK) {
      trackDiv.style.display = "block";
    } else {
      trackDiv.style.display = "none";
    }
  }
}

ws.addEventListener('message', event => {
  const keyEvent = JSON.parse(event.data);
  const usbStatus = document.getElementById("usb_status");

  if (keyEvent.state === EVENT_STATE.USB_DISCONNECTED) {
    usbStatus.textContent = "🔌 🚫";
  } else if (keyEvent.state === EVENT_STATE.USB_CONNECTED) {
    usbStatus.textContent = "🔌 ✅";
  } else if (keyEvent.state === EVENT_STATE.INIT) {
    colorizeTracksKbdElements(keyEvent.colors);
  } else if (keyEvent.state === EVENT_STATE.PAUSE_ALL) {
    pauseAllPlayingTracks();
  } else if (keyEvent.state === EVENT_STATE.UNPAUSE_ALL) {
    unpauseAllPlayingTracks();
  } else if (keyEvent.state === EVENT_STATE.SWITCH_BANK) {
    currentBank = currentBank === 1 ? 2 : 1;
    updateBankDisplay();
  } else {
    const physicalKey = parseInt(keyEvent.key);
    const effectiveKey = currentBank === 2 ? physicalKey + TOTAL_TRACKS_PER_BANK : physicalKey;

    const trackProgressBar = document.getElementById(`progress_track_${effectiveKey}`);
    const audioElement = document.getElementById(`audio_track_${effectiveKey}`);

    if (audioElement === null) {
      return;
    }

    switch (keyEvent.state) {
      case EVENT_STATE.START:
        startTrack(effectiveKey, audioElement, trackProgressBar);
        if (globalPaused) {
          pauseTrack(audioElement, trackProgressBar);
        }
        break;
      case EVENT_STATE.STOP:
        stopTrack(effectiveKey, audioElement, trackProgressBar);
        break;
      case EVENT_STATE.VOL_UP:
        increaseTrackVolume(audioElement, trackProgressBar);
        break;
      case EVENT_STATE.VOL_DOWN:
        decreaseTrackVolume(audioElement, trackProgressBar);
        break;
      case EVENT_STATE.PAUSE:
        pauseTrack(audioElement, trackProgressBar);
        break;
      case EVENT_STATE.UNPAUSE:
        unPauseTrack(audioElement, trackProgressBar);
        break;
    }
  }

});


async function probeAudioTrack(audioNode) {
  await fetch(audioNode.src, { "method": "HEAD" }).then((response) => {
    if (response.status != 200) {
      alertAboutTrackNotFound(audioNode.parentNode);
    }
  })
}

window.addEventListener('load', function () {
  updateBankDisplay();
  audioNodes = document.getElementsByTagName('audio')
  for (let i = 0; i < audioNodes.length; i++) {
    audioNode = document.getElementById(`audio_track_${i}`);
    probeAudioTrack(audioNode);
  }
})