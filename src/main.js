import './style.css'

// Configuration
const defaultModes = {
  work: {
    time: 25 * 60,
    label: 'Focus Time',
    color: '#f43f5e'
  },
  short: {
    time: 5 * 60,
    label: 'Short Break',
    color: '#10b981'
  },
  long: {
    time: 15 * 60,
    label: 'Long Break',
    color: '#3b82f6'
  }
}

let MODES = JSON.parse(localStorage.getItem('pomodoro-modes')) || defaultModes
let selectedSound = localStorage.getItem('pomodoro-sound-choice') || 'classic'

// State
let currentMode = 'work'
let timeLeft = MODES[currentMode].time
let isRunning = false
let timerInterval = null
let totalTime = MODES[currentMode].time
let audioContext = null
let soundEnabled = false
let noiseNode = null
let noiseGain = null

// DOM Elements
const timeDisplay = document.getElementById('time-display')
const timerLabel = document.getElementById('timer-label')
const progressRing = document.getElementById('progress-ring')
const btnToggle = document.getElementById('btn-toggle')
const btnReset = document.getElementById('btn-reset')
const modeBtns = document.querySelectorAll('.mode-btn')
const body = document.body

// New Elements
const taskInput = document.getElementById('task-input')
const btnSettings = document.getElementById('btn-settings')
const btnSound = document.getElementById('btn-sound')
const settingsModal = document.getElementById('settings-modal')
const closeModal = document.getElementById('close-modal')
const saveSettings = document.getElementById('save-settings')
const inputWork = document.getElementById('work-time')
const inputShort = document.getElementById('short-time')
const inputLong = document.getElementById('long-time')
const soundSelect = document.getElementById('sound-select')
const btnPreviewSound = document.getElementById('btn-preview-sound')

// Constants
const FULL_DASH_ARRAY = 283

