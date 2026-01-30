
/* __________ @SEC: TODO IMPORTS __________ */
// 
// import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
// import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
//npm install @mediapipe/face_mesh @mediapipe/camera_utils @mediapipe/drawing_utils
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/* __________ @SEC: DOM CONSTANTS __________ */

const videoElement = document.getElementById('video');
let canvas = document.getElementById('c1');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('camera-select');
const btnStart = document.getElementById('video__start');
const btnStop = document.getElementById('video__stop');
const retrySection = document.querySelector('.retry');
const moustche = new Image();
moustche.src = './moustache.png';
const mainfont = new FontFace('Michroma', 'url("fonts/Michroma/Michroma-Regular.ttf")');
const headerFont = 'Michroma';
const systemFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

/* __________ @SEC: GAMESTATE  __________ */
// TODO: determine if showAction should be used, currently it's just set and unset but not checked for.
let showAction = false;
let currentActionIndex = -1;

let actionStartTime = 0;
const ACTION_INTERVAL = 5_000;
let actionsIntervalId = null;

const gameConfig = {
  smileLimit: 3,
  actionInterval: 8_000,
  graceTime: 3_000,
}

const gameState = {
  smileCount: 0,
  timeCutOff: false,
  activeSmile: false,
  showSmileText: false,
  gameOver: false,
  smilesLeft: 3,
  lastSmileTime: 0,
  gracePeriod: true,
  gameStartTime: 0,
  actionOrder: [],
}

function resetGameState() {
  gameState.smileCount = 0;
  gameState.timeCutOff = false;
  gameState.activeSmile = false;
  gameState.showSmileText = false;
  gameState.gameOver = false;
  gameState.smilesLeft = 3;
  gameState.lastSmileTime = 0;
  gameState.gracePeriod = true;
  gameState.gameStartTime = 0;
}

/* __________ @SEC: FaceMesh INIT __________ */
/* Doing this early to help with page load */

// Initialize FaceMesh solution
// const faceMesh = new FaceMesh({
//   locateFile: (file) =>
//     // `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
//     `./node_modules/@mediapipe/face_mesh/${file}`
// });
//
// faceMesh.setOptions({
//   maxNumFaces: 1,
//   refineLandmarks: false,
//   minDetectionConfidence: 0.5,
//   minTrackingConfidence: 0.5,
// });
//
// let faceMeshReady = false;
// await faceMesh.initialize();
// faceMeshReady = true;


// faceMesh.onResults(onResults);

let faceLandmarker = null;
async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFaceLandmarks: true,
  });
}

// faceLandmarker.onResults(onResults);

function detectSmile(results) {
  console.log(`results:\n`);
  console.log(results.faceBlendshapes);
  let isSmiling = false;
  if (results.faceBlendshapes?.length) {
    const blendshapes = results.faceBlendshapes[0];
    const smileLeft = blendshapes.categories[44]?.score || 0;
    console.log(blendshapes.categories[44]?.score);
    const smileRight = blendshapes.categories[45]?.score || 0;
    console.log(`smileLeft :${smileLeft}`);
    console.log(`smileRight :${smileRight}`);
    isSmiling = (smileLeft + smileRight) / 2 > 0.5;
  }
  return isSmiling;
}


/* __________ @SEC: SETUP - CAMERA  __________ */

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

// Start MediaPipe camera for a given deviceId
async function startCamera(deviceId) {
  // Reset camera/media pipe first
  if (camera) {
    camera.stop();
    camera = null;
  }

  if (videoElement.srcObject instanceof MediaStream) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
    videoElement.srcObject = null;
  }

  currentDeviceId = deviceId;

  try {

    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    await new Promise((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        videoElement.onloadedmetadata = null;
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        resolve();
      };
      videoElement.onerror = (e) => {
        videoElement.onerror = null;
        reject(e);
      }
    });

    await videoElement.play();
    camera = new Camera(videoElement, {
      onFrame: async () => {
        const results = faceLandmarker.detectForVideo(videoElement, performance.now());
        // console.log(`results:\n`);
        // console.log(results);
        if (results.faceLandmarks) {
          onResults(results);
        }
      },
      width: 640,
      height: 480,
    });
    camera.start();
    return true;
  }
  catch (err) {
    console.error('Failed to start camera:', err);
    // Make sure stream is cleaned up on failure
    if (videoElement.srcObject instanceof MediaStream) {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
      videoElement.srcObject = null;
    }
    return false; // failure
  }
  //
  // // MediaPipe Camera util accepts a video element and onFrame callback
  // camera = new Camera(videoElement, {
  //   onFrame: async () => {
  //     await faceMesh.send({ image: videoElement });
  //   },
  //   width: 640,
  //   height: 480,
  //   facingMode: 'user',
  //   deviceId: deviceId, // custom field; many people pass through constraints here
  // });
  //
  // camera.start();
}

