'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { shaders } from './fractal-shaders.js'
import { FractalController } from './fractal-animations.js'
import { createRenderer } from './gl-animations.js'

const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)
const log = console.log.bind(console)

const state = {
  benchmark: false
}

// const animation = {
//   offset: [2, 2],
//   zoomLinear: -4
// }

// Pretty reference swirls:
// const animation = {
//   offset: [-0.7629371924176684, 0.09021138176597424],
//   zoomLinear: -3.15
// }


// values demonstrating single/double precision break
const animation1 = new FractalController({
  offset: [-0.21972221938261285, 0.6966446963056037],
  zoomLinear: -4.7
})

// const animation = {
//   offset: [-0.7659511694034345, 0.1031443780743105],
//   zoomLinear: -1.7
// }

window.animation1 = animation1

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

window.split = split
window.splitv = splitv
window.add12 = add12
window.add22 = add22
window.mul12 = mul12
window.mul22 = mul22

// Float-float operations adapted from:
// Guillaume da Graçca, David Defour. Implementation of float-float operators
// on graphics hardware. Real Numbers and Computers 7, Jul 2006, Nancy, France.
// pp.23-32. ￿hal-00021443￿
function split (double, s) {
  const c = (2**s + 1) * double
  const big = c - double // Carries error from addition and subtraction
  const hi = c - big // Roughly the top 7 significant figures of the double
  const lo = double - hi
  return { hi, lo }
}

function splitv (double, s) {
  const result = split(double, s)
  return [result.hi, result.lo]
}

// singles -> paired result
function add12 (x, y) {
  const sum = x + y
  const v = sum - x
  const rest = (x - (sum - v)) + (y - v)
  return { sum, rest }
}

// singles -> paired result
function mul12 (a, b) {
  const product = a * b
  const { hi: ahi, lo: alo } = split(a, 32)
  const { hi: bhi, lo: blo } = split(b, 32)

  const e1 = product - (ahi * bhi)
  const e2 = e1 - (alo * bhi)
  const e3 = e2 - (ahi * blo)
  const roundoff = (alo * blo) - e3

  return { product, roundoff }
}

// two paired operands -> one paired result
function add22 (a, b) {
  const r = a.hi + b.hi
  let s
  if (Math.abs(a.hi) >= Math.abs(b.hi)) {
    s = (((a.hi - r) + b.hi) + b.lo) + a.lo

  } else {
    s = (((b.hi - r) + a.hi) + a.lo) + b.lo
  }

  const z = add12(r, s)
  return { hi: z.sum, lo: z.rest }
}

// two paired operands -> one paired result
function mul22 (a, b) {
  const t = mul12(a.hi, b.hi)

  const t3 = ((a.hi * b.lo) + (a.lo * b.hi)) + t.roundoff
  // N.B. this step is misprinted in Graçca and Defour:
  const r = add12(t.product, t3)
  return r
}

// const v1 = 1.234567898765432123456789
// const v2 = 9.876543212345678987654321

// log(`v1 + v2 = ${v1 + v2}`)
// const added = add22(split(v1, 32), split(v2, 32))
// log(`add22(split v1, split v2) = ${added.hi} + ${added.lo} = ${added.hi+added.lo}`)

// log(`v1 * v2 =\n>${v1 * v2}`)
// const multiplied = mul22(split(v1, 32), split(v2, 32))
// log(`mul22(split v1, split v2) = ${multiplied.sum} + ${multiplied.rest} = \n>${multiplied.sum+multiplied.rest}`)




function initialize () {
  log('Controller script loaded.')

  try {
    animation1.acquire(select('.fractal-canvas'))

  } catch (e) {
    if (e.cause) {
      select('.logger').innerHTML = formatShaderError(e)
      select('.logger').classList.remove('display-none')
    } else {
      logError(e.message)
    }
    log(e)
  }

  addListeners()

  const s = animation1.context.getShaderPrecisionFormat(
    animation1.context.VERTEX_SHADER,
    animation1.context.HIGH_FLOAT)
  select('.shader-precision').textContent =
    `rangeMin: ${s.rangeMin} rangeMax: ${s.rangeMax} precision: ${s.precision}`

  log(animation1.context.getParameter(
    animation1.context.SHADING_LANGUAGE_VERSION))
}

