'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { shaders } from './fractal-shaders.js'

const select = document.querySelector.bind(document)
const all = document.querySelectorAll.bind(document)
const log = console.log.bind(console)

const animation = {
  offset: [-0.7629371924176684, 0.09021138176597424],
  zoomLinear: -3.15
}
// debug -- values demonstrating precision break
// const animation = {
  //   offset: [-0.7629511694034345, 0.09021443780743105],
  //   zoomLinear: -4.7
// }

// const animation = {
//   offset: [-0.7659511694034345, 0.1031443780743105],
//   zoomLinear: -1.7
// }

window.animation = animation

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

function initialize () {
  log('Controller script loaded.')
  addListeners()

  for (const c of all('.fractal-canvas')) {
    const rect = c.getBoundingClientRect()
    c.setAttribute('width', rect.width)
    c.setAttribute('height', rect.height)
  }

  let gl = select('.fractal-canvas').getContext(
    'webgl2', { alpha: false, premultipliedAlpha: true, antialias: false })
  if (!gl) {
    gl = select('.fractal-canvas').getContext(
      'webgl', { alpha: false, premultipliedAlpha: true, antialias: false })
  }

  const s = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)
  select('.shader-precision').textContent =
    `rangeMin: ${s.rangeMin} rangeMax: ${s.rangeMax} precision: ${s.precision}`
  log(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT))

  log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))

  animation.context = gl
  animation.render = createRenderer(gl, { animationState: animation },
    [
      {
        vertexShader: shaders.testVert,
        fragmentShader: shaders.testFrag,
        canvasWidth: select('.fractal-canvas').width,
        canvasHeight: select('.fractal-canvas').height,
        canvasResolution: Math.max(
          select('.fractal-canvas').width,
          select('.fractal-canvas').height),
        init: initQuad,
        draw: drawQuad,
        mesh: [
          -1, -1,
           1, -1,
           1,  1,
          -1,  1,
        ],
        components: 2
      }
    ])
}

function initQuad () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.uCanvasResolution =
    gl.getUniformLocation(this.program, 'canvasResolution')
  this.uCanvasReciprocal =
    gl.getUniformLocation(this.program, 'canvasReciprocal')
  this.uOffset = gl.getUniformLocation(this.program, 'offset')
  this.uZoom = gl.getUniformLocation(this.program, 'zoom')

  gl.uniform1f(this.uCanvasResolution, this.canvasResolution)
  gl.uniform1f(this.uCanvasReciprocal, 1 / this.canvasResolution)
}

function drawQuad () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  gl.viewport(0, 0, this.canvasWidth, this.canvasHeight)
  gl.uniform2f(this.uOffset, ...animation.offset)
  gl.uniform1f(this.uZoom, 16 ** animation.zoomLinear)
  log('1/zoom = ', 1/(16 ** animation.zoomLinear))
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}

/**
 * If certain features are not present on the WebGLRenderingContext,
 * acquire those extensions and add them to the context object.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
 * The context object to modify.
 */
function polyfillExtensions (gl) {
  if (!gl.createVertexArray) {
    const vaoExt = gl.getExtension('OES_vertex_array_object')
    gl.VERTEX_ARRAY_BINDING = vaoExt.VERTEX_ARRAY_BINDING_OES
    gl.createVertexArray = vaoExt.createVertexArrayOES.bind(vaoExt)
    gl.deleteVertexArray = vaoExt.deleteVertexArrayOES.bind(vaoExt)
    gl.isVertexArray = vaoExt.isVertexArrayOES.bind(vaoExt)
    gl.bindVertexArray = vaoExt.bindVertexArrayOES.bind(vaoExt)
  }

  // WebGL1 requires gl.DEPTH_COMPONENT, but WebGL2 uses DEPTH_COMPONENTXX
  const depthTextureExt = gl.getExtension('WEBGL_depth_texture')
  if (depthTextureExt) {
    gl.appropriateDepthFormat = gl.DEPTH_COMPONENT
    gl.depthTextureExt = depthTextureExt // Prevent garbage collection.
  } else {
    gl.appropriateDepthFormat = gl.DEPTH_COMPONENT16
  }
}

/**
 * Initialize a WebGL rendering loop with a list of rendering phases.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl context to use.
 * @param {Object} shared An object containing state shared between phases.
 * Must include a reference to animationState, which controls animation loops.
 * @param {Array} phases An array of rendering phase objects. Each specifies
 * the vertex and fragment shader to use, the mesh to upload as an attribute
 * array, and optionally an init() and draw() method.
 * @returns {Function} The frame-drawing function for RequestAnimationFrame.
 */