// Simple wrappers for buttons
function handleStart() {
  // if (!faceMeshReady) {
  //   return;
  // }
  const selectedId = cameraSelect.value || currentDeviceId;
  if (selectedId) {
    const isStarted = startCamera(selectedId);
    if (isStarted) {
      gameState.gameStartTime = performance.now();
      gameState.actionOrder = createActionOrder();
      startActions();
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
      const intro = document.querySelector('.inital__wrapper');
      document.querySelector('.canvas__container').classList.remove('hidden');
      // intro.classList.add("hidden");
      fadeOut(intro)
    }
  }
  console.log("action order");
  console.log(createActionOrder());
}

function fadeOut(el, duration = 350) {
  el.classList.add("fadeout");
  setTimeout(() => {
    el.classList.add("hidden");
  }, duration);

}

function showInsturctions() {
  const el = document.querySelector('.instructions')
}


// function updateRetryState() {
//   btnStop.classList.toggle('hidden');
//   retrySection.classList.toggle('hidden');
// }

function showRetryState() {
  btnStop.classList.add('hidden');
  retrySection.classList.remove('hidden');
}

function hideRetryState() {
  btnStop.classList.remove('hidden');
  retrySection.classList.add('hidden');
}

function showFailStamp() {
  document.querySelector('.stamp__failed').classList.remove('hidden');
}

function hideFailStamp() {
  document.querySelector('.stamp__failed').classList.add('hidden');
}


function handleStop() {
  gameState.gameOver = true;
  if (camera) {
    camera.stop();
    camera = null;
  }
  if (actionsIntervalId) {
    clearInterval(actionsIntervalId);
    console.log(`removed active action interval id:${actionsIntervalId}`);
    actionsIntervalId = null;
  }
  showFailStamp();
  showRetryState();
}

function handleRetry() {
  hideRetryState();
  hideFailStamp();
  resetGameState();
  handleStart();
}


// When camera selection changes, restart with new device
cameraSelect.addEventListener('change', () => {
  const selectedId = cameraSelect.value;
  if (selectedId) startCamera(selectedId);
});

btnStart.addEventListener('click', handleStart);
btnStop.addEventListener('click', handleStop);
document.querySelector('#retry__btn').addEventListener('click', handleRetry);


/* __________ @SEC: UTILITIES __________ */
//
// Get the Euclidane distance between two points
// The points should have an x and y property
function eucDist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function getSmileScore(landmarks) {
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

  const score = (rightDiff + centerDiff + leftDiff) / (3 * widthDiff);

  return { score, rightDiff, centerDiff, leftDiff, widthDiff };
}


function normLandmark(pt, landmarks) {
  if (landmarks[pt]) {
    return { x: landmarks[pt].x * canvas.width, y: landmarks[pt].y * canvas.height }
  }
  else {
    return null;
  }
}

function getFaceOutlineBox({ landmarks }) {
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
}

