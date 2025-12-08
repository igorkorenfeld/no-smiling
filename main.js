const videoElement = document.getElementById('video');
const canvas = document.getElementById('c1');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('camera-select');
const btnStart = document.getElementById('video__start');
const btnStop = document.getElementById('video__stop');

let camera = null;           // MediaPipe Camera helper
let currentDeviceId = null;  // active camera id

// List cameras and populate <select>
async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(d => d.kind === 'videoinput');

  cameraSelect.innerHTML = '';
  cameras.forEach((cam, index) => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(opt);
  });

  if (cameras.length > 0 && !currentDeviceId) {
    currentDeviceId = cameras[0].deviceId;
  }
}

// Called whenever FaceMesh has new results
function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the mirrored image
  ctx.drawImage(
    results.image, 0, 0, canvas.width, canvas.height
  );

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0]; // one face only

    // Draw landmarks as small circles
    ctx.fillStyle = 'purple';
    landmarks.forEach(pt => {
      const x = pt.x * canvas.width;
      const y = pt.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  ctx.restore();
}

// Initialize FaceMesh solution
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onResults);

// Start MediaPipe camera for a given deviceId
async function startCamera(deviceId) {
  if (camera) {
    camera.stop();
    camera = null;
  }

  currentDeviceId = deviceId;

  // MediaPipe Camera util accepts a video element and onFrame callback
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480,
    facingMode: 'user',
    deviceId: deviceId, // custom field; many people pass through constraints here
  });

  camera.start();
}

// Simple wrappers for buttons
function handleStart() {
  const selectedId = cameraSelect.value || currentDeviceId;
  if (selectedId) startCamera(selectedId);
}

function handleStop() {
  if (camera) {
    camera.stop();
    camera = null;
  }
}

// When camera selection changes, restart with new device
cameraSelect.addEventListener('change', () => {
  const selectedId = cameraSelect.value;
  if (selectedId) startCamera(selectedId);
});

btnStart.addEventListener('click', handleStart);
btnStop.addEventListener('click', handleStop);

// Main entry
async function run() {
  // Ask for permission once so device labels are available
  await navigator.mediaDevices.getUserMedia({ video: true });
  await listCameras();
}

run();