function initQuad2 () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.uCanvasReciprocal =
    gl.getUniformLocation(this.program, 'canvasReciprocal')
  this.uOffsetX = gl.getUniformLocation(this.program, 'offsetX')
  this.uOffsetY = gl.getUniformLocation(this.program, 'offsetY')
  this.uZoom = gl.getUniformLocation(this.program, 'zoom')
  this.uViewportResolution =
    gl.getUniformLocation(this.program, 'viewportResolution')
  this.uZoomedReciprocal =
    gl.getUniformLocation(this.program, 'zoomedReciprocal')
  this.uOne = gl.getUniformLocation(this.program, 'one')
  this.uOsc = gl.getUniformLocation(this.program, 'osc')
  this.uUseDoublePrecision =
    gl.getUniformLocation(this.program, 'useDoublePrecision')
  this.uIterations = gl.getUniformLocation(this.program, 'iterations')

  log('??? unused ', this.canvasResolution)
  gl.uniform2fv(this.uCanvasReciprocal, splitv(1 / this.canvasResolution, 32))
  gl.uniform1f(this.uOne, 1)
  gl.uniform1f(this.uIterations, 20)
}

function drawQuad2 () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl
  const controller = this.shared.animationController
  const offX = splitv(animation1.offset[0], 32)
  const offY = splitv(animation1.offset[1], 32)

  if (!controller.width) {
    throw Error('Dimensions not specified for animation')
  }

  log('controller check: ', controller)

  gl.viewport(0, 0,
    controller.width,
    controller.height)
  gl.uniform2f(this.uViewportResolution,
    controller.width,
    controller.height)
  gl.uniform2fv(this.uOffsetX, offX)
  gl.uniform2fv(this.uOffsetY, offY)
  gl.uniform2fv(this.uZoom, splitv(animation1.zoomFactor, 32))
  gl.uniform1f(this.uOsc, (this.dt / 2000) % 3)

  gl.uniform1f(this.uIterations, animation1.iterations)
  gl.uniform1i(this.uUseDoublePrecision,
    animation1.precision === 'double'
    ? true
    : false
  )

  const splitZoomedReciprocal =
    splitv((animation1.zoomFactor)
      * (1 / Math.max(
        controller.width,
        controller.height)),
        32)

  gl.uniform2fv(this.uZoomedReciprocal,
    splitZoomedReciprocal)

  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
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

/**
 * Add event listeners and initialize program state.
 */
