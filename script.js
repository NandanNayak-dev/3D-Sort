// --- Configuration & State ---
const COLORS = {
  default: 0x00D1FF, // Cyan
  compare: 0xEAB308, // Yellow (Comparing)
  swap: 0xEF4444,    // Red (Swapping)
  sorted: 0x22C55E   // Green (Sorted)
};

let bars = [];
let isSorting = false;
let abortController = new AbortController();
let targetTiltX = 0; // Tracks the scroll tilt amount
let mouseX = 0;
let mouseY = 0;

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x00D1FF, 2, 50);
pointLight.position.set(0, -5, 10);
scene.add(pointLight);

const group = new THREE.Group();
scene.add(group);

// Floor grid (aesthetic)
const gridHelper = new THREE.GridHelper(100, 50, 0x1e293b, 0x1e293b);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

// --- Array Generation ---
function generateArray() {
  if (isSorting) {
    abortController.abort();
    abortController = new AbortController();
    isSorting = false;
    enableControls();
  }

  // Clear existing bars
  while(group.children.length > 0){ 
      group.remove(group.children[0]); 
  }
  bars = [];

  const size = parseInt(document.getElementById('size-slider').value);
  const spacing = size > 40 ? 0.9 : 1.2;
  const width = size > 40 ? 0.6 : 0.8;
  const startX = -((size - 1) * spacing) / 2;

  for (let i = 0; i < size; i++) {
    const value = Math.random() * 18 + 2; // heights between 2 and 20
    const geometry = new THREE.BoxGeometry(width, 1, width);
    // Translate geometry so scaling affects the top, anchoring the bottom
    geometry.translate(0, 0.5, 0);

    const material = new THREE.MeshPhongMaterial({ 
      color: COLORS.default,
      emissive: 0x004455,
      shininess: 80,
      transparent: true,
      opacity: 0.9
    });
    
    const bar = new THREE.Mesh(geometry, material);
    bar.position.x = startX + i * spacing;
    bar.position.y = 0;
    bar.scale.y = 0.01; // Start tiny for a pop-in animation
    
    // Add subtle edge geometry
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
    bar.add(line);
    
    bars.push({ mesh: bar, value: value, targetScale: value });
    group.add(bar);
  }
  
  // Adjust camera distance dynamically to fit all bars
  const totalWidth = size * spacing;
  // Calculate distance needed based on camera FOV (60 degrees) and screen aspect ratio
  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = (camera.fov / 2) * (Math.PI / 180);
  const distanceForWidth = (totalWidth / 2) / (Math.tan(fovRad) * aspect);
  const distanceForHeight = 25; // Minimum distance for height
  
  const targetZ = Math.max(distanceForHeight, distanceForWidth * 1.1); // 10% padding
  
  // Shift camera up and look higher so the bars appear lower on the screen
  camera.position.z = targetZ;
  camera.position.y = targetZ * 0.4;
  camera.lookAt(0, targetZ * 0.3, 0);
}