// Icons
const ICON_VOLUME_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
const ICON_VOLUME_ON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`

function init() {
  setupEventListeners()
  loadSettingsToInputs()
  loadTask()
  setMode('work')
}

function setupEventListeners() {
  btnToggle.addEventListener('click', toggleTimer)
  btnReset.addEventListener('click', resetTimer)

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode
      setMode(mode)
    })
  })

  taskInput.addEventListener('input', (e) => {
    localStorage.setItem('pomodoro-task', e.target.value)
  })

  // Settings
  btnSettings.addEventListener('click', openSettings)
  closeModal.addEventListener('click', closeSettings)
  saveSettings.addEventListener('click', saveAndApplySettings)
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings()
  })

  // Sound
  btnSound.addEventListener('click', toggleSoundState)

  // Sound Preview
  btnPreviewSound.addEventListener('click', () => {
    const choice = soundSelect.value
    playTone(choice)
  })
}

function loadTask() {
  const savedTask = localStorage.getItem('pomodoro-task')
  if (savedTask) {
    taskInput.value = savedTask
  }
}

/* --- Sound Engine --- */
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
}

// Notification Sounds
function playNotificationSound() {
  playTone(selectedSound)
}

function playTone(type) {
  initAudio()
  const ctx = audioContext
  const t = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  if (type === 'classic') {
    // Louder Beep
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.5)

    gain.gain.setValueAtTime(0.8, t) // Louder
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5)

    osc.start(t)
    osc.stop(t + 0.5)
  }
  else if (type === 'digital') {
    // High pitched double beep
    osc.type = 'square'

    // Beep 1
    osc.frequency.setValueAtTime(1200, t)
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.setValueAtTime(0, t + 0.1)

    // Beep 2
    osc.frequency.setValueAtTime(1200, t + 0.15)
    gain.gain.setValueAtTime(0.1, t + 0.15)
    gain.gain.setValueAtTime(0, t + 0.25)

    osc.start(t)
    osc.stop(t + 0.3)
  }
  else if (type === 'chime') {
    // Major Chord Arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50] // C E G C
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)

      o.frequency.value = freq
      o.type = 'triangle'

      const start = t + (i * 0.1)
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.2, start + 0.1)
      g.gain.exponentialRampToValueAtTime(0.01, start + 2)

      o.start(start)
      o.stop(start + 2)
    })
  }
  else if (type === 'alarm') {
    // Urgent Pulse
    osc.type = 'sawtooth'
    osc.frequency.value = 880

    gain.gain.setValueAtTime(0.3, t)
    gain.gain.setValueAtTime(0, t + 0.2)
    gain.gain.setValueAtTime(0.3, t + 0.4)
    gain.gain.setValueAtTime(0, t + 0.6)
    gain.gain.setValueAtTime(0.3, t + 0.8)
    gain.gain.setValueAtTime(0, t + 1.0)

    osc.start(t)
    osc.stop(t + 1.0)
  }
}


/* --- Brown Noise (Focus Sound) --- */
function toggleSoundState() {
  initAudio()
  soundEnabled = !soundEnabled
  btnSound.dataset.state = soundEnabled ? 'on' : 'off'
  btnSound.innerHTML = soundEnabled ? ICON_VOLUME_ON : ICON_VOLUME_OFF

  if (soundEnabled) {
    btnSound.style.color = 'var(--current-accent)'
    if (isRunning) startNoise()
  } else {
    btnSound.style.color = 'var(--text-muted)'
    stopNoise()
  }
}

function startNoise() {
  if (!soundEnabled || !audioContext) return
  if (noiseNode) return

  const bufferSize = audioContext.sampleRate * 2
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const data = buffer.getChannelData(0)

  let lastOut = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    lastOut = (lastOut + (0.02 * white)) / 1.02
    data[i] = lastOut * 3.5
    data[i] *= 0.1
  }

  noiseNode = audioContext.createBufferSource()
  noiseNode.buffer = buffer
  noiseNode.loop = true

  noiseGain = audioContext.createGain()
  noiseGain.gain.setValueAtTime(0, audioContext.currentTime)
  noiseGain.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 1)

  noiseNode.connect(noiseGain)
  noiseGain.connect(audioContext.destination)
  noiseNode.start()
}

function stopNoise() {
  if (noiseNode && noiseGain) {
    const stopTime = audioContext.currentTime + 0.5
    noiseGain.gain.linearRampToValueAtTime(0, stopTime)
    noiseNode.stop(stopTime)

    setTimeout(() => {
      noiseNode = null
      noiseGain = null
    }, 600)
  }
}

/* --- Settings --- */
function openSettings() {
  inputWork.value = Math.floor(MODES.work.time / 60)
  inputShort.value = Math.floor(MODES.short.time / 60)
  inputLong.value = Math.floor(MODES.long.time / 60)
  soundSelect.value = selectedSound

  settingsModal.classList.remove('hidden')
  settingsModal.setAttribute('aria-hidden', 'false')
}

function closeSettings() {
  settingsModal.classList.add('hidden')
  settingsModal.setAttribute('aria-hidden', 'true')
}

function saveAndApplySettings() {
  const newWork = parseInt(inputWork.value) || 25
  const newShort = parseInt(inputShort.value) || 5
  const newLong = parseInt(inputLong.value) || 15

  MODES.work.time = newWork * 60
  MODES.short.time = newShort * 60
  MODES.long.time = newLong * 60

  selectedSound = soundSelect.value

  localStorage.setItem('pomodoro-modes', JSON.stringify(MODES))
  localStorage.setItem('pomodoro-sound-choice', selectedSound)

  if (!isRunning) {
    totalTime = MODES[currentMode].time
    timeLeft = totalTime
    updateDisplay()
  }
  closeSettings()
}

function loadSettingsToInputs() {
  inputWork.value = Math.floor(MODES.work.time / 60)
  inputShort.value = Math.floor(MODES.short.time / 60)
  inputLong.value = Math.floor(MODES.long.time / 60)
}

/* --- Timer Logic --- */
function setMode(mode) {
  currentMode = mode
  totalTime = MODES[mode].time
  timeLeft = totalTime

  stopNoise()

  modeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
    btn.setAttribute('aria-selected', btn.dataset.mode === mode)
  })

  document.documentElement.style.setProperty('--current-accent', MODES[mode].color)
  body.setAttribute('data-mode', mode)

  if (soundEnabled) {
    btnSound.style.color = MODES[mode].color
  }

  timerLabel.textContent = MODES[mode].label

  pauseTimer()
  updateDisplay()
}

function toggleTimer() {
  if (isRunning) {
    pauseTimer()
  } else {
    startTimer()
  }
}

function startTimer() {
  if (isRunning) return
  initAudio()

  isRunning = true
  btnToggle.textContent = 'Pause'
  btnToggle.classList.add('active')

  if (soundEnabled) startNoise()

  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--
      updateDisplay()
    } else {
      completeTimer()
    }
  }, 1000)
}

function pauseTimer() {
  isRunning = false
  btnToggle.textContent = 'Start'
  btnToggle.classList.remove('active')
  clearInterval(timerInterval)
  stopNoise()
}

function resetTimer() {
  pauseTimer()
  timeLeft = totalTime
  updateDisplay()
}

function completeTimer() {
  pauseTimer()
  timeLeft = 0
  updateDisplay()
  playNotificationSound()
  timerLabel.textContent = 'Time is up!'
}

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  timeDisplay.textContent = timeString
  document.title = `${timeString} - PomoFocus`
  setCircleDashoffset(timeLeft)
}

function setCircleDashoffset(currentTime) {
  const rawFraction = currentTime / totalTime
  const fraction = rawFraction
  const offset = FULL_DASH_ARRAY - (fraction * FULL_DASH_ARRAY)
  progressRing.style.strokeDashoffset = offset
}

init()