function getFeatureExtents(featureArray, landmarks) {
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

  featureArray.forEach((pt) => {
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

}

function getFaceCenterRadius(landmarks) {
  const headTop = normLandmark(10, landmarks);
  const headBottom = normLandmark(152, landmarks);
  const scaleFactor = 1.1;
  return {
    x: (headTop.x + headBottom.x) / 2,
    y: (headTop.y + headBottom.y) / 2,
    r: (headTop.y - headBottom.y) * scaleFactor,
  }
}

function makeFacePath(ctx, landmarks, offset = { x: 0, y: 0 }) {
  const origin = 10;
  ctx.beginPath();

  faceOutlinePts.forEach((pt) => {
    let ptCoords = normLandmark(pt, landmarks);
    if (pt === origin) {
      ctx.moveTo(ptCoords.x - offset.x, ptCoords.y - offset.y);
    }
    else {
      ctx.lineTo(ptCoords.x - offset.x, ptCoords.y - offset.y);
    }
  });
  ctx.closePath();
}

function getOrbitAngle(startTime, radiansPerSecond = Math.PI * 2 / 4) {
  const elapsed = (performance.now() - startTime) / 1_000;
  return (radiansPerSecond * elapsed % Math.PI * 2);
};


function getFaceWidth({ landmarks }) {
  const leftCheek = normLandmark(50, landmarks);
  const rightCheek = normLandmark(280, landmarks);
  return Math.hypot(
    (rightCheek.x - leftCheek.x),
    (rightCheek.y - leftCheek.y),
  );
}

function getMouthWidth({ landmarks }) {
  const left = normLandmark(61, landmarks);
  const right = normLandmark(291, landmarks);
  return Math.hypot(
    (right.x - left.x),
    (right.y - left.y),
  );
}

function getFaceAngle({ landmarks }) {
  const left = normLandmark(33, landmarks);
  const right = normLandmark(263, landmarks);
  const dy = left.y - right.y;
  const dx = left.x - right.x;
  return Math.atan2(dy, dx);
}


/* __________ @SEC: RUNNERS __________ */

// Main entry
async function run() {
  // Ask for permission once so device labels are available
  await navigator.mediaDevices.getUserMedia({ video: true });
  await createFaceLandmarker();
  await listCameras();

  // startActions();
}

const tempAction = createPreviousFaceAction();
const flash = createFlash(200);

// Called whenever FaceMesh has new results
function onResults(results) {
  if (gameState.gameOver) return;
  canvas = document.getElementById('c1');
  const now = performance.now();
  // ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the mirrored image
  // ctx.save()
  // ctx.translate(canvas.width, 0);
  // ctx.scale(-1, 1);
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  // ctx.restore()
  // const tempDrawEmoji = makeEyeEmojiDrawer();

  if (results.faceLandmarks) {
    const landmarks = results.faceLandmarks[0]; // one face only
    console.log("landmarks");
    console.log(landmarks);


    // drawMouthPoints({ ctx, landmarks });
    // drawMoustacheEmoji(ctx, landmarks);

    //Draw Eye line
    // drawEyeLine(ctx, landmarks);
    addTimer({ ctx, startTime: gameState.gameStartTime });
    // tempAction({ ctx, landmarks, image: results.image, });
    // drawMoustache({ ctx, landmarks });
    // drawSeeThroughMouth({ ctx, landmarks, image: results.image });
    // drawEyeEmoji({ ctx, landmarks });
    // tempDrawEmoji({ ctx, landmarks });
    // drawEmojiAroundMouth({ ctx, landmarks });
    // drawMouthOnEyes({ ctx, landmarks, image: results.image });


    // Detect Smile
    // const { score, mouthWidth, mouthHeight } = getSmileScore(landmarks);
    // const { score, rightDiff, centerDiff, leftDiff, widthDiff } = getSmileScore(landmarks)
    // const isSmiling = score < 0.32 || (score > 0.49 && score < 0.75);
    let isSmiling = false;
    isSmiling = detectSmile(results);
    console.log(`is smiling? ${isSmiling}`);



    //Extract to handle smile
    // drawFaceUpsideDown(ctx, landmarks);
    // drawMouthOnly(ctx, landmarks, results.image);
    // drawMultiFace(ctx, landmarks, results.image);
    // draw3DOrbitingImage({ ctx, landmarks, startTime: gameState.gameStartTime });

    // if (!score) return;

    if (isSmiling) {
      const cx = ((MOUTH.LEFT.x + MOUTH.RIGHT.x) / 2) * canvas.width;
      const cy = MOUTH.UPPER_LIP.y * canvas.height - 10;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Undo mirror for correct text direction
      ctx.fillStyle = 'lime';
      ctx.fillText('Smile!', cx, cy);
      ctx.restore();
    }

    handleSmile(isSmiling, ctx);
    if (gameState.activeSmile) {
      gameState.showSmileText = true;
      setTimeout(() => {
        gameState.showSmileText = false;
      }, 2_000)
    }
    if (gameState.showSmileText) {
      addSmilingText(ctx);
    }
    updateGameState();
    if (gameState.gameOver) {
      handleGameOver();
    };

    drawSmilesLeft(ctx);
    addOverlay(ctx, landmarks, videoElement, now);
  }
}


function handleSmile(isSimling, ctx) {

  if (isSimling) {
    const now = performance.now();
    const SMILE_TIME_TOLERANCE = 850
    // Dislay similing text

    // Early return during grace period
    // Early return for smiles that were less than a second ago;
    if (gameState.gracePeriod || now - gameState.lastSmileTime < SMILE_TIME_TOLERANCE) {
      gameState.lastSmileTime = performance.now();
      return;
    }
    addSmilingText(ctx);

    console.log(`activeSmile: ${gameState.activeSmile}`);
    console.log(`lastSmileTime: ${gameState.lastSmileTime}`);
    if (!gameState.activeSmile) {
      gameState.smileCount++;
    }
    flash.triggerFlash();
    gameState.lastSmileTime = performance.now();
  }
  gameState.activeSmile = isSimling;

}

function makeJoke(duration = 5_000) {
  const lines = [
    'Knock Knock',
    'Who is there?',
    'KGB',
    'KGB Who?',
    'We\'ll be asking \nthe questions \naround here!',
  ]

  const startTime = performance.now();
  const totalTime = duration;
  const timePerLine = (totalTime) / lines.length / 1000;

  return function writeOutJokes() {
    const elapsed = (performance.now() - actionStartTime) / 1000;
    let currentLine = Math.floor(elapsed / timePerLine);
    if (currentLine >= lines.length) {
      currentLine = lines.length - 1;
    }
    // console.log(`startTime: ${startTime}`);
    // console.log(`elapsed: ${elapsed}, timePerLine: ${timePerLine}`);
    // console.log(`currentLine : ${currentLine}`);
    ctx.save();
    ctx.font = `16px ${headerFont}, ${systemFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const topPadding = 20;
    const lineHeight = 20;

    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0, 0, 0, .85)'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6;
    if (lines[currentLine].includes('\n')) {
      const sublines = lines[currentLine].split('\n');
      sublines.forEach((subline, i) => {
        ctx.fillText(subline, canvas.width / 2, topPadding + (i * lineHeight));
      });
    }
    else {
      ctx.fillText(lines[currentLine], canvas.width / 2, topPadding);
    }


    ctx.restore();

  }

  // function drawLine(t) {
  //   if (performance.now() - startTime >= totalTime) {
  //     if (animationId) {
  //       cancelAnimationFrame(animationId)
  //     }
  //   }
  //
  //
  //   requestAnimationFrame(drawLine);
  // }
  //
  // requestAnimationFrame(drawLine);
}

function updateGameState() {
  //Case 1 smile counts
  //Case 2 smile after cutoff time
  //Case 3 time is up
  gameState.smilesLeft = gameConfig.smileLimit - gameState.smileCount;
  console.log(gameState.smileCount);
  if (gameState.smileCount > gameConfig.smileLimit) {
    gameState.gameOver = true;
  }

  if (gameState.gracePeriod && (performance.now() - gameState.gameStartTime > gameConfig.graceTime)) {
    gameState.gracePeriod = false;
  }
}

function handleGameOver() {
  flash.drawFlash(ctx, canvas);
  console.log("Game over");
  setTimeout(handleStop, 500);
}


/* __________ @SEC: LANDMARK CONSTANTS __________ */

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


/* __________ @SEC: ACTION HELPERS __________ */

function startActions() {
  if (actionsIntervalId) {
    clearInterval(actionsIntervalId);
    console.log(`removed previous action interval id:${actionsIntervalId}`);
  }
  actionsIntervalId = setInterval(() => {
    if (performance.now() - gameState.gameStartTime < gameConfig.actionInterval) return;
    currentActionIndex = (currentActionIndex + 1) % (actions.length);
    console.log(`current action index: ${currentActionIndex}`);
    showAction = true;
    actionStartTime = performance.now();
  }, gameConfig.actionInterval)
  console.log(`Start action interval id ${actionsIntervalId}`);
}

function addOverlay(ctx, landmarks, image, currentTime) {

  const DEFAULT_DURATION = 2_500;

  if (currentActionIndex < 0 || !showAction) return;

  const action = actions[gameState.actionOrder[currentActionIndex]];

  if (action.config) {
    action.fn({ ctx, landmarks, image, ...action.config });
  }
  else {
    action.fn({ ctx, landmarks, image });
  }
  const actionDuration = action.duration ?? DEFAULT_DURATION;

  if ((currentTime - actionStartTime) > actionDuration) {
    // console.log(currentTime);
    // console.log("end of action");
    showAction = false;
  }
}

function createFlash(duration = 200) {
  let active = false;
  let alpha = 0;
  let startTime = 0

  function triggerFlash(now = performance.now()) {
    active = true;
    alpha = 1;
    startTime = now;
  }

  function drawFlash(ctx, canvas, now = performance.now()) {
    if (!active) return;

    const elapsed = now - startTime;
    const t = elapsed / duration;

    if (t >= 1) {
      active = false;
      alpha = 0;
      return;
    }

    const ease = 1 - ((1 - t) * (1 - t));
    alpha = 1 - ease;

    ctx.save()
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  return { triggerFlash, drawFlash };
}


/* __________ @SEC: SUPPORTING UI __________ */

function addSmilingText(ctx) {
  const MSG = 'YOU SMILED!';
  const FONT_SIZE = 24;
  ctx.save();
  ctx.font = `${FONT_SIZE}px ${headerFont}, ${systemFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const paddingX = 16;
  const paddingY = 80;
  const textWidth = ctx.measureText(MSG).width;
  const boxWidth = textWidth + (paddingX * 2);
  const boxPosition = {
    x: (canvas.width / 2) - (textWidth / 2) - paddingX,
    y: canvas.height - FONT_SIZE - paddingY,
  }

  ctx.fillStyle = gameState.gracePeriod ? 'rgba(232, 180, 22, 1)' : 'rgba(245, 60, 60, 1)';
  ctx.shadowColor = 'rgba(0, 0, 0, .65)';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 6;
  ctx.fillText(MSG, boxWidth / 2 + boxPosition.x, boxPosition.y);
  ctx.restore();
}

function drawSmilesLeft(ctx) {
  const xPosition = canvas.width / 2 - 20;
  const yPosition = canvas.height - 60;
  ctx.save();
  ctx.fillStyle = 'white';
  for (let i = 0; i < gameState.smilesLeft; i++) {
    // Based Circle
    ctx.beginPath();
    ctx.arc(xPosition + i * 20, yPosition, 8, 0, 2 * Math.PI);
    ctx.fill();
    //
    // Eyes
    ctx.save()
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(xPosition + 3 + i * 20, yPosition - 2, 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(xPosition - 3 + i * 20, yPosition - 2, 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Mouth
    ctx.save()
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 25 + i * 20, yPosition + 3);
    ctx.lineTo(canvas.width / 2 - 15 + i * 20, yPosition + 3);
    ctx.linewidth = 1;
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.restore();


    //Box during grace period
    if (gameState.gracePeriod) {
      ctx.save()
      ctx.beginPath();
      // 3 faces, with radius of 8, with 3px padding between
      const rectWidth = (3 * (8 * 2)) + (6 * 4);
      // face height + padding
      const rectHeight = (8 * 2) + (2 * 3);
      ctx.rect(xPosition - 16, yPosition - 11, rectWidth, rectHeight);
      ctx.strokeStyle = 'white';
      ctx.stroke();
      ctx.restore()
    }
  }
  ctx.restore();
}

function addTimer({ ctx, startTime }) {
  const elasped = performance.now() - startTime;
  const seconds = Math.floor(elasped / 1_000);
  const minutes = Math.floor(seconds / 60);
  // console.log(`${ minutes.toString().padStart(2, '0') }: ${(seconds % 60).toString().padStart(2, '0')} `);
  const text = `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')} `;

  ctx.save();
  ctx.font = `20px ${headerFont}, ${systemFont} `;
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0, 0, 0, .25)'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6;
  // ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2 - (ctx.measureText(text).width / 2), canvas.height - 20);

  ctx.restore();
  // console.log(text);
}


/* __________ @SEC: ACTIONS __________ */

const actions = [
  { fn: makeJoke(6_000), duration: 6_000, },
  { fn: drawFaceWord, config: { word: 'Coward' } },
  { fn: drawFaceWord, config: { word: 'Dingus' } },
  { fn: drawFaceWord, config: { word: 'Doofus' } },
  { fn: drawEmojiBelowNose },
  { fn: drawWord, duration_: 5_000, config: { word: 'MOIST' } },
  { fn: drawOrbitingImage, duration: 5_000, config: { startTime: performance.now() } },
  { fn: draw3DOrbitingImage, duration: 5_000, config: { startTime: performance.now() } },
  { fn: createPreviousFaceAction(), duration: 6_000, },
  { fn: drawFaceUpsideDown, duration: 6_000, },
  { fn: drawWord, duration: 5_000, config: { word: 'SMILE' } },
  { fn: drawWord, duration: 5_000, config: { word: 'SMILE FOR REAL' } },
  { fn: drawWord, duration: 5_000, config: { word: 'SMILE RIGHT NOW' } },
  { fn: drawMouthOnly, duration: 4_000, },
  { fn: drawMultiFace, duration: 4_000 },
  { fn: drawMoustache, duration: 4_000 },
  { fn: drawMouthOnEyes },
  { fn: drawSeeThroughMouth },
  { fn: drawEmojiAroundMouth },
  { fn: makeEyeEmojiDrawer(), duration: 6_000 },
  { fn: drawFaceWord, config: { word: 'Sus' } },
  // { fn: drawWord, duration: 3_000, config: { word: 'KNOCK KNOCK' } },
  // { fn: drawEyeLine },
  // drawMouthOnly(ctx, landmarks, results.image);
  // drawMultiFace(ctx, landmarks, results.image);
];

function createActionOrder() {
  const order = Array.from({ length: actions.length }, (_, i) => i);

  let i = order.length;
  while (--i > 0) {
    let j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function drawEmojiBelowNose({ ctx, landmarks, emoji = '🍤' } = {}) {
  // const moustachePoint = landmarks[164];
  // const moustacheX = moustachePoint.x * canvas.width;
  // const moustacheY = moustachePoint.y * canvas.height;
  const position = normLandmark(326, landmarks);
  const leftCheek = landmarks[50];
  const rightCheek = landmarks[280];
  const faceWidth = Math.hypot(
    (rightCheek.x - leftCheek.x) * canvas.width,
    (rightCheek.y - leftCheek.y) * canvas.height,
  );

  ctx.font = `${faceWidth * 0.2}px ${systemFont} `;
  ctx.fillText(emoji, position.x, position.y);
}

function drawMoustache({ ctx, landmarks }) {
  const moustachePoint = normLandmark(164, landmarks);
  const mouthWidth = getMouthWidth({ landmarks });
  const renderWidth = mouthWidth * 1.1;
  const renderHeight = moustche.height * (renderWidth / moustche.width);
  const angleRadians = getFaceAngle({ landmarks });

  ctx.save();
  ctx.translate(moustachePoint.x, moustachePoint.y);
  ctx.rotate(angleRadians);
  ctx.scale(1, -1);
  ctx.drawImage(moustche, -renderWidth / 2, 0, renderWidth, renderHeight);
  ctx.restore();

}

function drawFaceWord({ ctx, landmarks, word }) {
  const foreheadPoint = landmarks[151];
  const foreheadX = foreheadPoint.x * canvas.width;
  const foreheadY = foreheadPoint.y * canvas.height;
  const dy = landmarks[33].y * canvas.height - landmarks[263].y * canvas.height;
  const dx = landmarks[33].x * canvas.width - landmarks[263].x * canvas.width;
  const angleRadians = Math.atan2(dy, dx);

  ctx.save();
  // Let's change the canvas position to draw rotated
  ctx.font = `24px ${systemFont} `;
  ctx.translate(foreheadX, foreheadY);
  ctx.rotate(angleRadians);
  ctx.scale(-1, -1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.globalAlpha = 0.7;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeStyle = 'rgba(250, 250, 250, 0.95)';
  ctx.fillText(word, 0, 0);
  ctx.strokeText(word, 0, 0);
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

function drawFaceUpsideDown({ ctx, landmarks }) {
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

  // Restore canvas state to undo translation and rotation
  ctx.restore();
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

  ctx.restore(); //xS2
  ctx.restore(); //xS1
}

function getMouthOutline({ ctx, landmarks, offset = { x: 0, y: 0 } } = {}) {
  const detailedMouthLandmarks = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  const origin = landmarks[61];
  ctx.beginPath();
  ctx.moveTo(origin.x * canvas.width - offset.x, origin.y * canvas.height - offset.y);

  detailedMouthLandmarks.forEach((pt) => {
    ctx.lineTo(landmarks[pt].x * canvas.width - offset.x, landmarks[pt].y * canvas.height - offset.y);
  });
  ctx.closePath();
}

function drawSeeThroughMouth({ ctx, landmarks, image }) {
  ctx.save();
  getMouthOutline({ ctx, landmarks });
  ctx.clip();
  ctx.drawImage(image, normLandmark(33, landmarks).x, normLandmark(33, landmarks).y);
  ctx.restore();
}


function drawEmojiAroundMouth({ ctx, landmarks }) {
  const detailedMouthLandmarks = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

  const mouthBox = getFeatureExtents(detailedMouthLandmarks, landmarks);
  const midPoint = mouthBox.y + (mouthBox.h / 2);

  const emoji = '💩';
  for (let i = 0; i < detailedMouthLandmarks.length; i += 2) {
    const position = normLandmark(detailedMouthLandmarks[i], landmarks);
    ctx.save();
    ctx.font = `${mouthBox.h * 0.75}px Arial`;
    const offset = position.y > midPoint ? 5 : -5;
    ctx.translate(Math.round(position.x - (ctx.measureText(emoji).width / 2)), position.y + offset);
    console.log(`emoji width ${ctx.measureText(emoji).width} `);
    ctx.rotate(getFaceAngle({ landmarks }));
    ctx.scale(-1, -1);
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }
}


function drawMouthOnEyes({ ctx, landmarks, image }) {
  const detailedMouthLandmarks = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

  const mouthBox = getFeatureExtents(detailedMouthLandmarks, landmarks);

  const { left: leftEyeDimensions, right: rightEyeDimensions } = getEyeDimensions(landmarks);

  const eyePosition = {
    left: normLandmark(33, landmarks),
    right: normLandmark(362, landmarks)
  }


  const leftScale = leftEyeDimensions.h / leftEyeDimensions.w;
  const rightScale = rightEyeDimensions.h / rightEyeDimensions.w;

  const mouthScale = mouthBox.w / mouthBox.h;
  const leftRenderWidth = leftEyeDimensions.h * mouthScale;

  const destPosition = {
    left: {
      x: eyePosition.left.x + (leftEyeDimensions.w / 2) - (mouthBox.w / 2),
      y: eyePosition.left.y + (leftEyeDimensions.h / 2) - (mouthBox.h / 2) - 4,
    },

    right: {
      x: eyePosition.right.x + (rightEyeDimensions.w / 2) - (mouthBox.w / 2),
      y: eyePosition.right.y + (rightEyeDimensions.h / 2) - (mouthBox.h / 2) - 4,
    }
  }

  const mouthOffset = {
    x: mouthBox.x - (mouthBox.w / 2),
    y: mouthBox.y - (mouthBox.w / 2),
  }


  console.log(`Redner width: ${leftRenderWidth} `);

  console.log(mouthOffset);

  // Left Eye
  ctx.save();
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(destPosition.left.x, destPosition.left.y)
  console.log(destPosition.left);
  // The problem is that the mouthoutline happens without accounting for the trasnalte above, so need to offset the position x  and y  by the mouthBox x and y (position.left.x - mouthBox.x);
  getMouthOutline({ ctx, landmarks, offset: { x: mouthBox.x, y: mouthBox.y } });
  ctx.strokeStyle = "red";
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(
    image,
    mouthBox.x, mouthBox.y, mouthBox.w, mouthBox.h,
    0, 0, mouthBox.w, mouthBox.h
  );
  ctx.restore();

  // Right Eye
  ctx.save();
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(destPosition.right.x, destPosition.right.y)
  console.log(destPosition.right);
  // The problem is that the mouthoutline happens without accounting for the trasnalte above, so need to offset the position x  and y  by the mouthBox x and y (position.left.x - mouthBox.x);
  getMouthOutline({ ctx, landmarks, offset: { x: mouthBox.x, y: mouthBox.y } });
  ctx.strokeStyle = "red";
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(
    image,
    mouthBox.x, mouthBox.y, mouthBox.w, mouthBox.h,
    0, 0, mouthBox.w, mouthBox.h
  );
  ctx.restore();
}

function getEyeDimensions(landmarks) {
  const leftEye = {
    west: normLandmark(33, landmarks),
    east: normLandmark(133, landmarks),
    north: normLandmark(159, landmarks),
    south: normLandmark(145, landmarks)
  }
  const rightEye = {
    west: normLandmark(362, landmarks),
    east: normLandmark(263, landmarks),
    north: normLandmark(386, landmarks),
    south: normLandmark(374, landmarks),
  }

  return {
    left: {
      w: Math.abs(leftEye.west.x - leftEye.east.x),
      h: Math.abs(leftEye.north.y - leftEye.south.y),
    },
    right: {
      w: Math.abs(rightEye.west.x - rightEye.east.x),
      h: Math.abs(rightEye.north.y - rightEye.south.y)
    }
  }
}

function makeEyeEmojiDrawer() {
  const TOLERANCE = 2;
  const SMOOTH_FACTOR = 0.8;

  const lastFontSize = {
    left: 0,
    right: 0,
  };

  const lastPosition = {
    left: { x: null, y: null },
    right: { x: null, y: null },
  }

  function smoothPosition(current, prev) {
    if (prev.x == null || prev.y == null) return current;

    return {
      x: (prev.x * (1 - SMOOTH_FACTOR)) + (current.x * SMOOTH_FACTOR),
      y: (prev.y * (1 - SMOOTH_FACTOR)) + (current.y * SMOOTH_FACTOR),
    }

  }

  return function drawEyeEmoji({ ctx, landmarks }) {
    // const eyeEmoji = '👀';
    const eyeEmoji = '👁️';
    const leftEye = {
      top: normLandmark(159, landmarks),
      bottom: normLandmark(145, landmarks),
    }
    const rightEye = {
      top: normLandmark(386, landmarks),
      bottom: normLandmark(374, landmarks),
    }

    const rawLeftEyeCenter = {
      x: (leftEye.top.x + leftEye.bottom.x) / 2,
      y: (leftEye.top.y + leftEye.bottom.y) / 2,
    }

    const rawRightEyeCenter = {
      x: (rightEye.top.x + rightEye.bottom.x) / 2,
      y: (rightEye.top.y + rightEye.bottom.y) / 2,
    }

    const leftEyeCenter = smoothPosition(rawLeftEyeCenter, lastPosition.left);
    const rightEyeCenter = smoothPosition(rawRightEyeCenter, lastPosition.right);

    lastPosition.left = leftEyeCenter;
    lastPosition.right = rightEyeCenter;

    const newFontSize = {
      left: Math.floor(eucDist(leftEye.top, leftEye.bottom)),
      right: Math.floor(eucDist(rightEye.top, rightEye.bottom)),
    }

    let lHeight, rHeight;
    if (newFontSize.left > lastFontSize.left + TOLERANCE) {
      lastFontSize.left = newFontSize.left;
      lHeight = newFontSize.left;
    }
    else {
      lHeight = lastFontSize.left;
    }

    if (newFontSize.right > lastFontSize.right + TOLERANCE) {
      lastFontSize.right = newFontSize.right;
      rHeight = newFontSize.right;
    }
    else {
      rHeight = lastFontSize.right;
    }

    // const lHeight = newFontSize.left > lastFontSize.left + 1 ? 
    // const rHeight = Math.floor(eucDist(rightEye.top, rightEye.bottom));


    //Left side
    ctx.save();
    ctx.font = `${lHeight * 3}px Arial`;
    console.log(`${lHeight}px Arial`);
    ctx.translate(
      // Math.round(leftEyeCenter.x + (ctx.measureText(eyeEmoji).width / 2)),
      Math.round(leftEyeCenter.x + (ctx.measureText(eyeEmoji).width / 2)),
      Math.round(leftEyeCenter.y) - 10
    );
    ctx.rotate(getFaceAngle({ landmarks }));
    ctx.scale(1, 1);
    ctx.fillText(eyeEmoji, 0, 0);
    ctx.restore();

    //Right side
    ctx.save();
    ctx.font = `${rHeight * 3}px Arial`;
    console.log(`${rHeight}px Arial`);
    console.log(`${rightEyeCenter.y.toFixed((2))}px y position`);
    ctx.translate(
      Math.round(rightEyeCenter.x - (ctx.measureText(eyeEmoji).width / 2)),
      Math.round(rightEyeCenter.y) + 10,
    );
    ctx.rotate(getFaceAngle({ landmarks }));
    ctx.scale(-1, -1);
    ctx.fillText('👁️', 0, 0);
    ctx.restore();
  }
}

function drawWord({ ctx, word = 'Pineapple' } = {}) {
  ctx.save();
  const fontSize = window.innerWidth > 640 ? 24 : 18;
  ctx.font = `${fontSize}px ${headerFont}, ${systemFont} `;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const padding = 16;
  const textWidth = ctx.measureText(word).width;
  const boxWidth = textWidth + (padding * 2);
  const boxPosition = {
    x: (canvas.width / 2) - (textWidth / 2) - padding,
    y: 0,
  }

  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0, 0, 0, .85)'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6;
  ctx.fillText(word, boxWidth / 2 + boxPosition.x, boxPosition.y + padding);

  ctx.restore();
}

function drawOrbitingImage({ ctx, landmarks, moon = '🌭', startTime } = {}) {
  const { x: cx, y: cy, r } = getFaceCenterRadius(landmarks);
  const angle = getOrbitAngle(startTime);
  const RADIUS_SCALE = 0.6;

  const mx = cx + r * Math.cos(angle) * RADIUS_SCALE;
  const my = cy + r * Math.sin(angle) * RADIUS_SCALE;

  ctx.save();
  ctx.font = "58px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(moon, mx, my);
  ctx.restore();
}

function draw3DOrbitingImage({ ctx, landmarks, moon = '🦆', startTime } = {}) {
  const { x: cx, y: cy, r } = getFaceCenterRadius(landmarks);
  const angle = getOrbitAngle(startTime);

  const mx = cx + r * Math.cos(angle);
  const my = cy + r * Math.sin(angle) * -0.2; // Flatten to a smaller radius

  const t = (Math.sin(angle) + 1) / 2 // Normalize from -1>1 to 0>1
  const scale = 0.2 + 0.8 * t // Scale from 0.2 to 1


  const baseSize = 52;
  const scaledSize = baseSize * scale;

  ctx.save();
  // ctx.font = '40px Arial';
  ctx.font = `${scaledSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(moon, mx, my);
  ctx.restore();
  if (Math.sin(angle) < 0) {
    ctx.save();
    makeFacePath(ctx, landmarks);
    ctx.clip();
    ctx.drawImage(
      video,
      0, 0, canvas.width, canvas.height,  // source rectangle from video
      0, 0, canvas.width, canvas.height   // destination rectangle inside transformed context
    );
    ctx.restore();
  }
}


function createPreviousFaceAction() {
  const state = {
    prevCanvas: null,
    prevCtx: null,
    prevFaceBox: null,
    lastFrameTime: null,
  }

  return function drawPreviousFaces({ ctx, landmarks, image, }) {
    const faceBox = getFaceOutlineBox({ ctx, landmarks });
    const FRAME_INTERVAL = 62;

    if (!state.prevCanvas) {
      state.prevCanvas = document.createElement('canvas');
      state.prevCtx = state.prevCanvas.getContext('2d');
      state.prevCanvas.width = canvas.width;
      state.prevCanvas.height = canvas.height;
    }

    if (!state.lastFrameTime || performance.now() - state.lastFrameTime > FRAME_INTERVAL) {
      state.prevCtx.save();
      state.prevCtx.globalAlpha = 0.65;

      makeFacePath(state.prevCtx, landmarks);
      state.prevCtx.clip();

      const OFFSET_X = 20;
      state.prevCtx.drawImage(
        image,
        faceBox.x, faceBox.y, faceBox.w, faceBox.h,
        faceBox.x + OFFSET_X, faceBox.y, faceBox.w, faceBox.h
      );
      state.prevCtx.restore();

      state.prevFaceBox = faceBox;
      state.lastFrameTime = performance.now();
    }


    if (state.prevFaceBox && state.prevCanvas.width > 0) {
      const c2 = document.getElementById('c2');
      const ctx2 = c2.getContext("2d");
      // ctx.fillStyle = "red";
      // ctx.fillRect(0, 0, 200, 200);
      ctx.save();
      ctx.globalAlpha = 0.8;
      // ctx.drawImage(
      //   state.prevCanvas,
      //   state.prevFaceBox.x, state.prevFaceBox.y,
      //   state.prevFaceBox.w, state.prevFaceBox.h
      // );
      // ctx.drawImage(
      //   state.prevCanvas,
      //   state.prevFaceBox.x + 20, state.prevFaceBox.y + 20,
      //   state.prevFaceBox.w, state.prevFaceBox.h
      // );
      ctx.drawImage(state.prevCanvas, 0, 0);
      ctx.restore();
    }
  }
}


/* __________ @SEC: RUN __________ */
run();


/* __________ @SEC: TODO / ARCHIVE JITTER __________ */


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