// --- Helpers ---
function getDelay() {
  const speed = parseInt(document.getElementById('speed-slider').value);
  return 505 - (speed * 5); // 1 => 500ms, 100 => 5ms
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function setBarColor(index, colorHex) {
  if(bars[index]) {
    bars[index].mesh.material.color.setHex(colorHex);
    
    // Adjust emissive for glow effect
    if(colorHex === COLORS.compare) bars[index].mesh.material.emissive.setHex(0x665500);
    else if(colorHex === COLORS.swap) bars[index].mesh.material.emissive.setHex(0x660000);
    else if(colorHex === COLORS.sorted) bars[index].mesh.material.emissive.setHex(0x004411);
    else bars[index].mesh.material.emissive.setHex(0x004455);
  }
}

async function swapBars(i, j, signal) {
  const tempVal = bars[i].value;
  bars[i].value = bars[j].value;
  bars[j].value = tempVal;

  bars[i].targetScale = bars[i].value;
  bars[j].targetScale = bars[j].value;
  
  await sleep(getDelay(), signal);
}

function disableControls() {
  document.getElementById('sort-btn').disabled = true;
  document.getElementById('algo-select').disabled = true;
  document.getElementById('size-slider').disabled = true;
}

function enableControls() {
  document.getElementById('sort-btn').disabled = false;
  document.getElementById('algo-select').disabled = false;
  document.getElementById('size-slider').disabled = false;
}

// --- Algorithms ---

// 1. Bubble Sort
async function bubbleSort(signal) {
  const n = bars.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      setBarColor(j, COLORS.compare);
      setBarColor(j+1, COLORS.compare);
      await sleep(getDelay(), signal);

      if (bars[j].value > bars[j+1].value) {
        setBarColor(j, COLORS.swap);
        setBarColor(j+1, COLORS.swap);
        await swapBars(j, j+1, signal);
      }

      setBarColor(j, COLORS.default);
      setBarColor(j+1, COLORS.default);
    }
    setBarColor(n - i - 1, COLORS.sorted);
  }
  setBarColor(0, COLORS.sorted);
}

// 2. Selection Sort
async function selectionSort(signal) {
  const n = bars.length;
  for (let i = 0; i < n; i++) {
    let minIdx = i;
    setBarColor(minIdx, COLORS.swap); 
    
    for (let j = i + 1; j < n; j++) {
      setBarColor(j, COLORS.compare);
      await sleep(getDelay(), signal);
      
      if (bars[j].value < bars[minIdx].value) {
        if(minIdx !== i) setBarColor(minIdx, COLORS.default);
        minIdx = j;
        setBarColor(minIdx, COLORS.swap);
      } else {
        setBarColor(j, COLORS.default);
      }
    }
    
    if (minIdx !== i) {
      await swapBars(i, minIdx, signal);
      setBarColor(minIdx, COLORS.default);
    }
    setBarColor(i, COLORS.sorted);
  }
}

// 3. Insertion Sort
async function insertionSort(signal) {
  const n = bars.length;
  setBarColor(0, COLORS.sorted);
  for (let i = 1; i < n; i++) {
    let j = i;
    setBarColor(j, COLORS.compare);
    await sleep(getDelay(), signal);

    while (j > 0 && bars[j-1].value > bars[j].value) {
      setBarColor(j, COLORS.swap);
      setBarColor(j-1, COLORS.swap);
      await swapBars(j, j-1, signal);
      
      setBarColor(j, COLORS.sorted);
      setBarColor(j-1, COLORS.sorted);
      j--;
    }
    setBarColor(j, COLORS.sorted);
  }
}

// 4. Merge Sort (In-place visual approximation)
async function mergeSortWrapper(signal) {
  await mergeSort(0, bars.length - 1, signal);
  for(let i=0; i<bars.length; i++) setBarColor(i, COLORS.sorted);
}

async function mergeSort(l, r, signal) {
  if (l >= r) return;
  const m = l + Math.floor((r - l) / 2);
  await mergeSort(l, m, signal);
  await mergeSort(m + 1, r, signal);
  await merge(l, m, r, signal);
}

async function merge(start, mid, end, signal) {
  let start2 = mid + 1;
  if (bars[mid].value <= bars[start2].value) {
    return;
  }
  
  while (start <= mid && start2 <= end) {
    setBarColor(start, COLORS.compare);
    setBarColor(start2, COLORS.compare);
    await sleep(getDelay(), signal);
    
    if (bars[start].value <= bars[start2].value) {
      setBarColor(start, COLORS.default);
      setBarColor(start2, COLORS.default);
      start++;
    } else {
      const value = bars[start2].value;
      let index = start2;
      
      setBarColor(index, COLORS.swap);
      
      // Shift elements to right
      while (index !== start) {
        bars[index].value = bars[index - 1].value;
        bars[index].targetScale = bars[index].value;
        index--;
        await sleep(getDelay()/3, signal);
      }
      bars[start].value = value;
      bars[start].targetScale = bars[start].value;
      
      setBarColor(start, COLORS.default);
      
      start++;
      mid++;
      start2++;
    }
  }
}

