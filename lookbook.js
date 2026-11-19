"use strict";

const looks = [
  {
    id: "01",
    name: "산들 코어",
    category: "도시형 카고 스타일",
    description: "블랙 민소매 톱에 올리브 카고 조거 팬츠를 매치했습니다. 샌드 컬러 크로스백과 아이보리 부츠가 대비를 더합니다.",
    colors: [["블랙", "#252523"], ["올리브", "#706d54"], ["샌드 베이지", "#b4a38d"]],
    tile: "#e9e2d8",
    frame: "#e9ebeb",
    products: [
      ["top", "블랙 크롭 민소매 톱", "상의", "블랙"],
      ["pants", "올리브 카고 조거 팬츠", "하의", "올리브"],
      ["bag", "샌드 크로스백", "가방", "샌드 베이지"],
      ["boots", "아이보리 레이스업 부츠", "신발", "아이보리"],
      ["headband", "블랙 헤드밴드", "액세서리", "블랙"],
    ],
  },
  {
    id: "02",
    name: "샌드 카고",
    category: "와이드 카고 스타일",
    description: "브라운 크롭 탱크톱과 베이지 와이드 카고 팬츠를 매치했습니다. 화이트 스니커즈가 따뜻한 색 조합을 가볍게 마무리합니다.",
    colors: [["브라운", "#5a3f30"], ["베이지", "#cbb28a"], ["화이트", "#f4f3ee"]],
    tile: "#ece6db",
    frame: "#efefef",
    products: [
      ["top", "브라운 크롭 탱크톱", "상의", "브라운"],
      ["pants", "베이지 와이드 카고 팬츠", "하의", "베이지"],
      ["sneakers", "화이트 로우톱 스니커즈", "신발", "화이트"],
    ],
  },
  {
    id: "03",
    name: "소프트 뉴트럴",
    category: "뉴트럴 캐주얼",
    description: "회갈색 반소매 니트에 아이보리 와이드 팬츠를 매치했습니다. 그래픽 토트백과 볼캡으로 편안한 캐주얼 룩을 완성했습니다.",
    colors: [["회갈색", "#a39584"], ["아이보리", "#eadfce"], ["화이트", "#f5f4ee"]],
    tile: "#fff",
    frame: "#e4e4e3",
    products: [
      ["knit", "회갈색 반소매 니트 폴로", "상의", "회갈색"],
      ["pants", "아이보리 와이드 팬츠", "하의", "아이보리"],
      ["tote", "그래픽 토트백", "가방", "아이보리"],
      ["cap", "아이보리 레터링 볼캡", "액세서리", "아이보리"],
      ["sneakers", "화이트 로우톱 스니커즈", "신발", "화이트"],
    ],
  },
];

const byId = (id) => document.getElementById(id);
const stage = byId("stage");
const editorial = document.querySelector(".editorial");
const video = byId("look-video");
const scrubber = byId("scrubber");
const flatlay = byId("flatlay");
const poster = byId("poster");
const progress = byId("progress-fill");
const playButton = byId("play-button");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const soundToggle = document.querySelector(".sound-toggle");
const lookList = byId("look-list");
const trigger = byId("products-trigger");
const sheet = byId("product-sheet");
const sheetScroll = byId("sheet-scroll");
const grid = byId("product-grid");
const detail = byId("product-detail");
const detailImage = byId("product-image");
const back = byId("sheet-back");
const closeButton = byId("sheet-close");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const Audio = window.AudioContext || window.webkitAudioContext;

const frameStep = 1 / 24;
const seekInterval = 1000 / 30;
const transitionDuration = 760;
const rotationSensitivity = 1.55;
let current = -1;
let soundEnabled = false;
let audio;
let sampledTone;
let drag;
let seekFrame = 0;
let targetTime = null;
let lastSeek = -Infinity;
let transitionFrame = 0;
let transitionTarget = null;
let detailTrigger;
let listScroll = 0;
let backdropPressed = false;

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function rotateTime(seconds) {
  const duration = video.duration;
  return ((seconds % duration) + duration) % duration;
}

function seek(time, approximate = false) {
  try {
    if (approximate && typeof video.fastSeek === "function") {
      video.fastSeek(time);
    } else {
      video.currentTime = time;
    }
  } catch {
    // 소스가 교체되는 동안은 다음 입력에서 탐색을 이어간다.
  }
}

function updateProgress() {
  const ratio = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(1, video.currentTime / video.duration)
    : 0;
  const percent = Math.round(ratio * 100);
  progress.style.transform = `scaleX(${ratio})`;
  scrubber.setAttribute("aria-valuenow", String(percent));
  scrubber.setAttribute("aria-valuetext", `영상의 ${percent}%`);
}

