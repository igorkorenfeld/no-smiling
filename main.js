const videoElement = document.getElementById('video');
const canvas = document.getElementById('c1');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('camera-select');
const btnStart = document.getElementById('video__start');
const btnStop = document.getElementById('video__stop');

//LANDMARK KEYPOINTS
const MOUTH = {
  LEFT: 61,
  RIGHT: 291,
  UPPER_LIP: 13,
  LOWER_LIP: 14,
}

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
    landmarks.forEach((pt, i) => {
      const x = pt.x * canvas.width;
      const y = pt.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
      // ctx.fillText(i, x, y);
    });


    // Detect Smile
    const { score, mouthWidth, mouthHeight } = getSmileScore(landmarks);
    const isSmiling = score > 2.0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0) // undo mirror
    ctx.fillStyle = isSmiling ? 'lime' : 'red';
    ctx.font = '20px Arial';
    if (!score) return;
    ctx.fillText(
      `Smile: ${score.toFixed(2)} ${isSmiling ? '😄' : ''}`,
      10,
      30
    );
    ctx.fillText(
      `mouthWidth: ${mouthWidth}\n`,
      10,
      50
    );
    ctx.fillText(
      ` mouthHeight: ${mouthHeight}\n`,
      10,
      70
    );
    ctx.restore();


    if (isSmiling) {
      const cx = ((MOUTH.LEFT.x + MOUTH.RIGHT.x) / 2) * canvas.width;
      const cy = MOUTH.UPPER_LIP.y * canvas.height - 10;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Undo mirror for correct text direction
      ctx.fillStyle = 'lime';
      ctx.fillText('Smile!', cx, cy);
      ctx.restore();
    }
    console.log(`smiling? ${isSmiling}`);
    console.log(landmarks[MOUTH.LEFT].x, landmarks[MOUTH.RIGHT].x, landmarks[MOUTH.LOWER_LIP].y, landmarks[MOUTH.UPPER_LIP].y);
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


function getSmileScore(landmarks) {
  // const dx = landmarks[MOUTH.RIGHT].x - landmarks[MOUTH.LEFT].x;
  // const dy = landmarks[MOUTH.RIGHT].y - landmarks[MOUTH.LEFT].y;
  // const mouthWidth = Math.sqrt(dx * dx + dy * dy);
  const mouthWidth = Math.hypot(
    landmarks[MOUTH.RIGHT].x - landmarks[MOUTH.LEFT].x,
    landmarks[MOUTH.RIGHT].y - landmarks[MOUTH.LEFT].y
  );

  const mouthHeight = Math.hypot(
    landmarks[MOUTH.UPPER_LIP].x - landmarks[MOUTH.LOWER_LIP].x,
    landmarks[MOUTH.UPPER_LIP].y - landmarks[MOUTH.LOWER_LIP].y,
  );


  // Avoid divide by 0
  if (mouthHeight === 0) return 0;

  const score = mouthWidth / mouthHeight;
  // const score = mouthHeight / mouthWidth;
  return { score, mouthWidth, mouthHeight };
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

