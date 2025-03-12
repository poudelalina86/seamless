// Check for audio recording support
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  alert(
    "Your browser does not support audio recording. Please use Chrome or Firefox."
  );
}

const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");
const statusText = document.getElementById("status");
const timeDisplay = document.getElementById("timeDisplay");
const translationPrompt = document.getElementById("translationPrompt");
const recordedAudioContainer = document.getElementById(
  "recordedAudioContainer"
);
const translatedAudioContainer = document.getElementById(
  "translatedAudioContainer"
);

let mediaRecorder;
let audioChunks = [];
let timerInterval;
let seconds = 0;
let wavBlobGlobal; // Store the WAV blob for translation

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  stopButton.disabled = false;
  statusText.textContent = "Listening...";
  resetTimer();
  translationPrompt.style.display = "none"; // Hide translate prompt
  recordedAudioContainer.innerHTML = ""; // Clear previous recorded audio
  translatedAudioContainer.innerHTML = ""; // Clear previous translated audio

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 128000,
    });
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      statusText.textContent = "Processing audio...";

      // Create a Blob from the recorded data
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Convert to WAV using AudioContext
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavBuffer = audioBufferToWav(audioBuffer);
        wavBlobGlobal = new Blob([wavBuffer], { type: "audio/wav" });
        const wavUrl = URL.createObjectURL(wavBlobGlobal);

        // Label for Nepali Speech
        const recordedLabel = document.createElement("p");
        recordedLabel.textContent = "Nepali Speech:";
        recordedLabel.className = "font-semibold mt-2 text-red-900 uppercase";

        // Recorded Audio
        const recordedAudio = document.createElement("audio");
        recordedAudio.controls = true;
        recordedAudio.src = wavUrl;

        recordedAudioContainer.appendChild(recordedLabel);
        recordedAudioContainer.appendChild(recordedAudio);

        statusText.textContent =
          "Recording complete. You can now translate your audio.";
        // Show the translate button
        translationPrompt.style.display = "block";
      } catch (error) {
        console.error("Error during audio conversion:", error);
        statusText.textContent = "Error processing audio.";
      }
    };

    mediaRecorder.start();
    startTimer();
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Error accessing microphone: " + error.message);
    resetButtons();
  }
});

stopButton.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    stopTimer();
    statusText.textContent = "Stopped recording.";
    resetButtons();
  }
});

// Translation button event listener
document.getElementById("translateBtn").addEventListener("click", async () => {
  if (!wavBlobGlobal) return;
  statusText.textContent = "Translating audio...";

  let formData = new FormData();
  formData.append("file", wavBlobGlobal, "audio.wav");

  try {
    const translationResponse = await fetch(
      "https://e541-34-125-29-189.ngrok-free.app/translate",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!translationResponse.ok) {
      throw new Error(`HTTP error! status: ${translationResponse.status}`);
    }

    // Get translated audio blob and display it
    const translatedBlob = await translationResponse.blob();
    const translatedUrl = URL.createObjectURL(translatedBlob);

    // Label for Translated Speech
    const translatedLabel = document.createElement("p");
    translatedLabel.textContent = "Translated English Speech:";
    translatedLabel.className = "font-semibold mt-2 text-red-900 uppercase";

    // Create or update the translated audio element
    let translatedAudio = document.getElementById("translatedAudio");
    if (!translatedAudio) {
      translatedAudio = document.createElement("audio");
      translatedAudio.id = "translatedAudio";
      translatedAudio.controls = true;
      translatedAudio.className = "mt-4";
      translatedAudioContainer.appendChild(translatedLabel);
      translatedAudioContainer.appendChild(translatedAudio);
    }
    translatedAudio.src = translatedUrl;

    // Optionally, play the translated audio automatically
    translatedAudio.play();
    statusText.textContent = "Translation complete. Playing audio...";
  } catch (error) {
    console.error("Error during translation:", error);
    statusText.textContent = "Error during translation.";
  }
});

function resetButtons() {
  startButton.disabled = false;
  stopButton.disabled = true;
}

function startTimer() {
  timerInterval = setInterval(() => {
    seconds += 0.1;
    timeDisplay.textContent = `Time: ${seconds.toFixed(2)}s`;
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function resetTimer() {
  seconds = 0;
  timeDisplay.textContent = "Time: 0.00s";
}

// Converts an AudioBuffer to a WAV ArrayBuffer
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * (bitDepth / 8);
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Helper to write strings to DataView
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}
