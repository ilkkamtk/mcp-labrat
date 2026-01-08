const startBtn = document.getElementById('start');
const sendBtn = document.getElementById('send');
const output = document.getElementById('output');

let mediaRecorder;
let audioChunks = [];
let lastRecordingBlob = null;
let currentStream = null;
let stopRecordingPromise = null;

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

const releaseMicrophone = () => {
  if (!currentStream) return;
  currentStream.getTracks().forEach((t) => t.stop());
  currentStream = null;
};

const startRecording = async () => {
  currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(currentStream);
  audioChunks = [];
  lastRecordingBlob = null;

  stopRecordingPromise = new Promise((resolve, reject) => {
    const handleDataAvailable = (e) => {
      audioChunks.push(e.data);
    };

    const handleStop = () => {
      mediaRecorder.removeEventListener('dataavailable', handleDataAvailable);
      mediaRecorder.removeEventListener('stop', handleStop);
      mediaRecorder.removeEventListener('error', handleError);
      resolve(new Blob(audioChunks, { type: 'audio/webm' }));
    };

    const handleError = (e) => {
      mediaRecorder.removeEventListener('dataavailable', handleDataAvailable);
      mediaRecorder.removeEventListener('stop', handleStop);
      mediaRecorder.removeEventListener('error', handleError);
      reject(e);
    };

    mediaRecorder.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorder.addEventListener('stop', handleStop);
    mediaRecorder.addEventListener('error', handleError);
  });

  mediaRecorder.start();
};

const stopRecording = async () => {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

  const stopPromise = stopRecordingPromise;
  mediaRecorder.stop();

  try {
    lastRecordingBlob = await stopPromise;
  } finally {
    releaseMicrophone();
    stopRecordingPromise = null;
  }
};

startBtn.addEventListener('click', async () => {
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      await stopRecording();
      setUiState('recorded');
      output.textContent = 'Recording stopped. Ready to send.';
      return;
    }

    await startRecording();
    setUiState('recording');
    output.textContent = 'Recording started...';
  } catch (err) {
    console.error(err);
    releaseMicrophone();
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
    const res = await fetch('/api/v1/client', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `Request failed (${res.status})`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Unexpected non-JSON response from server.');
    }

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
    output.textContent =
      err instanceof Error ? err.message : 'Error sending audio to server.';
    setUiState(lastRecordingBlob ? 'recorded' : 'idle');
  }
});