function updatePlayButton() {
  const playing = !video.paused;
  playButton.classList.toggle("is-playing", playing);
  const action = playing ? "정지" : "재생";
  byId("play-label").textContent = action;
  playButton.setAttribute("aria-label", `착장 영상 ${action}`);
}

async function playVideo() {
  try {
    await video.play();
  } catch {
    updatePlayButton();
  }
}

function updateMediaControls() {
  const showingPhoto = stage.dataset.mode === "photo";
  const failed = stage.dataset.state === "error";
  const busy = transitionTarget !== null;
  const ready = stage.dataset.state === "ready" && !showingPhoto && !busy;
  playButton.hidden = showingPhoto || failed;
  playButton.disabled = !ready;
  scrubber.hidden = !ready;
  flatlay.hidden = !showingPhoto && !failed;
  byId("media-badge").textContent = showingPhoto || failed ? "구성 사진" : "360°";
  byId("media-feedback").hidden = showingPhoto || !failed;
  byId("retry-video").hidden = !failed;
  byId("media-status").textContent = failed ? "영상을 열지 못했습니다." : "";
  stage.setAttribute("aria-busy", String(!showingPhoto && (busy || stage.dataset.state === "loading")));
}

function updateTheme() {
  const look = looks[current];
  const showingPhoto = stage.dataset.mode === "photo" || stage.dataset.state === "error";
  const tone = showingPhoto ? look.tile : sampledTone || look.frame;
  stage.style.setProperty("--frame-tone", tone);
  stage.style.setProperty("--frame-paper", `color-mix(in srgb, ${tone} 68%, var(--background))`);
}

function sampleVideoTone() {
  const width = 48;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  try {
    context.drawImage(video, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    const channels = [[], [], []];
    const side = Math.round(width * 0.12);
    const top = Math.round(height * 0.06);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (y >= top && x >= side && x < width - side) continue;
        const offset = (y * width + x) * 4;
        channels.forEach((values, channel) => values.push(data[offset + channel]));
      }
    }
    sampledTone = `rgb(${channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]).join(" ")})`;
  } catch {
    sampledTone = null;
  }
}

function setMode(mode) {
  if (mode === stage.dataset.mode) return;
  abortDrag();
  video.pause();
  const queued = transitionTarget;
  cancelTransition();
  stage.dataset.mode = mode;
  modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  if (queued !== null) selectLook(queued, "push");
  updateMediaControls();
  updateTheme();
}

function renderNavigation() {
  return looks.map((look, index) => {
    const card = element("button", "look-card");
    card.type = "button";
    card.dataset.look = look.id;
    card.style.setProperty("--tile", look.tile);
    const image = element("img", "look-card-image");
    image.loading = "lazy";
    image.decoding = "async";
    image.src = `assets/${look.id}-flatlay.webp`;
    image.alt = "";
    card.append(image, element("span", "look-card-label", look.name));
    card.addEventListener("click", (event) => requestLook(index, event.isTrusted && event.detail > 0));
    lookList.append(card);
    return card;
  });
}

function updateNavigation(look) {
  navButtons.forEach((button) => {
    const active = button.dataset.look === look.id;
    button.setAttribute("aria-pressed", String(active));
    if (active) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  byId("look-count").textContent = `${look.id} / ${String(looks.length).padStart(2, "0")}`;
}

function updateLookCopy(look) {
  byId("look-category").textContent = look.category;
  byId("look-title").textContent = look.name;
  byId("look-description").textContent = look.description;
  const colors = look.colors.map(([label, hex]) => {
    const chip = element("li");
    const swatch = element("span", "swatch");
    swatch.style.setProperty("--swatch", hex);
    swatch.setAttribute("aria-hidden", "true");
    chip.append(swatch, document.createTextNode(label));
    return chip;
  });
  byId("look-colors").replaceChildren(...colors);
}

function updateVideo(look) {
  abortDrag();
  video.pause();
  sampledTone = null;
  stage.dataset.state = "loading";
  poster.src = `assets/${look.id}-poster.webp`;
  flatlay.src = `assets/${look.id}-flatlay.webp`;
  flatlay.alt = `${look.name}의 의상과 소품을 펼쳐 놓은 사진`;
  video.src = `assets/${look.id}_02_scrub.mp4`;
  video.load();
  updateProgress();
  updatePlayButton();
  updateMediaControls();
  updateTheme();
}

function updateUrl(look, operation) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("look") === look.id && !url.hash.startsWith("#look=")) return;
  url.searchParams.set("look", look.id);
  if (url.hash.startsWith("#look=")) url.hash = "";
  try {
    history[`${operation}State`](null, "", url);
  } catch {
    const hash = `#look=${look.id}`;
    if (window.location.hash !== hash) {
      if (operation === "replace") window.location.replace(hash);
      else window.location.hash = hash;
    }
  }
}