function addListeners () {
  animation1.onZoom = updateZoomLevelDisplay

  bindControl('#canvas-1', 'wheel', event => {
    event.preventDefault()

    if (event.wheelDelta > 0) {
      animation1.zoomLinear += 0.1

    } else {
      animation1.zoomLinear -= 0.1
    }

    animation1.redraw()
  })

  bindControl('#check-benchmark', 'input', event => {
    state.benchmark = event.target.checked
    if (state.benchmark) {
      animation1.play()
      animation1.showFPS = () => {
        select('.fps').textContent = animation1.lastFPS.toFixed(1)
          + ' FPS'
      }

    } else {
      animation1.pause()
      animation1.showFPS = null
      select('.fps').textContent = ''
    }
  })

  bindControl('#check-jumbo', 'input', event => {
    if (event.target.checked) {
      select('#canvas-1').classList.add('jumbo-size')

    } else {
      select('#canvas-1').classList.remove('jumbo-size')
    }

    const width =
      getComputedStyle(select('#canvas-1')).width.match(/\d*/)[0]
    const height =
      getComputedStyle(select('#canvas-1')).height.match(/\d*/)[0]

    select('#canvas-1').width = width
    animation1.width = width
    select('#canvas-1').height = height
    animation1.height = height
    
    animation1.redraw()
  })

  bindControl('#check-giga', 'input', event => {
    if (event.target.checked) {
      select('#canvas-1').classList.add('giga-size')
      select('#check-jumbo').checked = false

    } else {
      select('#canvas-1').classList.remove('giga-size')
    }

    const width =
      getComputedStyle(select('#canvas-1')).width.match(/\d*/)[0]
    const height =
      getComputedStyle(select('#canvas-1')).height.match(/\d*/)[0]

    select('#canvas-1').width = width
    animation1.width = width
    select('#canvas-1').height = height
    animation1.height = height
    
    animation1.redraw()
  })

  // Initialize animation dimensions and bind resolution checkbox listener
  bindControl('#check-lofi', 'input', event => {
    const lofi = event.target.checked
    let width, height
    if (lofi) {
      width =
        getComputedStyle(select('#canvas-1')).width.match(/\d*/)[0] / 2
      height =
        getComputedStyle(select('#canvas-1')).height.match(/\d*/)[0] / 2

    } else {
      width =
        getComputedStyle(select('#canvas-1')).width.match(/\d*/)[0]
      height =
        getComputedStyle(select('#canvas-1')).height.match(/\d*/)[0]
    }

    select('#canvas-1').width = width
    animation1.width = width
    select('#canvas-1').height = height
    animation1.height = height
    
    animation1.redraw()
  })

  bindControl('input[name="precision"]', 'input', event => {
    animation1.precision = select('input[name="precision"]:checked').value
    animation1.redraw()
  })

  bindControl('#zoom-slider', 'input', event => {
    const z = select('#zoom-slider').value
    animation1.zoomLinear = -z
    animation1.redraw()
  })

  bindControl('#iteration-slider', 'input', event => {
    const n = select('#iteration-slider').value
    select('.iteration-count').textContent = n
    animation1.iterations = n
    animation1.redraw()
  })

  // select('.fractal-canvas').addEventListener('contextmenu', event => {
  //   event.preventDefault()
  // })

  select('.fractal-canvas').addEventListener('pointerdown', event => {
    const checkbox = select('#check-lofi')
    animation1.lastLofiCheckState = checkbox.checked
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('input'))
  })

  select('.fractal-canvas').addEventListener('pointerup', event => {
    const checkbox = select('#check-lofi')
    checkbox.checked = animation1.lastLofiCheckState
    checkbox.dispatchEvent(new Event('input'))
  })

  // Update auto-resolution when pointer leaves
  select('.fractal-canvas').addEventListener('pointerleave', event => {
    if(event.buttons !== 1 && event.buttons !== 2) { return }
    const checkbox = select('#check-lofi')
    checkbox.checked = animation1.lastLofiCheckState
    checkbox.dispatchEvent(new Event('input'))
  })

  select('.fractal-canvas').addEventListener('pointermove', event => {
    if (event.buttons === 1) {
      const greatestDimension = Math.max(
        select('.fractal-canvas').width,
        select('.fractal-canvas').height
      )

      animation1.offset[0] -=
        event.movementX / greatestDimension * animation1.zoomFactor
      animation1.offset[1] +=
        event.movementY / greatestDimension * animation1.zoomFactor

      animation1.redraw()
    }
    // if (event.buttons === 2) {
    //   animation1.zoomLinear -=
    //     event.movementY / select('.fractal-canvas').height
      
    //   animation1.redraw()
    // }
  })

  function updateZoomLevelDisplay () {
    select('#zoom-slider').value = -animation1.zoomLinear
    select('.zoom-level').textContent =
        animation1.zoomFactor < 1
        ? (1 / animation1.zoomFactor).toLocaleString().split('.')[0] + 'x'
        : (1 / animation1.zoomFactor).toFixed(3) + 'x'
  }
}
