'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { Lighting, painters } from './gleam-painters.js'
import { shaders } from './gleam-shaders.js'
import { geometry } from './gleam-geometry.js'
import { Quaternion, frustum, π } from './sundry-matrix.js'
import { tesseractAnimations } from './animation-data.js'

window.onerror = handleGlobalError
document.querySelector('.loading-notice').classList.add('hidden')

export const log = console.log.bind(console)
const el = document.getElementById.bind(document)

export const state = {
  animationSpeeds: [],
  // Lighting object storing color and direction of all current light sources:
  lighting: new Lighting,

  // Elastic camera drag state
  viewL: new Quaternion,
  viewR: new Quaternion,
  releasedViewL: new Quaternion,
  releasedViewR: new Quaternion,
  viewSnapT: 1,
  grabStyle: '3d',

  // Model orientation interpolation state
  modelL: new Quaternion,
  modelR: new Quaternion,
  initialModelL: new Quaternion,
  initialModelR: new Quaternion,
  finalModelL: new Quaternion,
  finalModelR: new Quaternion,
  modelSnapT: 1,

  // Number of times to run the blur filter
  blurPassCount: 2,

  // Factor used to scale the rendering clarity from 1.0 (normal clarity)
  // down to 0.0 (maximum blur)
  clarityScale: 0.0,

  animation1: { keepAnimating: true },
  animationSet: [],
  animationCycle: {},
  upcomingAnimations: [],
  currentAnimation: {},

  // An array of { remaining, callback } objects used to queue actions,
  // based on a timer which pauses while the user is interacting with
  // the interface:
  countdowns: []
}

export const animationSet = state.animationSet

export function logError (message) {
  document.querySelector('.feedback').style['visibility'] = 'visible'
  document.querySelector('.feedback').textContent += message + '\n'
}

function handleGlobalError (event, source, line, column, error) {
  logError('⚠️ ' + event)
  logError(source)
  logError('Line: ' + line)
  logError('Col: ' + column)
  logError(error)
}