function indexFromUrl() {
  const hash = window.location.hash;
  const id = hash.startsWith("#look=")
    ? new URLSearchParams(hash.slice(1)).get("look")
    : new URLSearchParams(window.location.search).get("look");
  return Math.max(0, looks.findIndex((look) => look.id === id));
}

function selectLook(index, operation) {
  const look = looks[index];
  if (index !== current) {
    current = index;
    if (sheet.open) sheet.close();
    updateNavigation(look);
    updateLookCopy(look);
    byId("products-trigger-label").textContent = `이 착장의 제품 ${look.products.length}개 보기`;
    trigger.disabled = false;
    updateVideo(look);
  }
  if (operation) updateUrl(look, operation);
}

function setTransitionBusy(busy) {
  stage.classList.toggle("is-changing", busy);
  editorial.setAttribute("aria-busy", String(busy));
  updateMediaControls();
}

function cancelTransition() {
  if (transitionTarget === null) return;
  cancelAnimationFrame(transitionFrame);
  transitionFrame = 0;
  transitionTarget = null;
  setTransitionBusy(false);
}

function requestLook(index, fromPointer) {
  if (transitionTarget !== null) {
    transitionTarget = index;
    return;
  }
  if (index === current) return;
  if (reducedMotion.matches || stage.dataset.mode !== "video" || stage.dataset.state !== "ready") {
    selectLook(index, "push");
    return;
  }
  if (fromPointer && soundEnabled) playWhoosh();
  abortDrag();
  video.pause();
  transitionTarget = index;
  setTransitionBusy(true);
  const startTime = video.currentTime;
  let started;
  let lastFrame = -Infinity;
  const animate = (now) => {
    started ??= now;
    const elapsed = (now - started) / transitionDuration;
    if (elapsed >= 1) {
      const target = transitionTarget;
      cancelTransition();
      selectLook(target, "push");
      return;
    }
    if (now - lastFrame >= seekInterval - 2) {
      const eased = elapsed < 0.5 ? 16 * elapsed ** 5 : 1 - (-2 * elapsed + 2) ** 5 / 2;
      seek(rotateTime(startTime + video.duration * 1.4 * eased), true);
      lastFrame = now;
    }
    transitionFrame = requestAnimationFrame(animate);
  };
  transitionFrame = requestAnimationFrame(animate);
}

function flushSeek(now) {
  seekFrame = 0;
  if (targetTime === null) return;
  if (now - lastSeek < seekInterval - 2) {
    seekFrame = requestAnimationFrame(flushSeek);
    return;
  }
  seek(targetTime, true);
  lastSeek = now;
}

function abortDrag() {
  if (!drag) return;
  const pointerId = drag.id;
  drag = null;
  targetTime = null;
  cancelAnimationFrame(seekFrame);
  seekFrame = 0;
  scrubber.classList.remove("is-dragging");
  if (scrubber.hasPointerCapture(pointerId)) scrubber.releasePointerCapture(pointerId);
}

function startDrag(event) {
  if (!event.isPrimary || event.button !== 0 || drag || !Number.isFinite(video.duration)) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    width: scrubber.clientWidth,
    time: video.currentTime,
    wasPlaying: !video.paused,
  };
  lastSeek = -Infinity;
  video.pause();
  scrubber.setPointerCapture(event.pointerId);
  scrubber.classList.add("is-dragging");
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const distance = event.clientX - drag.x;
  if (Math.abs(distance) < 3 && targetTime === null) return;
  targetTime = rotateTime(drag.time + distance / drag.width * video.duration * rotationSensitivity);
  if (!seekFrame) seekFrame = requestAnimationFrame(flushSeek);
}

function finishDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const resume = drag.wasPlaying;
  if (targetTime !== null) seek(targetTime);
  abortDrag();
  if (resume && !document.hidden) playVideo();
}

function scrubWithKeyboard(event) {
  const { key, shiftKey } = event;
  const delta = shiftKey ? 0.6 : frameStep;
  const times = {
    ArrowLeft: rotateTime(video.currentTime - delta),
    ArrowRight: rotateTime(video.currentTime + delta),
    ArrowDown: rotateTime(video.currentTime - delta),
    ArrowUp: rotateTime(video.currentTime + delta),
    Home: 0,
    End: Math.max(0, video.duration - frameStep),
  };
  if (!Object.hasOwn(times, key)) return;
  event.preventDefault();
  video.pause();
  seek(times[key]);
}

function updateSoundButton() {
  soundToggle.hidden = !Audio || reducedMotion.matches;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  byId("sound-label").textContent = soundEnabled ? "전환음 켜짐" : "전환음 꺼짐";
}

