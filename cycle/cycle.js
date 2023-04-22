'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

const log = console.log.bind(console)
const el = document.getElementById.bind(document)

const state = {
  resizeCount: 0,
  animationSpeeds: [],
  // Lighting object storing color and direction of all current light sources:
  lighting: new Lighting,
  // The animation slider to update when a roller changes an animation speed:
  correspondingAnimationSlider: null,
  // The property to affect when receiving roller input:
  rollerTarget: 'orientation',
  // The lighting object whose direction to change:
  targetLight: null,
  // If specified, only read roller input at discrete steps:
  constrainAngles: 0,
  // 12-plane rotation control state
  rollerPos: [{x: 0, y: 0}, {x: 0, y: 0},{x: 0, y: 0},{x: 0, y: 0}],
  // The amount of (normalized) mouse input which has not yet been processed:
  positionRemainder: {x: 0, y: 0},
  currentRollerIndex: 0,
  rollGlobal: false,
  rollerLockX: false,
  rollerLockY: false,
  
  turnL: new Quaternion,
  turnR: new Quaternion,

  // Elastic camera drag state
  viewL: new Quaternion,
  viewR: new Quaternion,
  releasedViewL: new Quaternion,
  releasedViewR: new Quaternion,
  viewSnapT: 1,

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

  animation1: { keepAnimating: true },
  animationSet: [],
  animationCycle: {},
  upcomingAnimations: []
}

function logError (message) {
  document.querySelector('.feedback').style['visibility'] = 'visible'
  document.querySelector('.feedback').textContent += message + '\n'
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  queueMicrotask(initialize)
}