initialize()
function initialize () {
try {
  logError('Script loaded.')
  initListeners()
  initAnimationCycler()
  startDemo()

  for (const c of [
    el('main-canvas')
  ]) {
    if (c) {
      const rect = c.getBoundingClientRect()
      c.setAttribute('width', rect.width)
      c.setAttribute('height', rect.height)
    }
  }

  let gl = el('main-canvas').getContext(
    'webgl2', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) {
    gl = el('main-canvas').getContext(
      'webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  }

  for (const [ctx, label] of [
    [gl, el('first-title').querySelector('.view-label')],
  ]) {
    ctx.canvas.width = ctx.canvas.clientWidth
    ctx.canvas.height = ctx.canvas.clientHeight

    label.innerHTML = ctx.getParameter(ctx.VERSION)
      + '<br>' + ctx.getParameter(ctx.SHADING_LANGUAGE_VERSION)

    if (!(ctx instanceof WebGLRenderingContext)) { // For WebGL2...
      label.innerHTML +=
        '<br>' + ctx.getParameter(ctx.MAX_SAMPLES) + 'x MSAA support'
    }
  }

  // Primary canvas
  state.animation1.context = gl
  state.animation1.showFPS = () => {
    el('fps-1').textContent = state.animation1.lastFPS.toFixed(1) + ' FPS'
  }

  state.animation1.draw = glPipeline(gl,
    { animationState: state.animation1,
      nearPlane: 1,
      farPlane: 100,
      animator: applyTransitions
    },
    [
      {
        init: painters.prepareBlurSurfaces,
        draw: painters.useClearTarget
      },
      { // draw border with optional specularity
        vertexShader: shaders.projectorVert,
        fragmentShader: shaders.borderFrag,
        mesh: geometry.tesseractOutline,
        components: 4,
        init: painters.initTesseractBorder,
        draw: painters.drawTesseractBorder
      },
      { // Draw diffuse light panes (with a little glow):
        vertexShader: shaders.projectorVert,
        fragmentShader: shaders.diffuseFrag,
        opacityFunction: () => state.lighting.diffuseOpacity,
        mesh: geometry.normalTesseract,
        components: 4,
        init: painters.initGlassTesseract,
        draw: painters.drawGlassTesseract
      },
      { // Draw glittery specular faces
        vertexShader: shaders.projectorVert,
        fragmentShader: shaders.glitterFrag,
        opacityFunction: () => state.lighting.specularOpacity,
        mesh: geometry.normalTesseract,
        components: 4,
        init: painters.initGlassTesseract,
        draw: painters.drawGlassTesseract
      },
      {
        draw: painters.resolveClearTarget
      },
      { // post-process the output with iterated Gaussian blur:
        vertexShader: shaders.textureVert,
        fragmentShader: shaders.blur1dFrag,
        mesh: geometry.texSquare,
        init: painters.initBlur,
        draw: painters.drawBlur
      },
      { // compose the blur (0) and clear (1) textures using depth (2).
        vertexShader: shaders.textureVert,
        fragmentShader: shaders.texturedCompositorFrag,
        mesh: geometry.texSquare,
        init: painters.initTexturedCompositor,
        draw: painters.drawTexturedCompositor
      },
    ])

  function easeQuartic(t) {
    return t < 0.5  ? 8 * t**4
                    : 1 - Math.pow(-2 * t + 2, 4) / 2
  }

  function updateClarity (tCurrent) {
    // Only update if a clarity change has been requested:
    if (!state.clarityTransition) { return }

    // If not set, start running a clock for this clarity transition:
    state.clarityTransition.tStart ??= tCurrent

    const dtClarity = Math.min(1,
      (tCurrent - state.clarityTransition.tStart)
        / state.clarityTransition.duration)

    state.clarityScale = lerpScalar(
      state.clarityTransition.initial,
      state.clarityTransition.final,
      dtClarity
    )

    // Stop running the transition once it has reached its end:
    if (dtClarity === 1) {
      delete state.clarityTransition
    }
  }

  function updateLights (tCurrent) {
    // Only update if a lighting transition has been requested:
    if (!state.lightTransition) { return }
      
    // If not set, start running a clock for the light transition:
    state.lightTransition.tStart ??= tCurrent
    const dtLight = Math.min(1,
      (tCurrent - state.lightTransition.tStart)
        / state.lightTransition.duration)

    state.lighting = interpolateLighting(
      state.lightTransition.initial,
      state.lightTransition.final,
      dtLight
    )

    // Stop running the transition once it has reached its end:
    if (dtLight === 1) {
      delete state.lightTransition
    }
  }

  function updateVelocities (tCurrent) {
    // Only update if a velocity transition has been requested:
    if (!state.velocityTransition) { return }

    state.velocityTransition.tStart ??= tCurrent

    const dtVelocity = Math.min(1,
      (tCurrent - state.velocityTransition.tStart)
        / state.velocityTransition.duration)

    state.animationSpeeds = interpolateVelocities(
      state.velocityTransition.initial,
      state.velocityTransition.final,
      dtVelocity)

    // Stop running the transition once it has reached its end:
    if (dtVelocity === 1) {
      delete state.velocityTransition
    }
  }

  function updateOrientation (tCurrent, tSinceLast) {
    // If no orientation transition has been set, apply baseline rotations:
    if (!state.orientationTransition) {
      applyOrientationAnimations(
        state.animationSpeeds,
        state.modelL,
        state.modelR,
        tSinceLast)

      return
    }

    // Otherwise, interpolate towards the desired orientation.
    state.orientationTransition.tStart ??= tCurrent
    
    const dtOrientation = Math.min(1,
      (tCurrent - state.orientationTransition.tStart)
        / state.orientationTransition.duration)

    const tEase = easeQuartic(dtOrientation)

    // Continue to update the initial orientation as though it were still
    // running, to provide smoother interpolation:
    applyOrientationAnimations(
      state.orientationTransition.initial.animationSpeeds,
      state.orientationTransition.initial.modelL,
      state.orientationTransition.initial.modelR,
      tSinceLast)

    state.modelL = Quaternion.slerpUnit(
      state.orientationTransition.initial.modelL,
      state.orientationTransition.final.modelL,
      tEase)

    state.modelR = Quaternion.slerpUnit(
      state.orientationTransition.initial.modelR,
      state.orientationTransition.final.modelR,
      tEase)

    if (dtOrientation === 1) {
      state.animationSpeeds =
        [...state.orientationTransition.final.animationSpeeds]

      delete state.orientationTransition
    }
  }

  function applyTransitions () {
    // this.t accumulates separately from the RAF timestamp,
    // enabling it to pause progress without disrupting animation timing.
    this.t ??= 0
    this.tLast ??= this.dt

    // Only advance the time scalar while the user is not pausing animation:
    if (!state.pointerdown) {
      const tSinceLast = this.dt - this.tLast
      this.t += tSinceLast

      if (this.shared.animationState.needUpdate) {
        updateClarity(this.t)
        updateLights(this.t)
        updateVelocities(this.t)
        updateOrientation(this.t, tSinceLast)

        if (state.modelSnapT < 1) {
          // Slerp between two model orientations:
          state.modelSnapT += (this.dt - this.tLast) / 2000 
          state.modelSnapT = Math.min(state.modelSnapT, 1)
          state.modelL = Quaternion.slerpUnit(
                          state.initialModelL,
                          state.finalModelL,
                          easeQuartic(state.modelSnapT))
          state.modelR = Quaternion.slerpUnit(
                          state.initialModelR,
                          state.finalModelR,
                          easeQuartic(state.modelSnapT))
        }

        if (state.viewSnapT < 1) {
          // Drift back to a centered view:
          state.viewSnapT += (this.dt - this.tLast) / 2000
          state.viewSnapT = Math.min(state.viewSnapT, 1)
          state.viewL = Quaternion.slerpUnit(
                          state.releasedViewL,
                          Quaternion.from([0,0,0,1]),
                          state.viewSnapT)
          state.viewR = Quaternion.slerpUnit(
                          state.releasedViewR,
                          Quaternion.from([0,0,0,1]),
                          state.viewSnapT)
        }
        
        // Update and run scheduled callbacks:
        const decrement = this.dt - this.tLast
        let needPrune = false
        // Copy the array to avoid recursively expanding the countdown stack:
        for (const c of [...state.countdowns]) {
          c.remaining -= decrement
          if (c.remaining < 0) {
            c.callback()
            needPrune = true
          }
        }
        if (needPrune) {
          state.countdowns = state.countdowns.filter(e => e.remaining > 0)
        }

        this.shared.animationState.needUpdate = false
      }
    }
    this.tLast = this.dt
      
    this.gl.uniform4fv(this.qViewL, state.viewL)
    this.gl.uniform4fv(this.qViewR, state.viewR)

    this.gl.uniform4fv(this.qModelL, state.modelL)
    this.gl.uniform4fv(this.qModelR, state.modelR)
  }

} catch (e) {
  logError('\n🚩 Initialization error: ' + e.message
        + '\n' + e.stack)
}
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
function glPipeline (gl, shared, phases = []) {
try {
  if (!phases.length) { throw new Error('No rendering phases specified.') }
  if (!shared.animationState) { throw new Error('animationState needed.') }

  polyfillExtensions(gl)

  shared.nearPlane ??= 0.1
  shared.farPlane ??= 1000

  shared.projection = frustum({ near: shared.nearPlane,
                                far: shared.farPlane,
                                fov: 12, aspect: 1.0 })

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

    // Provide common optional uniforms
    p.model = gl.getUniformLocation(p.program, 'model')
    p.view = gl.getUniformLocation(p.program, 'view')
    p.projection = gl.getUniformLocation(p.program, 'projection')

    // Assume most phases want an attribute for vertex positions, named 'pos'
    p.pos = gl.getAttribLocation(p.program, 'pos')

    gl.useProgram(p.program)
    gl.uniformMatrix4fv(p.projection, false, shared.projection)

    gl.enableVertexAttribArray(p.pos)
    gl.vertexAttribPointer(p.pos, p.components, gl.FLOAT, false,
      p.mesh.byteStride, 0)

    // Allow customized per-phase initialization
    if (p.init) { p.init() }
  }

  // Commonly shared GL state
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)

  // Drawing function returned by glPipeline.
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

    gl.clearColor(0, 0, 0, 0)
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
  document.querySelector('.feedback').style['visibility'] = 'visible'
  if (e.cause) {
    document.querySelector('.feedback').innerHTML = formatShaderError(e)
  } else {
    document.querySelector('.feedback').textContent += '❌ ' + e.message + '\n'
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

const animationQuats = [
  { L: Quaternion.from([0, 0, 1, 1]), R: Quaternion.from([0, 0, -1, 1]) },
  { L: Quaternion.from([0, 1, 0, 1]), R: Quaternion.from([0, -1, 0, 1]) },
  { L: Quaternion.from([1, 0, 0, 1]), R: Quaternion.from([-1, 0, 0, 1]) },
  { L: Quaternion.from([1, 0, 0, 1]), R: Quaternion.from([1, 0, 0, 1]) },
  { L: Quaternion.from([0, 1, 0, 1]), R: Quaternion.from([0, 1, 0, 1]) },
  { L: Quaternion.from([0, 0, 1, 1]), R: Quaternion.from([0, 0, 1, 1]) },
]

function applyOrientationAnimations (speeds, targetL, targetR, dt) {
  for (const [i,s] of speeds.entries()) {
    if (Math.abs(s) < 0.000001) { continue }
    const dΘ = dt * s * π / 1000

    // The first six values control local rotations, the next are global.
    if (i < 6) {
      targetL.postmultiply(animationQuats[i].L.atAngle(dΘ))
      targetR.premultiply(animationQuats[i].R.atAngle(dΘ))
    } else {
      targetL.premultiply(animationQuats[i % 6].L.atAngle(dΘ))
      targetR.postmultiply(animationQuats[i % 6].R.atAngle(dΘ))
    }
  }
}

export function beginClarityTransition (final, duration) {
  // Remove prior transition state, if any:
  delete state.clarityTransition

  state.clarityTransition = {
    initial: state.clarityScale,
    final,
    duration
  }
}

function beginVelocityTransition (initial, final, duration) {
  // Remove prior transition state, if any:
  delete state.velocityTransition

  state.velocityTransition = {
    initial,
    final,
    duration
  }
}

function beginOrientationTransition (final, duration = 2000) {
  // Remove prior transition state, if any:
  delete state.orientationTransition

  state.orientationTransition = {
    initial: {
      // Copy current values
      animationSpeeds: [...state.animationSpeeds],
      modelL: Quaternion.from(state.modelL),
      modelR: Quaternion.from(state.modelR)
    },
    final,
    duration
  }

}

/**
 * Set state variables which will cause the lighting variables to begin
 * interpolation on successive frames.
 */
function beginLightingTransition (initial, final, duration = 2000) {
  // Remove prior transition state, if any:
  delete state.lightTransition

  state.lightTransition = {
    initial,
    final,
    duration
  }
}

export function beginFadeIn (duration = 3000) {
  beginClarityTransition(
    1, duration/2)
  beginLightingTransition(
    new Lighting, state.currentAnimation.lighting, duration)
  beginVelocityTransition(
    Array(12).fill(0), state.animationSpeeds, duration/4)
}

/**
 * Return a 12-element array of numbers (matching the 12 dimensions of
 * velocity), which are linearly interpolated between two other such arrays.
 */
function interpolateVelocities (initial, final, t) {
  return initial.map((v,i) => lerpScalar(v, final[i], t))
}

/**
 * Return a set of lighting conditions which is linearly interpolated between
 * two other sets.
 */
function interpolateLighting (initial, final, t) {
  const interpolated = new Lighting

  for (const key of ['specularLights', 'diffuseLights']) {
    for (const index in initial[key]) {
      interpolated[key][index] = gammaInterpolateLight(
        initial[key][index], final[key][index], t
      )
    }
  }

  interpolated.glow = gammaInterpolateLight(initial.glow, final.glow, t)
  interpolated.membrane = gammaInterpolateLight(initial.membrane, final.membrane, t)

  interpolated.nearFrameColor =
    initial.nearFrameColor.map(
      (v,i) => lerpScalar(v, final.nearFrameColor[i], t))
  interpolated.farFrameColor =
    initial.farFrameColor.map(
      (v,i) => lerpScalar(v, final.farFrameColor[i], t))

  interpolated.diffuseOpacity =
    lerpScalar(initial.diffuseOpacity, final.diffuseOpacity, t)
  interpolated.specularOpacity =
    lerpScalar(initial.specularOpacity, final.specularOpacity, t)
  interpolated.borderSpecularity =
    lerpScalar(initial.borderSpecularity, final.borderSpecularity, t)

  return interpolated
}

function gammaInterpolateLight (first, second, t) {
  const isPositive = [
    first.rgba[0] >= 0 && second.rgba[0] >= 0,
    first.rgba[1] >= 0 && second.rgba[1] >= 0,
    first.rgba[2] >= 0 && second.rgba[2] >= 0,
  ]

  function linearize (c) {
    if (Math.abs(c) < 0.04045) return c / 12.92
    return Math.pow((c + 0.055)/1.055, 2.4)
  }

  function compress (c) {
    if (Math.abs(c) < 0.0031308) return c * 12.92
    return 1.055 * Math.pow(c, 1/2.4) - 0.055
  }

  // For negative values, just use regular, non-decompressed interpolation:
  const firstLinear = [
    isPositive[0]
      ? linearize(first.rgba[0])
      : first.rgba[0],
    isPositive[1]
      ? linearize(first.rgba[1])
      : first.rgba[1],
    isPositive[2]
      ? linearize(first.rgba[2])
      : first.rgba[2],
    first.rgba[3]
  ]

  const secondLinear = [
    isPositive[0]
      ? linearize(second.rgba[0])
      : second.rgba[0],
    isPositive[1]
      ? linearize(second.rgba[1])
      : second.rgba[1],
    isPositive[2]
      ? linearize(second.rgba[2])
      : second.rgba[2],
    second.rgba[3]
  ]

  const interpolated = [
    lerpScalar(firstLinear[0], secondLinear[0], t),
    lerpScalar(firstLinear[1], secondLinear[1], t),
    lerpScalar(firstLinear[2], secondLinear[2], t),
    lerpScalar(firstLinear[3], secondLinear[3], t)
  ]

  return new Lighting.Light({
    xyzw: first.xyzw.map((v, i) => lerpScalar(v, second.xyzw[i], t)),
    rgba: [
      isPositive[0]
        ? compress(interpolated[0])
        : interpolated[0],
      isPositive[1]
        ? compress(interpolated[1])
        : interpolated[1],
      isPositive[2]
        ? compress(interpolated[2])
        : interpolated[2],
      interpolated[3]
  ]})
}

function lerpLight (first, second, t) {
  return new Lighting.Light({
    xyzw: first.xyzw.map((v, i) => lerpScalar(v, second.xyzw[i], t)),
    rgba: first.rgba.map((v, i) => lerpScalar(v, second.rgba[i], t))
  })
}

function lerpScalar (first, second, t) {
  return t * second + (1-t) * first
}

/**
 * Initialize the animation state array with objects revived from
 * the JSON string describing their properties.
 */
function initAnimationCycler () {
  const animationStrings = JSON.parse(tesseractAnimations)
  for (const {name, string} of animationStrings) {
    const entry = JSON.parse(string)

    // The premultiplied alpha compositor in Chrome will truncate
    // pixels with zero alpha component, so provide a minimum alpha
    // value everywhere in the tesseract via the ambient glow color:
    if (entry.lighting.glow.rgba[3] === 0) {
      entry.lighting.glow.rgba[3] = 0.05
    }

    state.animationSet.push({
      title: name,
      modelL: Quaternion.parse(entry.Lstring),
      modelR: Quaternion.parse(entry.Rstring),
      animationSpeeds: entry.velocity,
      lighting: entry.lighting,
      active: true
    })

  }
}

export function shuffleUpcoming () {
  const shuffle = []
  state.upcomingAnimations = []

  const selected = state.animationSet.filter(a => a.active)

  for (let i = 0; i < selected.length; i++) {
    shuffle[i] = i
  }

  while (shuffle.length) {
    const n = Math.floor(Math.random() * shuffle.length)
    const index = shuffle.splice(n,1)[0]
    state.upcomingAnimations.push(selected[index])
  }

  // Prevent repeats, if there is more than one element:
  if (state.currentAnimation === state.upcomingAnimations[0]) {
    state.upcomingAnimations.push(state.upcomingAnimations.shift())
  }
}

function startDemo () {
  const duration = 2000
  const holdTime = 20000
  const zeroVelocities = Array(12).fill(0)

  shuffleUpcoming()
  // DEBUG
  const firstAnimation = state.animationSet.find(x => x.title === 'blossom')
  // const firstAnimation = state.upcomingAnimations.shift()

  state.currentAnimation = firstAnimation
  state.modelL = Quaternion.from(firstAnimation.modelL)
  state.modelR = Quaternion.from(firstAnimation.modelR)
  state.animationSpeeds = [...firstAnimation.animationSpeeds]
  // Turn the lights off for the first appearance:
  state.lighting = new Lighting

  // debug
  return

  state.countdowns.push({
    remaining: holdTime,
    callback: startNextAnimation
  })

  window.dispatchEvent(new CustomEvent('tesseract-change', {
    detail: state.currentAnimation}
  ))

  function startNextAnimation () {
    const nextAnimation = state.upcomingAnimations.shift()
    state.currentAnimation = nextAnimation
    window.dispatchEvent(new CustomEvent('tesseract-change', {
      detail: state.currentAnimation}
    ))

    if (!state.upcomingAnimations.length) { shuffleUpcoming() }

    beginOrientationTransition(nextAnimation, duration)

    state.countdowns.push({
      callback: () => {
        beginLightingTransition(
          state.lighting, nextAnimation.lighting, duration * 2
        )
      },
      remaining: duration
    })

    state.countdowns.push({
      callback: () => {
        beginVelocityTransition(
          zeroVelocities,
          nextAnimation.animationSpeeds.map(s => 1.3*s),
          duration / 4
          )
        },
      remaining: duration,
    })

    // Queue the next transition:
    state.countdowns.push({
      callback: startNextAnimation,
      remaining: holdTime
    })
  }
}

export function setGrabStyle (style) {
  state.grabStyle = style
}

function initListeners () {
  function updateBlurLevel () {
    if (el('main-canvas').clientWidth > 350) {
      state.blurPassCount = 4
    } else {
      state.blurPassCount = 2
    }
  }

  window.addEventListener('resize', event => {
    for (const s of [
      state.animation1
    ]) {
      const ctx = s.context
      ctx.canvas.width = ctx.canvas.clientWidth
      ctx.canvas.height = ctx.canvas.clientHeight
      ctx.viewport(0, 0, ctx.canvas.width, ctx.canvas.height)
      if (!s.keepAnimating) { requestAnimationFrame(s.draw) }
    }

    updateBlurLevel()
  })
  
  updateBlurLevel()

  const pointerdown = event => {
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.pointerdown = true
  }
  el('main-canvas').addEventListener('pointerdown', pointerdown)
  
  const pointerup = event => {
    state.pointerdown = false
    state.releasedViewL = state.viewL
    state.releasedViewR = state.viewR
    state.viewSnapT = 0
  }
  el('main-canvas').addEventListener('pointerup', pointerup)

  const pointerleave = event => {
    pointerup()
  }
  el('main-canvas').addEventListener('pointerleave', pointerleave)

  const pointermove = event => {
    
    if (state.pointerdown) {
      const nx = (event.clientX - state.lastX) / event.target.offsetWidth
      const ny = (event.clientY - state.lastY) / event.target.offsetHeight

      const tx = nx * π
      const ty = ny * π

      switch (state.grabStyle) {
        case '3d':
          // Global rotation in XZ:
          state.viewL.premultiply([0, Math.sin(tx*.75), 0, Math.cos(tx*.75)])
          state.viewR.postmultiply([0, -Math.sin(tx*.75), 0, Math.cos(tx*.75)])

          // Global rotation in YZ:
          state.viewL.premultiply([Math.sin(ty*.75), 0, 0, Math.cos(ty*.75)])
          state.viewR.postmultiply([-Math.sin(ty*.75), 0, 0, Math.cos(ty*.75)])
        break

        case '4d':
          // Global rotation in XW:
          state.viewL.premultiply([Math.sin(tx*.75), 0, 0, Math.cos(tx*.75)])
          state.viewR.postmultiply([Math.sin(tx*.75), 0, 0, Math.cos(tx*.75)])

          // Global rotation in YW:
          state.viewL.premultiply([0, Math.sin(-ty*.75), 0, Math.cos(-ty*.75)])
          state.viewR.postmultiply([0, Math.sin(-ty*.75), 0, Math.cos(-ty*.75)])
        break
      }

      state.viewL.normalize()
      state.viewR.normalize()
    }
      
    state.lastX = event.clientX
    state.lastY = event.clientY
  }

  el('main-canvas').addEventListener('pointermove', pointermove)
}