async function playWhoosh() {
  try {
    audio ??= new Audio();
    await audio.resume();
    if (!soundEnabled || document.hidden || reducedMotion.matches) return;
    const duration = 0.42;
    const length = Math.round(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const noise = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) noise[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    const start = audio.currentTime;
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(420, start);
    filter.frequency.exponentialRampToValueAtTime(1700, start + 0.15);
    filter.frequency.exponentialRampToValueAtTime(550, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(start);
  } catch {
    // 오디오 재생 권한과 관계없이 착장은 전환한다.
  }
}

function showProductList() {
  const look = looks[current];
  byId("sheet-caption").textContent = look.name;
  byId("sheet-title").textContent = `착장 제품 ${look.products.length}개`;
  back.hidden = true;
  detail.hidden = true;
  detailImage.removeAttribute("src");
  grid.hidden = false;
  sheetScroll.scrollTop = listScroll;
  detailTrigger?.focus({ preventScroll: true });
}

function showProduct(product, card) {
  const [key, name, category, color] = product;
  listScroll = sheetScroll.scrollTop;
  detailTrigger = card;
  byId("sheet-caption").textContent = `${category} · ${color}`;
  byId("sheet-title").textContent = name;
  detailImage.src = `assets/products/${looks[current].id}-${key}.webp`;
  detailImage.alt = name;
  grid.hidden = true;
  detail.hidden = false;
  back.hidden = false;
  sheetScroll.scrollTop = 0;
  back.focus();
}

function renderProducts(look) {
  const cards = look.products.map((product) => {
    const [key, name, category, color] = product;
    const item = element("li");
    const card = element("button", "product-card");
    card.type = "button";
    card.style.setProperty("--tile", look.tile);
    card.setAttribute("aria-label", `${name} 사진 확대`);
    const image = element("img");
    image.src = `assets/products/${look.id}-${key}.webp`;
    image.alt = "";
    image.decoding = "async";
    const meta = element("span", "product-meta");
    meta.append(element("small", "", `${category} · ${color}`), element("strong", "", name));
    card.append(image, meta);
    card.addEventListener("click", () => showProduct(product, card));
    item.append(card);
    return item;
  });
  grid.replaceChildren(...cards);
}

const navButtons = renderNavigation();
lookList.addEventListener("keydown", (event) => {
  const index = navButtons.indexOf(event.target);
  if (index === -1) return;
  const next = {
    ArrowLeft: (index - 1 + looks.length) % looks.length,
    ArrowRight: (index + 1) % looks.length,
    Home: 0,
    End: looks.length - 1,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  navButtons[next].focus();
  requestLook(next, false);
});

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();
});
playButton.addEventListener("click", () => {
  if (video.paused) playVideo();
  else video.pause();
});
video.addEventListener("loadeddata", () => {
  stage.dataset.state = "ready";
  sampleVideoTone();
  updateTheme();
  updateMediaControls();
  updateProgress();
});
video.addEventListener("error", () => {
  abortDrag();
  cancelTransition();
  stage.dataset.state = "error";
  updateMediaControls();
  updateTheme();
});
video.addEventListener("timeupdate", updateProgress);
video.addEventListener("play", updatePlayButton);
video.addEventListener("pause", updatePlayButton);
byId("retry-video").addEventListener("click", () => updateVideo(looks[current]));

scrubber.addEventListener("pointerdown", startDrag);
scrubber.addEventListener("pointermove", moveDrag);
["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => scrubber.addEventListener(type, finishDrag));
scrubber.addEventListener("keydown", scrubWithKeyboard);

trigger.addEventListener("click", () => {
  if (transitionTarget !== null) {
    const queued = transitionTarget;
    cancelTransition();
    selectLook(queued, "push");
  }
  video.pause();
  renderProducts(looks[current]);
  listScroll = 0;
  detailTrigger = null;
  showProductList();
  sheet.showModal();
  document.documentElement.classList.add("sheet-open");
});
back.addEventListener("click", showProductList);
closeButton.addEventListener("click", () => sheet.close());
sheet.addEventListener("pointerdown", (event) => { backdropPressed = event.target === sheet; });
sheet.addEventListener("click", (event) => {
  if (backdropPressed && event.target === sheet) sheet.close();
  backdropPressed = false;
});
sheet.addEventListener("close", () => {
  if (sheet.open) return;
  document.documentElement.classList.remove("sheet-open");
  trigger.focus({ preventScroll: true });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  abortDrag();
  video.pause();
  if (transitionTarget === null) return;
  const queued = transitionTarget;
  cancelTransition();
  selectLook(queued, "push");
});
reducedMotion.addEventListener("change", () => {
  updateSoundButton();
  if (!reducedMotion.matches) return;
  video.pause();
  if (transitionTarget === null) return;
  const queued = transitionTarget;
  cancelTransition();
  selectLook(queued, "push");
});

function restoreLook() {
  cancelTransition();
  selectLook(indexFromUrl());
}
window.addEventListener("popstate", restoreLook);
window.addEventListener("hashchange", restoreLook);
updateSoundButton();
selectLook(indexFromUrl(), "replace");