function initialize () {
try {
  // These have been exposed as global objects to allow VSCode
  // to parse the symbols before runtime.
  // const shaders = buildShaders()
  // const geometry = buildGeometry()
  // const painters = buildPainters()
  initListeners()
  initAnimationCycler()
  startTemporaryDemo()
    
  for (const c of [
    el('main-canvas')
  ]) {
    if (c) {
      const rect = c.getBoundingClientRect()
      c.setAttribute('width', rect.width)
      c.setAttribute('height', rect.height)
    }
  }

  // n.b. alpha: false significantly improves performance on test platform.
  let gl = el('main-canvas').getContext(
    'webgl2', { alpha: false, premultipliedAlpha: true, antialias: false })
  if (!gl) {
    gl = el('main-canvas').getContext(
      'webgl', { alpha: false, premultipliedAlpha: true, antialias: false })
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
    el('fps-1').textContent = state.animation1.lastFPS.toFixed(1)
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
        fragmentShader: shaders.alphaCompositorFrag,
        mesh: geometry.texSquare,
        init: painters.initCompositor,
        draw: painters.drawCompositor
      },
    ])

  function easeQuartic(t) {
    return t < 0.5  ? 8 * t**4
                    : 1 - Math.pow(-2 * t + 2, 4) / 2
  }

  function applyTransitions () {
    this.t ??= 0
    this.tLast ??= this.dt

    // Only advance the time scalar while the user is not pausing animation:
    if (!state.pointerdown) {
      this.t += this.dt - this.tLast

      if (this.shared.animationState.needUpdate) {
        // Lighting transition updates
        // Perform interpolation while a desired final state is set:
        if (state.animationCycle.finalLighting) {
          // If not set, start running a separate clock for light transitions:
          state.animationCycle.tLightStart ??= this.t
          const dtLight = Math.min(1,
            (this.t - state.animationCycle.tLightStart)
              / state.animationCycle.lightTransitionDuration)

          state.lighting = interpolateLighting(
            state.animationCycle.initialLighting,
            state.animationCycle.finalLighting,
            dtLight
          )

          // Stop running the transition once it has reached its end:
          if (dtLight === 1) {
            state.animationCycle.finalLighting = null
          }
        }

        // Velocity updates:
        if (state.animationCycle.finalVelocities) {
          state.animationCycle.tVelocityStart ??= this.t
          const dtVelocity = Math.min(1,
            (this.t - state.animationCycle.tVelocityStart)
              / state.animationCycle.velocityTransitionDuration)

          state.animationSpeeds = interpolateVelocities(
            state.animationCycle.initialVelocities,
            state.animationCycle.finalVelocities,
            dtVelocity)

          // Stop running the transition once it has reached its end:
          if (dtVelocity === 1) {
            state.animationCycle.finalVelocities = null
          }
        }

        // debug -- move this down to an "else" on the following clause
        // Orientation updates:
        applyOrientationAnimations(
          state.animationSpeeds,
          state.modelL,
          state.modelR,
          this.dt - this.tLast)

        // When a new animation orientation is requested, interpolate an
        // intermediate state based on the prior behavior:
        if (state.animationCycle.finalOrientation) {
          state.animationCycle.tOrientationStart ??= this.t
          const dtOrientation = Math.min(1,
            (this.t - state.animationCycle.tOrientationStart)
              / state.animationCycle.orientationTransitionDuration)

          const tEase = easeQuartic(dtOrientation)

          applyOrientationAnimations(
            state.animationCycle.priorSpeeds,
            state.animationCycle.priorL,
            state.animationCycle.priorR,
            this.dt - this.tLast)

          state.modelL = Quaternion.slerpUnit(
            state.animationCycle.priorL,
            state.animationCycle.finalOrientation.modelL,
            tEase)

          state.modelR = Quaternion.slerpUnit(
            state.animationCycle.priorR,
            state.animationCycle.finalOrientation.modelR,
            tEase)

          if (dtOrientation === 1) {
            state.animationSpeeds = Array(12).fill(0)
            // [...state.animationCycle.finalOrientation.animationSpeeds]

            state.animationCycle.finalOrientation = null
          }
        }

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

    if (shared.animationState.requestScreenshot) {
      shared.animationState.requestScreenshot()
      shared.animationState.requestScreenshot = null
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

const rotationLabels = [
  'xy', 'xz', 'yz', 'xw', 'yw', 'zw',
  'XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW',
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

function beginVelocityTransition (initial, final, duration) {
  // Remove prior timestamp:
  delete state.animationCycle.tVelocityStart

  state.animationCycle.velocityTransitionDuration = duration
  state.animationCycle.initialVelocities = initial
  state.animationCycle.finalVelocities = final
}

function beginOrientationTransition (final, duration = 2000) {
  // Remove prior timestamp:
  delete state.animationCycle.tOrientationStart

  // Copy the current orientation and angular velocities:
  state.animationCycle.priorSpeeds = [...state.animationSpeeds]
  state.animationCycle.priorL = Quaternion.from(state.modelL)
  state.animationCycle.priorR = Quaternion.from(state.modelR)

  state.animationCycle.orientationTransitionDuration = duration
  state.animationCycle.finalOrientation = final
}

/**
 * Set state variables which will cause the lighting variables to begin
 * interpolation on successive frames.
 */
function beginLightingTransition (initial, final, duration = 2000) {
  // Remove prior timestamp:
  delete state.animationCycle.tLightStart

  state.animationCycle.lightTransitionDuration = duration
  state.animationCycle.initialLighting = initial
  state.animationCycle.finalLighting = final
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
      interpolated[key][index] = lerpLight(
        initial[key][index], final[key][index], t
      )
    }
  }

  interpolated.glow = lerpLight(initial.glow, final.glow, t)
  interpolated.membrane = lerpLight(initial.membrane, final.membrane, t)

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

// n.b. interpolations across negative values may not appear smooth:
// debug -- todo -- use compressed interpolation for those.
function gammaInterpolateLight (first, second, t) {
  function linearize (c) {
    if (Math.abs(c) < 0.04045) return c / 12.92
    if (c > 0) return Math.pow((c + 0.055)/1.055, 2.4)
    return -Math.pow((-c + 0.055)/1.055, 2.4)
  }

  function compress (c) {
    if (Math.abs(c) < 0.0031308) return c * 12.92
    if (c > 0) return 1.055 * Math.pow(c, 1/2.4) - 0.055
    return -(1.055 * Math.pow(-c, 1/2.4) - 0.055)
  }

  const firstLinear = [
    linearize(first.rgba[0]),
    linearize(first.rgba[1]),
    linearize(first.rgba[2]),
    first.rgba[3]
  ]

  const secondLinear = [
    linearize(second.rgba[0]),
    linearize(second.rgba[1]),
    linearize(second.rgba[2]),
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
      compress(interpolated[0]),
      compress(interpolated[1]),
      compress(interpolated[2]),
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

    state.animationSet.push({
      title: name,
      modelL: Quaternion.parse(entry.Lstring),
      modelR: Quaternion.parse(entry.Rstring),
      animationSpeeds: entry.velocity,
      lighting: entry.lighting
    })

  }
}

function shuffleUpcoming () {
  const shuffle = []
  state.upcomingAnimations = []

  for (let i = 0; i < state.animationSet.length; i++) {
    shuffle[i] = i
  }
  while (shuffle.length) {
    const n = Math.floor(Math.random() * shuffle.length)
    const index = shuffle.splice(n,1)[0]
    state.upcomingAnimations.push(state.animationSet[index])
  }
}

function startTemporaryDemo () {
  const duration = 3000
  const zeroVelocities = Array(12).fill(0)
  let frozen = false
  let interval1 = -1
  let timeout1 = -1
  let timeout2 = -1

  shuffleUpcoming()
  const firstAnimation = state.upcomingAnimations.pop()
  state.modelL = Quaternion.from(firstAnimation.modelL)
  state.modelR = Quaternion.from(firstAnimation.modelR)
  state.animationSpeeds = [...firstAnimation.animationSpeeds]
  state.lighting = firstAnimation.lighting

  interval1 = setInterval(startNextAnimation, 18000)
  setInterval(() => {
    // Check for two successive frozen states; restart if encountered.
    for (const s of state.animationSpeeds) {
      if(s) { return }
    }

    // debug -- hack solution to avoid freezing state
    if (frozen) {
      log('frozen! Restarting...')
      clearInterval(interval1)
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      startNextAnimation()
      interval1 = setInterval(startNextAnimation, 18000)
      state.animationSpeeds[0] = 0.000001
      frozen = false
      return
    }

    frozen = true
  }, 1000)


  function startNextAnimation () {
    const nextAnimation = state.upcomingAnimations.pop()
    if (!state.upcomingAnimations.length) { shuffleUpcoming() }

    beginOrientationTransition(
      nextAnimation,
      duration
    )

    timeout1 = setTimeout(() => {
      beginLightingTransition(
        state.lighting,
        nextAnimation.lighting,
        duration * 0.75)
    }, duration * 2/3)

    timeout2 = setTimeout(() => {
      beginVelocityTransition(
        zeroVelocities,
        nextAnimation.animationSpeeds.map(s => 1.5*s),
        duration / 4
      )
    }, duration);
  }
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

  const mouseleave = event => {
    pointerup()
  }
  el('main-canvas').addEventListener('mouseleave', mouseleave)

  const pointermove = event => {
    
    if (state.pointerdown) {
      const nx = (event.clientX - state.lastX) / event.target.offsetWidth
      const ny = (event.clientY - state.lastY) / event.target.offsetHeight

      const tx = nx * π
      const ty = ny * π

      state.viewL.premultiply([0, Math.sin(tx*.75), 0, Math.cos(tx*.75)])
      state.viewR.postmultiply([0, -Math.sin(tx*.75), 0, Math.cos(tx*.75)])

      state.viewL.premultiply([Math.sin(ty*.75), 0, 0, Math.cos(ty*.75)])
      state.viewR.postmultiply([-Math.sin(ty*.75), 0, 0, Math.cos(ty*.75)])

      state.viewL.normalize()
      state.viewR.normalize()
    }
      
    state.lastX = event.clientX
    state.lastY = event.clientY
  }

  el('main-canvas').addEventListener('pointermove', pointermove)
}

const tesseractAnimations = '[{"name":"blossom","string":"{\\"Lstring\\":\\"0.3770087083426957i + -0.7913019518279542j + 0.4250500001960014k + -0.2259162503972059\\",\\"Rstring\\":\\"-0.5671411517174197i + -0.3997880634675983j + 0.0339703232464508k + -0.7192818887397743\\",\\"velocity\\":[0,0,0,0,0.0625,0,0,0,0,0,0,-0.0625],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.03536487511244542,0.13252253894422736,-0.9905488893941868,-8.673617379884035e-19],\\"rgba\\":[0.6862745098039216,0.4117647058823529,1.2352941176470589,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.34901960784313724,0,0.07058823529411765,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.32941176470588235,0.403921568627451,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.27450980392156865,0.17647058823529413,0.615686274509804,0.10980392156862745]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.058823529411764705,0.047058823529411764,0.07058823529411765,0.5686274509803921]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.35294117647058826,0.12156862745098039,0.23921568627450981,0.09019607843137255],\\"diffuseOpacity\\":1,\\"specularOpacity\\":2,\\"borderSpecularity\\":0.2}}"},{"name":"first light","string":"{\\"Lstring\\":\\"0.1071288310610887i + -0.5278657488370966j + -0.0673330530359743k + 0.8398496441248096\\",\\"Rstring\\":\\"-0.0459106443189584i + 0.9243623345765215j + 0.1179090293992739k + 0.3599221415085698\\",\\"velocity\\":[0,0.0375,0,0,-0.05625,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0.4549019607843137,0.9568627450980393,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-1,-1,-1,0.14901960784313725]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-0.9019607843137255,0.011764705882352941,0.21568627450980393,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[-0.8196078431372549,0.10196078431372549,1,0.1411764705882353]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[-0.0392156862745098,-0.0392156862745098,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.11764705882352941,0,-0.09803921568627451,0.058823529411764705]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.17647058823529413,0.12156862745098039,0.058823529411764705,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.29411764705882354,0.08235294117647059,0,0.12549019607843137]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.043137254901960784,0.03137254901960784,0.1568627450980392,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.7843137254901961,0.23529411764705882,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":3,\\"borderSpecularity\\":0.4}}"},{"name":"aquarius","string":"{\\"Lstring\\":\\"0.3606987087850542i + -0.6427843814039939j + -0.0347757345848848k + -0.6749187571787967\\",\\"Rstring\\":\\"0.2324618090832823i + 0.5393663467140035j + 0.7056944671560963k + 0.3962836993609121\\",\\"velocity\\":[0,0.037500000000000006,0,0,0.037500000000000006,0,0,0,0,0,0,0.11249999999999999],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.11764705882352941,0.5411764705882353,0.6352941176470588,0.12941176470588234]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[1.4470588235294117,2.458823529411765,3,0.12941176470588234]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0.11764705882352941,1.011764705882353,0.5176470588235293,0.12941176470588234]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.6039215686274509,1.2078431372549019,1.015686274509804,3.67843137254902]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.18823529411764706,-0.11372549019607843,-0.12941176470588237,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.17254901960784313,-0.11764705882352941,-0.35294117647058826,0.25882352941176473]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.00392156862745098,0.3058823529411765,0.6392156862745098,0.1450980392156863]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.34901960784313724,0.19215686274509805,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"wintersun","string":"{\\"Lstring\\":\\"0.3719736765396583i + 0.2101507393543021j + -0.0868600418969983k + -0.8999597678969921\\",\\"Rstring\\":\\"-0.5675448115073667i + 0.3688262435741262j + 0.3145224238654931k + 0.6655341718267085\\",\\"velocity\\":[0,0.046875,0,0,-0.046875,0,0,0,0,-0.032812499999999994,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[2.9058823529411764,0,0,0.7835294117647059]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,1.2470588235294118,1.2470588235294118,0.7835294117647059]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[2.8705882352941177,1.223529411764706,0,0.36000000000000004]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,1.1803921568627451,6.698039215686275,1.828235294117647]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7176470588235294,0.09019607843137255,0,0.5098039215686274]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3254901960784314,0.2784313725490196,0.8627450980392157,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"trance","string":"{\\"Lstring\\":\\"-0.7227606368739261i + 0.1427279015970619j + 0.5724411835866986k + -0.3599401328360199\\",\\"Rstring\\":\\"0.1062919047636684i + 0.3554399758333309j + 0.9158459902528523k + -0.1535922416657187\\",\\"velocity\\":[0,0,0,0,0,0,0,0,0,0,-0.0525,0.0875],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[1,0,0,3]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0.7529411764705882,1.5058823529411764,3]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-2.7294117647058824,0.6588235294117647,1.2000000000000002,2.776470588235294]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3568627450980392,-0.5490196078431373,-4.145098039215687,7]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.8745098039215686,0.10588235294117647,0.13333333333333333,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0.07450980392156863,0.12941176470588237,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9725490196078431,0.5098039215686274,0.3137254901960784,0]},\\"nearFrameColor\\":[0.09411764705882353,0.4392156862745098,0.396078431372549,0],\\"farFrameColor\\":[1,1,1,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"anemochore","string":"{\\"Lstring\\":\\"-0.0805261893707946i + 0.2743728554710255j + 0.7017029562350887k + 0.6525703258675746\\",\\"Rstring\\":\\"0.2435454850858778i + 0.1498350015448846j + 0.8141109929302610k + 0.5054288873636178\\",\\"velocity\\":[0.05,0,0,0,0,-0.0625,-0.03125,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.2627450980392157,0.19607843137254902,0.1450980392156863,0]},{\\"xyzw\\":[0.6600685039065106,-0.21578419676780547,0.7174669903527193,-0.05466139707421265],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.3176470588235294,0.09411764705882353,0,0.2]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.9019607843137255,0.6823529411764706,0.5490196078431373,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.666527037335581,-0.5579300285182619,0.03514599234409593,-0.4931739561254359],\\"rgba\\":[0.21568627450980393,0.07450980392156863,0.043137254901960784,0.054901960784313725]},{\\"xyzw\\":[0.6037489214813726,-0.3757445940833738,0.006975561737554433,-0.7030324184315015],\\"rgba\\":[0.45098039215686275,0.20392156862745098,0.14901960784313725,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.4627450980392157,0.28627450980392155,0.1803921568627451,0.047058823529411764]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.23529411764705882,0.06274509803921569,0.050980392156862744,0.06666666666666667]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.27450980392156865,0.1568627450980392,0.23529411764705882,0.21568627450980393]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"ember iris","string":"{\\"Lstring\\":\\"-0.5579837100826338i + 0.7786196862397065j + -0.2465777870033310k + -0.1469862525466535\\",\\"Rstring\\":\\"0.7850300329947077i + 0.5489283048032018j + -0.1441205277920669k + -0.2482636440357161\\",\\"velocity\\":[0.03125,0,0,0,0,-0.06875,0,-0.0125,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,0,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.9921568627450981,0.023529411764705882,0.12156862745098039,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.24313725490196078,0.3176470588235294,0,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.11764705882352941,0.35294117647058826,0.9019607843137255,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7843137254901961,0,-0.2901960784313726,0.20784313725490197]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.06666666666666668,0.00392156862745098,0.34509803921568627,0]},\\"nearFrameColor\\":[0.0392156862745098,0.011764705882352941,0.00392156862745098,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"captured light","string":"{\\"Lstring\\":\\"0.8480253023376401i + 0.2909808138529828j + -0.4380945786750333k + 0.0652410353674748\\",\\"Rstring\\":\\"-0.6875523541633705i + 0.3206171828092015j + 0.4168948500298034k + -0.5006746112846883\\",\\"velocity\\":[0,0,0.05,0.06875,0,0,0,0,0,-0.0375,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.20392156862745098,0.22745098039215686,0.396078431372549,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.707106781,0,-0.707106781,0],\\"rgba\\":[-0.16862745098039217,-0.23529411764705882,-0.19215686274509805,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0,0,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.24313725490196078,0.21568627450980393,0.1568627450980392,0.03137254901960784]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"chromophore","string":"{\\"Lstring\\":\\"0.2461767777234436i + -0.1454713892950948j + 0.4874959217027777k + 0.8249744210049221\\",\\"Rstring\\":\\"-0.2729822245975122i + -0.0851213019540162j + 0.2852539441146569k + 0.9148033976466068\\",\\"velocity\\":[0.05,0,0,0,0,-0.05,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.8901960784313725,0.5490196078431373,0.45098039215686275,0.19607843137254902]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.2901960784313726,0.1843137254901961,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.19607843137254902,-1,0.5176470588235295,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3764705882352941,0.11372549019607843,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.34111195854061166,-0.4786795739877712,2.949029909160572e-17,-0.8090169943749477],\\"rgba\\":[-0.15294117647058825,0.16862745098039217,0.10980392156862745,0.19607843137254902]},{\\"xyzw\\":[0.13048778609679595,-0.573118173234877,2.42861286636753e-17,-0.809016994374948],\\"rgba\\":[0.1843137254901961,-0.1607843137254902,0.16862745098039217,0.19607843137254902]},{\\"xyzw\\":[0,0.5877852522924736,0,-0.8090169943749472],\\"rgba\\":[0.27450980392156865,0.058823529411764705,-0.19607843137254902,0.19607843137254902]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.39215686274509803,0.22745098039215686,0.5294117647058824,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.0784313725490196,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.0392156862745098,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"}]'
