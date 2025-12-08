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
//
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

await faceMesh.initialize();
faceMesh.onResults(onResults);

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

const faceOutlinePts = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397,
  365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162,
  21, 54, 103, 67, 109,
];

let camera = null;           // MediaPipe Camera helper
let currentDeviceId = null;  // active camera id

// Actions
// const actions = [
//   drawFaceWord,
//   drawMoustacheEmoji,
//   drawEyeLine,
//   drawWord,
// ];

// Redo Actions as objects
const actions = [
  // { fn: drawFaceWord, config: { word: 'Hello' } },
  // { fn: drawMoustacheEmoji },
  // { fn: drawEyeLine },
  { fn: drawWord, config: { word: 'Apples' } },
];

// TODO: determine if showAction should be used, currently it's just set and unset but not checked for.
let showAction = false;
let currentActionIndex = -1;

let actionStartTime = 0;
const actionDuration = 2_000;
const actionInterval = 3_000;

function addOverlay(ctx, landmarks, image, currentTime) {
  if (currentActionIndex > -1) {
    // console.log(currentTime);
    // console.log("drawing action");
    const action = actions[currentActionIndex];
    if (action.config) {
      action.fn({ ctx, landmarks, image, ...action.config });
    }
    else {
      action.fn({ ctx, landmarks, image });
    }
  }

  if ((currentTime - actionStartTime) > actionDuration) {
    // console.log(currentTime);
    // console.log("end of action");
    showAction = false;
  }
}

function startActions() {
  setInterval(() => {
    // TODO: redo once decide on number of actions
    currentActionIndex = (currentActionIndex + 1) % (actions.length);
    console.log(`current action index: ${currentActionIndex}`);
    showAction = true;
    actionStartTime = performance.now();
  }, actionInterval)
}

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

function drawMoustacheEmoji({ ctx, landmarks }) {
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
}

function drawFaceWord({ ctx, landmarks, word }) {
  const foreheadPoint = landmarks[9];
  const foreheadX = foreheadPoint.x * canvas.width;
  const foreheadY = foreheadPoint.y * canvas.height;
  const dy = landmarks[33].y * canvas.height - landmarks[263].y * canvas.height;
  const dx = landmarks[33].x * canvas.width - landmarks[263].x * canvas.width;
  const angleRadians = Math.atan2(dy, dx);

  ctx.save();
  // Let's change the canvas position to draw rotated
  ctx.font = `20px Arial`;
  ctx.translate(foreheadX, foreheadY);
  ctx.rotate(angleRadians);
  ctx.scale(-1, -1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, 0, 0);
  // ctx.fillText(lastAngle.toFixed(2), 0, 0);
  ctx.restore();
}

// Draw landmarks as small circles
function drawMouthPoints({ ctx, landmarks }) {
  ctx.font = '10px Arial';
  ctx.fillStyle = 'purple';

  Object.values(MOUTH).forEach((pt) => {
    const x = landmarks[pt].x * canvas.width;
    const y = landmarks[pt].y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText(pt, x, y);
  })
}

function drawEyeLine({ ctx, landmarks }) {
  ctx.beginPath();

  // Set a start-point
  ctx.moveTo(landmarks[33].x * canvas.width, landmarks[33].y * canvas.height);

  // Set an end-point
  ctx.lineTo(landmarks[263].x * canvas.width, landmarks[263].y * canvas.height);

  // Add the stroke
  ctx.linewidth = 2;
  ctx.strokeStyle = "red";
  ctx.stroke();

}


// Get the Euclidane distance between two points
// The points should have an x and y property
function eucDist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}


// mouthConfidence = clamp(1.0 - (mouthJitter / JITTER_MAX), 0, 1) * shapeScore;
//     const mouthLandmarkHistory = {
//   61: [], // array of {x, y} points for landmark 61
//   291: [], 
//   13: [], 
//   14: []
// };

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

// Called whenever FaceMesh has new results
function onResults(results) {
  const now = performance.now();
  // ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the mirrored image
  // ctx.save()
  // ctx.translate(canvas.width, 0);
  // ctx.scale(-1, 1);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  // ctx.restore()

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0]; // one face only

    drawMouthPoints({ ctx, landmarks });
    // drawMoustacheEmoji(ctx, landmarks);

    //Draw Eye line
    // drawEyeLine(ctx, landmarks);


    // Detect Smile
    // const { score, mouthWidth, mouthHeight } = getSmileScore(landmarks);
    const { score, rightDiff, centerDiff, leftDiff, widthDiff } = getSmileScore(landmarks)
    const isSmiling = score < 0.32 || (score > 0.49 && score < 0.75);
    // drawFaceUpsideDown(ctx, landmarks);
    // drawMouthOnly(ctx, landmarks, results.image);
    // drawMultiFace(ctx, landmarks, results.image);

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
    addOverlay(ctx, landmarks, results.image, now);
  }


  // ctx.restore();
}


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
  startActions();
}

