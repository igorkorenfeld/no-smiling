// 
// import { FaceMesh } from '@mediapipe/face_mesh';
// import { Camera } from '@mediapipe/camera_utils';
// import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
//npm install @mediapipe/face_mesh @mediapipe/camera_utils @mediapipe/drawing_utils

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
  N: 0,
  NW: 39,
  NE: 269,
  SW: 181,
  SE: 405,
  S: 17
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

let lastAngle = 0;

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
    // const mouthPoints = [MOUTH.LEFT, MOUTH.RIGHT, MOUTH.LOWER_LIP, MOUTH.RIGHT];
    landmarks.forEach((pt, i) => {
      if (Object.values(MOUTH).includes(i)) {
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(i, x, y);
      }
    });


    ctx.font = '40px Arial';
    const moustachePoint = landmarks[2];
    const moustacheX = moustachePoint.x * canvas.width;
    const moustacheY = moustachePoint.y * canvas.height;
    const leftCheek = landmarks[50];
    const rightCheek = landmarks[280];
    const faceWidth = Math.hypot(
      (rightCheek.x - leftCheek.x) * canvas.width,
      (rightCheek.y - leftCheek.y) * canvas.height,
    );

    ctx.font = `${faceWidth * 0.1}px Arial`;
    ctx.fillText('🥸', moustacheX, moustacheY);

    const foreheadPoint = landmarks[9];
    const foreheadX = foreheadPoint.x * canvas.width;
    const foreheadY = foreheadPoint.y * canvas.height;
    ctx.font = `20px Arial`;
    const dx = landmarks[33].x * canvas.width - landmarks[263].x * canvas.width;
    const dy = landmarks[33].y * canvas.height - landmarks[263].y * canvas.height;
    const angleRadians = Math.atan2(dy, dx);
    // const angleDegrees = (180 - angleRadians * (180 / Math.PI)).toFixed(2);
    let angleDegrees = 180 - (angleRadians * (180 / Math.PI)).toFixed(2);
    if (angleDegrees > 90) angleDegrees -= 180;
    if (angleDegrees < -90) angleDegrees += 180;

    // console.log(`angle Degrees: ${angleDegrees}`);
    //
    // ctx.fillText('Winner', foreheadX - ctx.measureText('Winner').width / 2, foreheadY);

    console.log(landmarks[33].x * canvas.width, landmarks[33].y * canvas.height);
    ctx.beginPath();

    // Set a start-point
    ctx.moveTo(landmarks[33].x * canvas.width, landmarks[33].y * canvas.height);

    // Set an end-point
    ctx.lineTo(landmarks[263].x * canvas.width, landmarks[263].y * canvas.height);
    console.log(landmarks[263].x * canvas.width, landmarks[263].y * canvas.height);
    console.log(`dx:${dx} dy:${dy} atan2:${angleRadians} degrees:${angleDegrees}`)

    // Stroke it (Do the Drawing)
    ctx.linewidth = 2;
    ctx.strokeStyle = "red";
    ctx.stroke();

    const alpha = 0.2; // 0..1, lower = smoother
    lastAngle = lastAngle + alpha * (angleDegrees - lastAngle);

    ctx.save();
    // Let's change the canvas position to draw rotated
    ctx.translate(foreheadX, foreheadY);
    ctx.rotate(angleRadians);
    ctx.scale(-1, -1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('hello', 0, 0);
    // ctx.fillText(lastAngle.toFixed(2), 0, 0);
    ctx.restore();

    // 

    // mouthConfidence = clamp(1.0 - (mouthJitter / JITTER_MAX), 0, 1) * shapeScore;
    //     const mouthLandmarkHistory = {
    //   61: [], // array of {x, y} points for landmark 61
    //   291: [], 
    //   13: [], 
    //   14: []
    // };
    function euclideanDist(p1, p2) {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    // Update history with latest points elsewhere when frame arrives
    // Here dataPerFrame is {61: {x,y}, 291: {x,y}, ...}

    // function computeMouthJitter(mouthLandmarkHistory, currentFramePoints) {
    //   const landmarkIndices = [61, 291, 13, 14];
    //   let totalDist = 0;
    //   let count = 0;
    //
    //   landmarkIndices.forEach(i => {
    //     const history = mouthLandmarkHistory[i];
    //     if (history.length > 0) {
    //       const lastPoint = history[history.length - 1];
    //       totalDist += euclideanDist(currentFramePoints[i], lastPoint);
    //       count++;
    //     }
    //     history.push(currentFramePoints[i]);
    //     // limit history size to last M frames
    //     if (history.length > 10) history.shift();
    //   });
    //
    //   if (count === 0) return 0;
    //   return totalDist / count;
    // }

    // Detect Smile
    // const { score, mouthWidth, mouthHeight } = getSmileScore(landmarks);
    const { score, rightDiff, centerDiff, leftDiff, widthDiff } = getSmileScore(landmarks)
    const isSmiling = score < 0.32 || score > 0.49;

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
      `rightDiff: ${rightDiff}\n`,
      10,
      50
    );
    ctx.fillText(
      ` centerDiff: ${centerDiff}\n`,
      10,
      70
    );
    ctx.fillText(
      ` leftDiff: ${leftDiff}\n`,
      10,
      90
    );
    ctx.fillText(
      ` widthDiff: ${widthDiff}\n`,
      10,
      110
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
    // console.log(`smiling? ${isSmiling}`);
    // console.log(landmarks[MOUTH.LEFT].x, landmarks[MOUTH.RIGHT].x, landmarks[MOUTH.LOWER_LIP].y, landmarks[MOUTH.UPPER_LIP].y);
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

  // Original Calc
  // const mouthWidth = Math.hypot(
  //   landmarks[MOUTH.RIGHT].x - landmarks[MOUTH.LEFT].x,
  //   landmarks[MOUTH.RIGHT].y - landmarks[MOUTH.LEFT].y
  // );
  //
  // const mouthHeight = Math.hypot(
  //   landmarks[MOUTH.UPPER_LIP].x - landmarks[MOUTH.LOWER_LIP].x,
  //   landmarks[MOUTH.UPPER_LIP].y - landmarks[MOUTH.LOWER_LIP].y,
  // );


  // MAR
  const rightDiff = Math.hypot(
    landmarks[MOUTH.NE].x - landmarks[MOUTH.SE].x,
    landmarks[MOUTH.NE].y - landmarks[MOUTH.SE].y,
  );

  const centerDiff = Math.hypot(
    landmarks[MOUTH.N].x - landmarks[MOUTH.S].x,
    landmarks[MOUTH.N].y - landmarks[MOUTH.S].y,
  );

  const leftDiff = Math.hypot(
    landmarks[MOUTH.NW].x - landmarks[MOUTH.SW].x,
    landmarks[MOUTH.NW].y - landmarks[MOUTH.SW].y,
  );

  const widthDiff = Math.hypot(
    landmarks[MOUTH.LEFT].x - landmarks[MOUTH.RIGHT].x,
    landmarks[MOUTH.LEFT].y - landmarks[MOUTH.RIGHT].y,
  );

  // Avoid divide by 0
  if (widthDiff === 0) return 0;

  // const score = mouthWidth / mouthHeight;
  // const score = mouthHeight / mouthWidth;

  const score = (rightDiff + centerDiff + leftDiff) / (3 * widthDiff);


  // return { score, mouthWidth, mouthHeight };
  return { score, rightDiff, centerDiff, leftDiff, widthDiff };
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

