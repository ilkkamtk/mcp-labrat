const startBtn = document.getElementById('start');
const sendBtn = document.getElementById('send');
const output = document.getElementById('output');

let mediaRecorder;
let audioChunks = [];
let lastRecordingBlob = null;
let currentStream = null;

const setUiState = (state) => {
  // state: 'idle' | 'recording' | 'recorded' | 'sending'
  if (state === 'idle') {
    startBtn.textContent = 'Start Recording';
    startBtn.disabled = false;
    sendBtn.disabled = true;
    return;
  }

  if (state === 'recording') {
    startBtn.textContent = 'Stop Recording';
    startBtn.disabled = false;
    sendBtn.disabled = true;
    return;
  }

  if (state === 'recorded') {
    startBtn.textContent = 'Start Recording';
    startBtn.disabled = false;
    sendBtn.disabled = false;
    return;
  }

  if (state === 'sending') {
    startBtn.textContent = 'Start Recording';
    startBtn.disabled = true;
    sendBtn.disabled = true;
  }
};

setUiState('idle');

startBtn.addEventListener('click', async () => {
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setUiState('recorded');
      output.textContent = 'Recording stopped. Ready to send.';
      return;
    }

    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(currentStream);
    audioChunks = [];
    lastRecordingBlob = null;

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      lastRecordingBlob = new Blob(audioChunks, { type: 'audio/webm' });
      // Release the microphone
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }
    };

    mediaRecorder.start();
    setUiState('recording');
    output.textContent = 'Recording started...';
  } catch (err) {
    console.error(err);
    setUiState('idle');
    output.textContent = 'Could not start recording (mic permission?).';
  }
});

sendBtn.addEventListener('click', async () => {
  if (!lastRecordingBlob) {
    output.textContent = 'Nothing to send. Record something first.';
    return;
  }

  const formData = new FormData();
  formData.append('audio', lastRecordingBlob, 'command.webm');

  setUiState('sending');
  output.textContent = 'Processing...';

  try {
    // Send audio to backend STT middleware -> MCP
    const res = await fetch('http://localhost:3000/api/v1/client', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    // Display MCP response
    output.textContent = `MCP Response:\n${data.answer}`;

    // Speak out the response
    if ('answer' in data) {
      const utterance = new SpeechSynthesisUtterance(data.answer);
      utterance.lang = 'fi-FI';
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }

    setUiState('recorded');
  } catch (err) {
    console.error(err);
    output.textContent = 'Error sending audio to server.';
    setUiState(lastRecordingBlob ? 'recorded' : 'idle');
  }
});