function drawFaceUpsideDown(ctx, landmarks) {
  // Calculate face bounding box in pixels
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  landmarks.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });
  const x = minX * canvas.width;
  const y = minY * canvas.height;
  const width = (maxX - minX) * canvas.width;
  const height = (maxY - minY) * canvas.height;

  if (width <= 0 || height <= 0) return;

  // Save canvas state
  ctx.save();

  // Translate to center of face box (pivot for rotation)
  ctx.translate(x + width / 2, y + height / 2);

  // Rotate 180 degrees to flip upside down
  ctx.rotate(Math.PI);

  // Translate back to draw image aligned with rotation center
  ctx.translate(-width / 2, -height / 2);

  // ctx.save();
  //
  const origin = 10;
  ctx.beginPath();
  faceOutlinePts.forEach((pt) => {
    let ptCoords = normLandmark(pt, landmarks);
    if (pt === origin) {
      ctx.moveTo(ptCoords.x - x, ptCoords.y - y);
    }
    else {
      ctx.lineTo(ptCoords.x - x, ptCoords.y - y);
    }
  });
  ctx.closePath();
  ctx.clip();

  // Draw the relevant face rectangle portion of video flipped
  ctx.drawImage(
    video,
    x, y, width, height,  // source rectangle from video
    0, 0, width, height   // destination rectangle inside transformed context
  );

  // Undo Clip
  // ctx.restore();
  // Restore canvas state to undo translation and rotation
  ctx.restore();
}

function normLandmark(pt, landmarks) {
  if (landmarks[pt]) {
    return { x: landmarks[pt].x * canvas.width, y: landmarks[pt].y * canvas.height }
  }
  else {
    return null;
  }
}

function getFaceOutlineBox({ ctx, landmarks }) {
  const origin = 10;
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

  faceOutlinePts.forEach((pt) => {
    const ptCoords = normLandmark(pt, landmarks);
    minX = Math.min(minX, ptCoords.x);
    minY = Math.min(minY, ptCoords.y);
    maxX = Math.max(maxX, ptCoords.x);
    maxY = Math.max(maxY, ptCoords.y);
  });

  return {
    x: minX,
    y: minY,
    w: (maxX - minX),
    h: (maxY - minY),
  }

  // ctx.beginPath();
  // const originCoordinates = normLandmark(origin, landmarks);
  // ctx.moveTo(originCoordinates.x, originCoordinates.y);
  //
  // faceOutlinePts.forEach((pt) => {
  //   let ptCoords = normLandmark(pt, landmarks);
  //   ctx.lineTo(ptCoords.x, ptCoords.y);
  // });
  //
  // ctx.closePath();
  // ctx.clip();
}

function drawMultiFace({ ctx, landmarks, image }) {
  const faceOutlineBox = getFaceOutlineBox({ ctx, landmarks });
  const offsets = [-1, 1];
  const padding = 25;
  offsets.forEach((offset) => {
    const destX = faceOutlineBox.x + (offset * (faceOutlineBox.w + (padding)));
    // if (cloneX + faceOutlineBox.w < 0 || cloneX + faceOutlineBox.w > canvas.width) return;
    ctx.save();
    ctx.translate(destX, faceOutlineBox.y);

    // 200, 

    const origin = 10;
    ctx.beginPath();

    // TODO: Extract as a function
    faceOutlinePts.forEach((pt) => {
      let ptCoords = normLandmark(pt, landmarks);
      if (pt === origin) {
        ctx.moveTo(ptCoords.x - faceOutlineBox.x, ptCoords.y - faceOutlineBox.y);
      }
      else {
        ctx.lineTo(ptCoords.x - faceOutlineBox.x, ptCoords.y - faceOutlineBox.y);
      }
    });
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      image,
      faceOutlineBox.x, faceOutlineBox.y, faceOutlineBox.w, faceOutlineBox.h,
      0, 0, faceOutlineBox.w, faceOutlineBox.h
    );
    ctx.restore();
  });

}

function drawMouthOnly({ ctx, landmarks, image }) {
  // const detailedMouthLandmarks = [
  //   291, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 323, 361, 291
  // ];
  const detailedMouthLandmarks = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

  ctx.save(); // S1
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save(); //S2
  const origin = landmarks[61];
  ctx.beginPath();
  ctx.moveTo(origin.x * canvas.width, origin.y * canvas.height);

  detailedMouthLandmarks.forEach((pt) => {
    ctx.lineTo(landmarks[pt].x * canvas.width, landmarks[pt].y * canvas.height);
  });

  ctx.closePath();
  ctx.clip();

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  // ctx.fillStyle = 'green';
  // detailedMouthLandmarks.forEach((pt) => {
  //   console.log(landmarks[pt].x * canvas.width, landmarks[pt].y * canvas.height);
  //   const x = landmarks[pt].x * canvas.width;
  //   const y = landmarks[pt].y * canvas.height;
  //   ctx.beginPath();
  //   ctx.arc(x, y, 2, 0, 2 * Math.PI);
  //   ctx.fill()
  //   ctx.fillText("g", x, y);
  // });

  ctx.restore(); //xS2
  ctx.restore(); //xS1
}
//

// function drawPenText(ctx, image) {
//   const prefix = "PEN ";
//
// }

function drawWord({ ctx, word = 'Pineapple' } = {}) {
  ctx.save();
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const padding = 16;
  const textWidth = ctx.measureText(word).width;
  const boxWidth = textWidth + (padding * 2);
  const boxHeight = 40;
  const boxPosition = {
    x: (canvas.width / 2) - (textWidth / 2) - padding,
    y: 0,
  }

  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0, 0, 0, .25)'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6;
  ctx.fillText(word, boxWidth / 2 + boxPosition.x, boxPosition.y + padding);

  ctx.restore();
}

run();