// --- Main Controller ---
async function startSort() {
  if (isSorting) return;
  
  isSorting = true;
  disableControls();
  
  // Reset colors if already sorted
  for (let i = 0; i < bars.length; i++) {
    setBarColor(i, COLORS.default);
  }

  const algo = document.getElementById('algo-select').value;
  const signal = abortController.signal;
  
  try {
    if (algo === 'bubble') await bubbleSort(signal);
    else if (algo === 'selection') await selectionSort(signal);
    else if (algo === 'insertion') await insertionSort(signal);
    else if (algo === 'merge') await mergeSortWrapper(signal);
  } catch(e) {
    if (e.name === 'AbortError') {
      console.log('Sorting aborted by user');
    } else {
      console.error(e);
    }
  }

  isSorting = false;
  enableControls();
}

// --- Event Listeners ---
document.getElementById('size-slider').addEventListener('input', (e) => {
  document.getElementById('size-label').textContent = e.target.value;
  generateArray();
});

document.getElementById('speed-slider').addEventListener('input', (e) => {
  let val = e.target.value;
  let label = val < 33 ? 'Slow' : val < 66 ? 'Medium' : 'Fast';
  document.getElementById('speed-label').textContent = label;
});

document.getElementById('generate-btn').addEventListener('click', generateArray);
document.getElementById('sort-btn').addEventListener('click', startSort);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update camera distance on resize to keep fit
  const size = parseInt(document.getElementById('size-slider').value);
  const spacing = size > 40 ? 0.9 : 1.2;
  const totalWidth = size * spacing;
  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = (camera.fov / 2) * (Math.PI / 180);
  const distanceForWidth = (totalWidth / 2) / (Math.tan(fovRad) * aspect);
  const targetZ = Math.max(25, distanceForWidth * 1.1);
  
  camera.position.z = targetZ;
  camera.position.y = targetZ * 0.4;
  camera.lookAt(0, targetZ * 0.3, 0);
});

// Scroll to tilt
window.addEventListener('wheel', (e) => {
  targetTiltX += e.deltaY * 0.001;
  // Clamp the tilt so it doesn't flip over (between looking up slightly and looking down)
  targetTiltX = Math.max(-0.2, Math.min(0.8, targetTiltX));
});

// Mouse tracking for parallax effect
window.addEventListener('mousemove', (e) => {
  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;
  mouseX = (e.clientX - windowHalfX) / windowHalfX; // -1 to 1
  mouseY = (e.clientY - windowHalfY) / windowHalfY; // -1 to 1
});

// --- Render Loop ---
function animate() {
  requestAnimationFrame(animate);
  
  // Combine scroll tilt and mouse parallax
  const targetX = targetTiltX + (mouseY * 0.1);
  const targetY = mouseX * 0.15;
  
  // Smoothly interpolate rotations
  group.rotation.x += (targetX - group.rotation.x) * 0.05;
  group.rotation.y += (targetY - group.rotation.y) * 0.05;

  // Smoothly animate bar heights
  const speed = parseInt(document.getElementById('speed-slider').value);
  // Faster lerp if speed is high
  const lerpFactor = 0.05 + (speed / 100) * 0.25; 
  
  bars.forEach(b => {
    if (Math.abs(b.mesh.scale.y - b.targetScale) > 0.01) {
      b.mesh.scale.y += (b.targetScale - b.mesh.scale.y) * lerpFactor;
    } else {
      b.mesh.scale.y = b.targetScale;
    }
  });

  renderer.render(scene, camera);
}

// --- Initialization ---
generateArray();
animate();
