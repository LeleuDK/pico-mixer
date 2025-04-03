const ws = new WebSocket("ws://localhost:8000/key_events");
const tracksPlaying = {};
const volumeIncrement = 0.05;

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
  const totalTracks = 24; // Vi antager, at du har 24 tracks i alt
  for (let i = 0; i < totalTracks; i++) {
    const colorIndex = i % colors.length;  // colors.length er 12 her (efter at du sender COLORS[:12])
    const color = colors[colorIndex];
    const trackColoredElements = document.getElementsByClassName(`track_${i}`);
    for (const element of trackColoredElements) {
      element.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      element.style.color = 'white';
    }
  }
}

function colorizeTracksKbdElements_old(colors) {
  for (i=0; i<colors.length; i++) {
    const color = colors[i];
    const trackColoredElements = document.getElementsByClassName(`track_${i}`);
    for (const element of trackColoredElements) {
      element.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]}`;
      element.style.color = 'white';
    };
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
  // Gå alle tracks igennem. Her antages det, at audio-elementerne og tilhørende divs har id'er med
  // formaterne audio_track_{index} og track_{index}. Hvis du ikke har track div'ene, kan du
  // alternativt ændre baggrundsfarven på de tilhørende kbd-elementer.
  const totalTracks = 24; // eller brug din dynamiske værdi fra config
  for (let i = 0; i < totalTracks; i++) {
    // Antag, at du har en container for hvert track med id'et "track_{i}"
    const trackDiv = document.getElementById(`track_${i}`);
    if (!trackDiv) continue;
    // Hvis i er inden for den aktive bank, vis elementet, ellers gem det
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

  if (keyEvent.state === "usb_disconnected") {
    usbStatus.textContent = "🔌 🚫";
  } else if (keyEvent.state === "usb_connected") {
    usbStatus.textContent = "🔌 ✅";
  } else if (keyEvent.state === "init") {
    colorizeTracksKbdElements(keyEvent.colors);
  } else if (keyEvent.state === "pause_all") {
    pauseAllPlayingTracks();
  } else if (keyEvent.state === "unpause_all") {
    unpauseAllPlayingTracks();
  } else if (keyEvent.state === "switch_bank") {  // <== NY
    // Skift bank: hvis vi er i bank 1, skift til bank 2 og omvendt
    currentBank = currentBank === 1 ? 2 : 1;
    updateBankDisplay();
  } else {
    // Her remapper vi nøglen baseret på hvilken bank der er aktiv.
    const physicalKey = parseInt(keyEvent.key);
    const effectiveKey = currentBank === 2 ? physicalKey + TOTAL_TRACKS_PER_BANK : physicalKey;

    const trackProgressBar = document.getElementById(`progress_track_${effectiveKey}`);
    const audioElement = document.getElementById(`audio_track_${effectiveKey}`);

    if (audioElement === null) {
      return;
    }

    switch (keyEvent.state) {
      case "start":
        startTrack(effectiveKey, audioElement, trackProgressBar);
        if (globalPaused) {
          pauseTrack(audioElement, trackProgressBar);
        }
        break;
      case "stop":
        stopTrack(effectiveKey, audioElement, trackProgressBar);
        break;
      case "vol_up":
        increaseTrackVolume(audioElement, trackProgressBar);
        break;
      case "vol_down":
        decreaseTrackVolume(audioElement, trackProgressBar);
        break;
      case "pause":
        pauseTrack(audioElement, trackProgressBar);
        break;
      case "unpause":
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
  // Skjul de tracks, der ikke hører til den aktive bank
  updateBankDisplay();
  audioNodes = document.getElementsByTagName('audio')
  for (let i = 0; i < audioNodes.length; i++) {
    audioNode = document.getElementById(`audio_track_${i}`);
    probeAudioTrack(audioNode);
  }
})