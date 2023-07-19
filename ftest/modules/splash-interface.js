'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { FractalController } from './fractal-animations.js'

const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)
const log = console.log.bind(console)

log('TODO: Notify user of incompatibility if Webgl2 is unavailable')

const carouselData = [
  {
    offset: [-0.21969099349379312, 0.6966391379960937],
    zoomLinear: -6.6,
    iterations: 600,
    precision: 'double'
  },
  {
    offset: [-0.21972221938261285, 0.6966446963056037],
    zoomLinear: -5.8,
    iterations: 500,
    precision: 'double'
  },
  {
    offset: [-0.7629371924176684, 0.09021138176597424],
    zoomLinear: -3.15,
    iterations: 200
},
  
  
  {
      offset: [2, 2],
      zoomLinear: -4,
      iterations: 200
  }
]

const carouselFractals = []
window.carouselFractals = carouselFractals

window.onerror = handleGlobalError

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

function handleResize (event) {
  log('event: ', event)
  all('.carousel-canvas').forEach((canvas, index) => {
    canvas.width = canvas.scrollWidth
    canvas.height = canvas.scrollHeight
    if (carouselFractals[index]) {
      carouselFractals[index].width = canvas.width
      carouselFractals[index].height = canvas.height
      log('Anim', index, 'now has dimensions',
        carouselFractals[index].width,
        carouselFractals[index].height)

      carouselFractals[index].redraw()
    }
  })
}

function initialize () {
  const logoObserver = new IntersectionObserver(logoCallback,
    { threshold: 1 })

  logoObserver.observe(select('.logo'))

  window.addEventListener('resize', debounce(handleResize))

  // Initialize canvas rendering contexts
  all('.carousel-canvas').forEach((canvas, index) => {
    const controller = new FractalController(carouselData[index])

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

    carouselFractals.push(controller)
  })

  handleResize()

}

function logoCallback (entries, observer) {
  logoCallback.timesCalled ??= 0

  entries.forEach(e => {
    if (e.intersectionRatio < 1) {
      select('.burger-visual').classList.add('shaded-burger')
      
    } else {
      select('.burger-visual').classList.remove('shaded-burger')
    }
  })
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