function createRenderer (gl, shared, phases = []) {
try {
  if (!phases.length) { throw new Error('No rendering phases specified.') }
  if (!shared.animationState) { throw new Error('animationState needed.') }

  polyfillExtensions(gl)

  for (const p of phases) {
    // Initialize each rendering phase
    p.gl = gl
    p.shared = shared
    p.components ??= 3 // Components to use for position vertices

    if (!p.draw) { throw new Error('Draw method needed.') }

    // Skip VAO/VBO/shader initialization if data wasn't provided:
    if (!p.vertexShader || !p.fragmentShader || !p.mesh) { 
      if (p.init) { p.init() }
      continue
    }

    // Compile and link shaders
    let vs = compileShader(gl, p.vertexShader, gl.VERTEX_SHADER)
    let fs = compileShader(gl, p.fragmentShader, gl.FRAGMENT_SHADER)
    p.program = gl.createProgram()
    gl.attachShader(p.program, vs)
    gl.attachShader(p.program, fs)
    linkProgram(gl, p.program)

    // Clean up after linkage
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    vs = null
    fs = null

    // Acquire a VAO to store vertex array state
    p.vao = gl.createVertexArray()
    gl.bindVertexArray(p.vao)

    // Load the provided mesh into a VBO
    p.vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p.mesh), gl.STATIC_DRAW)

    // Assume most phases want an attribute for vertex positions, named 'pos'
    p.pos = gl.getAttribLocation(p.program, 'pos')

    gl.useProgram(p.program)

    gl.enableVertexAttribArray(p.pos)
    gl.vertexAttribPointer(p.pos, p.components, gl.FLOAT, false,
      p.mesh.byteStride || 0, 0)

    // Allow customized per-phase initialization
    if (p.init) { p.init() }
  }

  // Commonly shared GL state
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.DEPTH_TEST)

  // Drawing function returned by createRenderer.
  // Draws each phase.
  function drawFrame (t) {
    countFrame(t, shared.animationState)
    drawFrame.pauseTime ??= 0
    drawFrame.t0 ??= t
    if (drawFrame.pauseTime) {
      drawFrame.t0 += t - drawFrame.pauseTime
      drawFrame.pauseTime = 0
    }
    const dt = t - drawFrame.t0

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    for (const p of phases) {
      p.dt = dt

      if (p.program) {
        gl.bindVertexArray(p.vao)
        gl.useProgram(p.program)
      }

      p.draw()
    }

    if (shared.animationState.keepAnimating) {
      shared.animationState.needUpdate = true
      requestAnimationFrame(drawFrame)
    } else {
      drawFrame.pauseTime = t
    }
  }

  requestAnimationFrame(drawFrame)
  return drawFrame

} catch (e) {
  if (e.cause) {
    select('.logger').innerHTML = formatShaderError(e)
  } else {
    logError(e.message)
  }
  log(e)
}
}

/**
 * Track FPS, averaged about every second.
 * If animationState.showFPS is defined, call it periodically.
 * @param {*} time 
 * @param {*} animationState 
 */
function countFrame (time, animationState) {
  animationState.intervalStart ??= time
  animationState.frameCount ??= 0

  animationState.frameCount++
  const dt = time - animationState.intervalStart

  if (dt > 1000) {
    animationState.lastFPS = 1000 * animationState.frameCount / dt
    animationState.intervalStart = time
    animationState.frameCount = 0
    animationState.showFPS?.()
  }
}

function compileShader (context, source, type) {
  const shader = context.createShader(type)
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS))
    throw new Error(context.getShaderInfoLog(shader), { cause: source })
  return shader
}

function linkProgram (context, program) {
  context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS))
    throw new Error(context.getProgramInfoLog(program))
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

function addListeners () {
  select('.fractal-canvas').addEventListener('contextmenu', event => {
    event.preventDefault()
  })

  select('.fractal-canvas').addEventListener('pointermove', event => {
    if (event.buttons === 1) {
      animation.offset[0] -= event.movementX / select('.fractal-canvas').width
                              * 16 ** animation.zoomLinear
      animation.offset[1] += event.movementY / select('.fractal-canvas').height
                              * 16 ** animation.zoomLinear
      animation.render()
    }
    if (event.buttons === 2) {
      animation.zoomLinear -=
        event.movementY / select('.fractal-canvas').height
      animation.render()
    }
  })
}
