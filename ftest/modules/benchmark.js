'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { FractalController } from './fractal-animations.js'

const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)
const log = console.log.bind(console)

window.onerror = handleGlobalError
const fractalData = [
  // Good borderline-breakdown reference point to compare single/double:
  {
    offset: [-0.21972451938261285, 0.6966446963056037],
    zoomLinear: -6.5,
    iterations: 600,
    precision: 'double',
  },
  {
    offset: [-0.21972451938261285, 0.6966446963056037],
    zoomLinear: -6.5,
    iterations: 600,
    precision: 'double',
    AB: true
  },
  // Ultra-high zoom comparison:
  {
    offset: [-0.2198187375826546, 0.6966599409152273],
    zoomLinear: -13,
    iterations: 700,
    precision: 'double'
  },
  {
    offset: [-0.2198187375826546, 0.6966599409152273],
    zoomLinear: -13,
    iterations: 700,
    precision: 'double',
    AB: true
  },
  
]

const fractalControllers = []
window.fractalControllers = fractalControllers

function handleGlobalError (event, source, line, col, error) {
  select('.logger').classList.remove('display-none')
  logError(source + ` (${line}:${col})`)
  logError(error)
}

function logError (message) {
  select('.logger').classList.remove('display-none')
  if (logError.printedBefore) { select('.logger').textContent += '\n' }
  select('.logger').textContent += message
  logError.printedBefore = true
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)

} else {
  queueMicrotask(initialize)
}

/**
 * Entry point for initialization:
 */
function initialize () {
  window.addEventListener('resize', debounce(handleResize))

  // Initialize canvas rendering contexts
  all('.benchmark-canvas').forEach((canvas, index) => {
    const controller = new FractalController(
      fractalData[index % fractalData.length])

    try {
      controller.acquire(canvas)

    } catch (e) {
      if (e.cause) {
        select('.logger').innerHTML = formatShaderError(e)
        select('.logger').classList.remove('display-none')
      } else {
        logError(e.message)
      }
      log(e)
    }

    fractalControllers.push(controller)
  })

  handleResize()

  // Associate event handlers:
  bindControl('#check-benchmark', 'input', event => {
    // state.benchmark = event.target.checked
    if (event.target.checked) {
      fractalControllers[0].play()
      fractalControllers[1].play()
      fractalControllers[0].showFPS = () => {
        select('.fps').textContent =
          fractalControllers[0].lastFPS.toFixed(1)
          + ' FPS'
      }

    } else {
      fractalControllers[0].pause()
      fractalControllers[1].pause()
      fractalControllers[0].showFPS = null
      select('.fps').textContent = ''
    }
  })
}

function handleResize () {
  all('.benchmark-canvas').forEach((canvas, index) => {
    canvas.width = canvas.scrollWidth
    canvas.height = canvas.scrollHeight
    if (fractalControllers[index]) {
      fractalControllers[index].width = canvas.width
      fractalControllers[index].height = canvas.height
      log('Anim', index, 'now has dimensions',
        fractalControllers[index].width,
        fractalControllers[index].height)

      fractalControllers[index].redraw()
    }
  })

  select('.resolution-display').textContent =
    fractalControllers[0].width + ' x ' +
    fractalControllers[0].height
}


/**
 * Bind-and-initialize an element using a functional event handler.
 * @param {string} selector The CSS selection used to identify the element
 * @param {string} action The event to listen for
 * @param {function} reaction Callback to read and apply the element's state
 */
function bindControl (selector, action, reaction) {
  const target = select(selector)

  // Bind listeners for future events, across any matching elements
  for (const e of all(selector)) {
    e.addEventListener(action, reaction)
  }

  // Dispatch an initial event to prompt the listeners for initialization
  target.dispatchEvent(new Event(action))
}

function debounce (callback, delay = 100) {
  return function (...args) {
    debounce.intervals = debounce.intervals || new Map

    const reaction = () => {
      debounce.intervals.delete(callback)
      callback.call(this, ...args)
    }
  
    if (debounce.intervals.has(callback)) {
      clearTimeout(debounce.intervals.get(callback))
    }
  
    debounce.intervals.set(callback, setTimeout(reaction, delay))
  }
}

function formatShaderError (error) {
  const lines = error.cause?.split('\n') || ['~']
  const badLineNumber = parseInt(error.message.match(/\d:(\d+)/)?.[1])
  const badLine = lines[badLineNumber - 1]
  lines[badLineNumber - 1] = `<span style="color:#f44">${badLine}</span>`

  let html = `<span style="color:#efa">${error.message}</span>`
              +lines.filter((e, i) => Math.abs(badLineNumber - i) < 4)
                    .join('<br>')

  return html
}
