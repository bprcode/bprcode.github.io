'use strict';
const log = console.log.bind(console)
const el = document.getElementById.bind(document)

const state = {
  sliders: [],
  checkboxes: [],
  animationSpeeds: [],
  // Lighting object storing color and direction of all current light sources:
  lighting: new Lighting,
  // The animation slider to update when a roller changes an animation speed:
  correspondingAnimationSlider: null,
  // The property to affect when receiving roller input:
  rollerTarget: 'orientation',
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

  // Scene lighting state
  

  // device orientation angles
  alphaIndex: 0, averageAlpha: 0, rollingAlpha: Array(20).fill(0),
  betaIndex: 0, averageBeta: 0, rollingBeta: Array(20).fill(0),
  gammaIndex: 0, averageGamma: 0, rollingGamma: Array(20).fill(0),
  animation1: { keepAnimating: true },
  animation2: { keepAnimating: true }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  queueMicrotask(initialize)
}

function logError (message) {
  document.querySelector('.feedback').style['visibility'] = 'visible'
  document.querySelector('.feedback').textContent += message
}

function initialize () {
try {
  // These have been exposed as global objects to allow VSCode
  // to parse the symbols before runtime.
  // const shaders = buildShaders()
  // const geometry = buildGeometry()
  // const painters = buildPainters()

  el('composition-list-textarea').value =
    localStorage.getItem('compositions') || defaultCompositions
  el('json-textarea').value = localStorage.getItem('palette')
  initListeners()
  loadPalette()
  loadCompositions()

  for (const c of [
    el('main-canvas'),
    el('second-canvas')
  ]) {
    if (c) {
      const rect = c.getBoundingClientRect()
      c.setAttribute('width', rect.width)
      c.setAttribute('height', rect.height)
    }
  }

  let gl = el('main-canvas').getContext(
    'webgl2', { alpha: false, premultipliedAlpha: false, antialias: false })
  if (!gl) {
    gl = el('main-canvas').getContext(
      'webgl', { alpha: false, premultipliedAlpha: false, antialias: false })
  }

  let gl2 = el('second-canvas').getContext(
      'webgl2', { alpha: false, premultipliedAlpha: false, antialias: false  })
  if (!gl2) {
    gl2 = el('second-canvas').getContext(
      'webgl', { alpha: false, premultipliedAlpha: false, antialias: false })
  }

  for (const [ctx, label] of [
    [gl, el('first-title').querySelector('.view-label')],
    [gl2, el('second-title').querySelector('.view-label')]
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

  state.animation1.context = gl
  state.animation1.showFPS = () => {
    el('fps-1').textContent = state.animation1.lastFPS.toFixed(1)
  }
  state.animation1.draw = glPipeline(gl,
    { animationState: state.animation1,
      nearPlane: 1,
      farPlane: 100,
      applyView: matrixView
    },
  [
    {
      vertexShader: shaders.projector4dVert,
      fragmentShader: shaders.greenFromWFrag,
      mesh: geometry.donutTesseract,
      components: 4,
      init: painters.initClearTesseract,
      draw: painters.drawDonutTesseract
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
      fragmentShader: shaders.blurCompositorFrag,
      mesh: geometry.texSquare,
      init: painters.initTesseractCompositor,
      draw: painters.drawTesseractCompositor
    },
    // { // Draw diffuse light panes:
    //   vertexShader: shaders.normals4dVert,
    //   fragmentShader: shaders.glassDiffuseFrag,
    //   mesh: geometry.normalTesseract,
    //   components: 4,
    //   init: painters.initGlassTesseract,
    //   draw: painters.drawGlassTesseract
    // },
    { // Draw glittery faces
      vertexShader: shaders.normals4dVert_ALTERNATE,
      fragmentShader: shaders.glassGlitterFrag,
      mesh: geometry.normalTesseract,
      components: 4,
      init: painters.initGlassTesseract,
      draw: painters.drawGlassTesseract
    },
  ])

  state.animation2.context = gl2
  state.animation2.showFPS = () => {
    el('fps-2').textContent = state.animation2.lastFPS.toFixed(1)
  }
  state.animation2.draw = glPipeline(gl2,
    { animationState: state.animation2,
      nearPlane: 1,
      farPlane: 100,
      applyView: quatView
    },
  [
    {
      vertexShader: shaders.quatProjectorVert,
      fragmentShader: shaders.variableFrameFrag,
      mesh: geometry.donutTesseract,
      components: 4,
      init: painters.initClearTesseract,
      draw: painters.drawDonutTesseract
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
      fragmentShader: shaders.blurCompositorFrag,
      mesh: geometry.texSquare,
      init: painters.initTesseractCompositor,
      draw: painters.drawTesseractCompositor
    },
    { // Draw diffuse light panes (with a little glow):
      vertexShader: shaders.quatNormalsWorldVert,
      fragmentShader: shaders.membraneTest,
      opacityFunction: opacityYin,
      mesh: geometry.normalTesseract,
      components: 4,
      init: painters.initGlassTesseract,
      draw: painters.drawGlassTesseract
    },
    { // Draw glittery faces
      vertexShader: shaders.quatNormalsWorldVert,
      fragmentShader: shaders.glassGlitterFrag,
      opacityFunction: opacityYang,
      mesh: geometry.normalTesseract,
      components: 4,
      init: painters.initGlassTesseract,
      draw: painters.drawGlassTesseract
    }
  ])

  function diminish (x) {
    return -1 / (x + 1) + 1;
  }

  function opacityYin () {
    return state.lighting.diffuseOpacity
    // return 0
    // return diminish((1 - Math.sin(π/2 + τ * this.dt/10000)) ** 6)
  }

  function opacityYang () {
    return state.lighting.specularOpacity
    // return 1
    // return diminish((1 - Math.sin(3*π/2 + τ * this.dt/10000)) ** 6)
  }

  // debug -- test for arbitrary 3-plane rotation
  const e0 = [ -0.7071067811865476, 0, 0.7071067811865476 ]
  const e1 = [ -0.40824829046381617, 0.8164965809277729, -0.40824829046381617 ]
  const e2 = crossProduct(e0, e1)
  const E = [
    ...e0, ...e1, ...e2
  ]
  const Einv = inverse3x3(E)
  function Rz3 (theta) { // column-major
    return [
      Math.cos(theta), Math.sin(theta), 0,
      -Math.sin(theta), Math.cos(theta), 0,
      0, 0, 1
    ]
  }
  function ident3 (M) {
    M[0] = 1; M[3] = 0; M[6] = 0;
    M[1] = 0; M[4] = 1; M[7] = 0;
    M[2] = 0; M[5] = 0; M[8] = 1;
  }
  const arbitrary = []
  const arb4 = []
  arb4[3] = 0; arb4[7] = 0; arb4[11] = 0;
  arb4[12] = 0; arb4[13] = 0; arb4[14] = 0; arb4[15] = 1;

  function easeQuartic(t) {
    return t < 0.5  ? 8 * t**4
                    : 1 - Math.pow(-2 * t + 2, 4) / 2
  }

  function quatView () {
    this.t ??= 0
    this.tLast ??= this.dt

    if (!state.pointerdown) {
      this.t += this.dt - this.tLast
      if (this.shared.animationState.needUpdate) {
        applyOrientationAnimations(this.dt - this.tLast)

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

  function matrixView () {
    this.t ??= 0
    this.tLast ??= this.dt

    if (!state.pointerdown) {
      this.t += this.dt - this.tLast
    }
    this.tLast = this.dt

    ident3(arbitrary)
    // E Rz Einv
    mult3(arbitrary, Einv, arbitrary)
    mult3(arbitrary, Rz3(this.t * τ / 20000), arbitrary)
    mult3(arbitrary, E, arbitrary)
    arb4[0] = arbitrary[0]; arb4[1] = arbitrary[1]; arb4[2] = arbitrary[2];
    arb4[4] = arbitrary[3]; arb4[5] = arbitrary[4]; arb4[6] = arbitrary[5];
    arb4[8] = arbitrary[6]; arb4[9] = arbitrary[7]; arb4[10] = arbitrary[8];
    mult4(this.M3, arb4, this.M3)
    // mult4(this.M3, rotateYZ(Math.sin(this.t /12000) * τ), this.M3)

    // Single 4D rotation for comparison
    mult4(this.M4,
        rotateYW(τ * Math.sin(π/4 + this.t / 6750)),
        this.M4)

    // Apply user input rotations
    // mult4(this.M3, rotateXZ(state.yaw), this.M3)
    // mult4(this.M3, rotateYZ(state.pitch), this.M3)
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
  if (!shared.animationState) { throw new Error('animationState needed.')}

  polyfillExtensions(gl)

  shared.nearPlane ??= 0.1
  shared.farPlane ??= 1000

  log('using near=' + shared.nearPlane, ' far=' + shared.farPlane)
  shared.projection = frustum({ near: shared.nearPlane,
                                far: shared.farPlane,
                                fov: 20, aspect: 1.0 })

  for (const p of phases) {
    if (!p.mesh) { throw new Error('Mesh needed.')}
    if (!p.vertexShader) { throw new Error('Vertex shader needed.')}
    if (!p.fragmentShader) { throw new Error('Fragment shader needed.')}
    if (!p.draw) { throw new Error('Draw method needed.')}

    // Initialize rendering phase
    p.gl = gl
    p.shared = shared
    p.clearColor ??= [0.1, 0.1, 0.1, 1]
    p.drawMode ??= gl.LINE_STRIP
    p.components ??= 3 // Components to use for position vertices

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
    p.time = gl.getUniformLocation(p.program, 'time')
    p.osc = gl.getUniformLocation(p.program, 'osc')
    p.mouse = gl.getUniformLocation(p.program, 'mouse')
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
  gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

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

    gl.clearColor(0.0, 0.0, 0.0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    for (const p of phases) {
      p.dt = dt
      gl.bindVertexArray(p.vao)
      gl.useProgram(p.program)

      gl.uniform1f(p.time, dt)
      gl.uniform1f(p.osc, Math.sin(dt/1000))
      gl.uniform2fv(p.mouse, [state.nx, state.ny])

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

function floatFromHex (hex) {
  const composite = parseInt(hex, 16)
  return {
    r: (composite >> 16 & 0xff) / 0xff,
    g: (composite >> 8 & 0xff) / 0xff,
    b: (composite & 0xff) / 0xff
  }
}

function hexFromFloatRGB (floatRGB) {
  const positiveRGB = [...floatRGB]
  const negativeRGB = [...floatRGB]
  for (let i = 0; i < 3; i++) {
    if (positiveRGB[i] < 0) { positiveRGB[i] = 0 }
    if (negativeRGB[i] > 0) { negativeRGB[i] = 0 }
    negativeRGB[i] = Math.abs(negativeRGB[i])
  }

  return {
    positive: '#' +
      Math.round(positiveRGB[0] * 0xff).toString(16).padStart(2,'0')
      + Math.round(positiveRGB[1] * 0xff).toString(16).padStart(2,'0')
      + Math.round(positiveRGB[2] * 0xff).toString(16).padStart(2,'0'),
    negative: '#' +
      Math.round(negativeRGB[0] * 0xff).toString(16).padStart(2,'0')
      + Math.round(negativeRGB[1] * 0xff).toString(16).padStart(2,'0')
      + Math.round(negativeRGB[2] * 0xff).toString(16).padStart(2,'0')
  }
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

function applyOrientationAnimations (dt) {
  for (const [i,s] of state.animationSpeeds.entries()) {
    if (Math.abs(s) < 0.000001) { continue }
    const dΘ = dt * s * π / 1000

    // The first six sliders control local rotations, the next are global.
    if (i < 6) {
      state.modelL.postmultiply(animationQuats[i].L.atAngle(dΘ))
      state.modelR.premultiply(animationQuats[i].R.atAngle(dΘ))
    } else {
      state.modelL.premultiply(animationQuats[i % 6].L.atAngle(dΘ))
      state.modelR.postmultiply(animationQuats[i % 6].R.atAngle(dΘ))
    }
  }

  el('current-l').textContent = state.modelL.toFixedString()
  el('current-r').textContent = state.modelR.toFixedString()
}

function syncPickers () {
  const positives = document.querySelectorAll('.light-picker')
  const negatives = document.querySelectorAll('.light-negative')

  for (const [i, rgb] of [
    state.lighting.specularLights[0].rgb,
    state.lighting.specularLights[1].rgb,
    state.lighting.specularLights[2].rgb,
    state.lighting.specularLights[3].rgb,
    state.lighting.diffuseLights[0].rgb,
    state.lighting.diffuseLights[1].rgb,
    state.lighting.diffuseLights[2].rgb,
    state.lighting.glow.rgb,
    state.lighting.membrane.rgb
  ].entries())
  {
    const hexes = hexFromFloatRGB(rgb)
    positives[i].value = hexes.positive
    negatives[i].value = hexes.negative
  }

  el('near-frame-color').value =
    hexFromFloatRGB(state.lighting.nearFrameColor).positive
  el('far-frame-color').value =
    hexFromFloatRGB(state.lighting.farFrameColor).positive
}

function takeLightingSnapshot (source = state) {
  const snap = document.createElement('div')
  const img = document.createElement('img')
  const close = document.createElement('button')
  const tempObject = {}

  // Create new snapshot element
  snap.classList.add('individual-snapshot')
  snap.classList.add('lighting-snapshot')
  snap.classList.add('square-shadow')
  snap.dataset.lightData = JSON.stringify(source.lighting)

  snap.addEventListener('click', handleLightingClick)

  if (source === state) {
    // Add snapshot image, request that it later be filled by renderer
    img.width = 48
    img.height = 48
    snap.append(img)
    // Set a screenshot request callback:
    state.animation2.requestScreenshot = copyScreenshot
  } else {
    // Skip the screenshot for loaded arrangements; write generic label.
    const count =
      document.querySelector('.light-arrangements').children.length
    const label = document.createElement('div')
    label.textContent = count + 1
    label.classList.add('generic-position-numeral')
    snap.append(label)
  }

  // Add a close button.
  close.classList.add('close-button')
  close.addEventListener('click', releaseSnap)
  snap.append(close)

  // Append the completed snap element.
  document.querySelector('.light-arrangements').append(snap)

  // Update the JSON data
  outputPalette()

  function handleLightingClick () {
    state.lighting = JSON.parse(this.dataset.lightData)
    syncPickers()
    outputPalette()
  }

  function copyScreenshot () {
    this.context.canvas.toBlob(blob => {
      tempObject.src = URL.createObjectURL(blob)
      img.src = tempObject.src
    })
  }

  function releaseSnap () {
    URL.revokeObjectURL(tempObject.src)
    img.src = null
    tempObject.src = null
    snap.remove()
  }
}

function takePositionSnapshot (source = state) {
  const snap = document.createElement('div')
  const img = document.createElement('img')
  const close = document.createElement('button')
  const tempObject = {}

  // Create new snapshot element
  snap.classList.add('individual-snapshot')
  snap.classList.add('position-snapshot')
  snap.classList.add('square-shadow')
  snap.dataset.quatL = source.modelL.toString()
  snap.dataset.quatR = source.modelR.toString()

  snap.addEventListener('click', handleSnapshotClick)

  if (source === state) {
    // Add snapshot image, request that it later be filled by renderer
    img.width = 48
    img.height = 48
    snap.append(img)
    // Set a screenshot request callback:
    state.animation2.requestScreenshot = copyScreenshot
  } else {
    // Skip the screenshot for loaded orientations; write generic label.
    const count =
      document.querySelector('.position-snapshots').children.length
    const label = document.createElement('div')
    label.textContent = count + 1
    label.classList.add('generic-position-numeral')
    snap.append(label)
  }

  // Add a close button.
  close.classList.add('close-button')
  close.addEventListener('click', releaseSnap)
  snap.append(close)

  // Append the completed snap element.
  document.querySelector('.position-snapshots').append(snap)

  // Update the JSON data
  outputPalette()

  function handleSnapshotClick () {
    // Initiate a slerp between the current and target model orientations:
    state.initialModelL = state.modelL
    state.initialModelR = state.modelR
    state.finalModelL = Quaternion.parse(this.dataset.quatL)
    state.finalModelR = Quaternion.parse(this.dataset.quatR)
    state.modelSnapT = 0

    // Write palette, overwriting the "current" property with the
    // intended final orientation:
    outputPalette({
      current: {
        Lstring: state.finalModelL.toString(),
        Rstring: state.finalModelR.toString()
      }
    })
  }

  function copyScreenshot () {
    this.context.canvas.toBlob(blob => {
      tempObject.src = URL.createObjectURL(blob)
      img.src = tempObject.src
    })
  }

  function releaseSnap () {
    URL.revokeObjectURL(tempObject.src)
    img.src = null
    tempObject.src = null
    snap.remove()
  }
}

function takeVelocitySnapshot (source = state) {
  const snap = document.createElement('div')
  const close = document.createElement('button')
  const canvas = document.createElement('canvas')
  const dimension = 48
  canvas.width = dimension
  canvas.height = dimension
  const ctx = canvas.getContext('2d')

  // Create new snapshot element
  snap.classList.add('individual-snapshot')
  snap.classList.add('velocity-snapshot')
  snap.classList.add('square-shadow')
  snap.dataset.velocityList = source.animationSpeeds.toString()

  snap.addEventListener('click', handleSnapshotClick)

  // Add a close button.
  close.classList.add('close-button')
  close.addEventListener('click', releaseSnap)
  snap.append(close)

  // Draw velocity tracks.
  const styles = [
    { x: 0.707, y: 0.707, color: '#00f'},//xy
    { x: 1.000, y: 0.000, color: '#f00'},//xz
    { x: 0.000, y: 1.000, color: '#0f0'},//yz
    { x: 0.866, y: 0.500, color: '#08f'},//xw
    { x: 0.500, y: 0.866, color: '#0f8'},//yw
    { x: 0.707, y: 0.707, color: '#88f'},//zw
  ]
  for (const [i, vel] of Object.entries(source.animationSpeeds)) {
    ctx.beginPath()
    if (Math.abs(vel) > 0.01) {
      ctx.strokeStyle = styles[i % 6].color
      if (i < 6) {
        ctx.moveTo(dimension/2, dimension/2)
        ctx.lineTo(dimension/2 + dimension/2 * styles[i%6].x * vel/0.5,
                    dimension/2 + dimension/2 * styles[i%6].y * vel/0.5)
      } else {
        const r = dimension/4 * (0.5 + i%6/6)
        ctx.moveTo(dimension/2 + styles[i%6] * r,
                    dimension/2 + styles[i%6] * r)
        ctx.arc(dimension/2, dimension/2, r,
          Math.atan2(styles[i%6].y, styles[i%6].x),
          Math.atan2(styles[i%6].y, styles[i%6].x) + π * vel/0.5)
      }
    }
    ctx.stroke()
  }
  snap.append(canvas)

  // Append the completed snap element.
  document.querySelector('.velocity-states').append(snap)

  // Update the JSON data
  outputPalette()

  function handleSnapshotClick () {
    log('Loading velocity state:', snap.dataset.velocityList)
    const velocities =
      snap.dataset.velocityList.split(',').map(e => Number(e))

    for (const [i,e] of
      document.querySelectorAll('.animation-speeds input').entries()) {
      
      e.value = velocities[i]
      e.dispatchEvent(new Event('input'))
    }

    outputPalette()
  }

  function releaseSnap () {
    snap.remove()
  }
}

function clearSnapshots () {
  let s = document.querySelector('.individual-snapshot')
  while (s) {
    s.remove()
    s = document.querySelector('.individual-snapshot')
  }
}

function clearAnimationSliders () {
  for (const [i,e] of
    document.querySelectorAll('.animation-speeds input').entries()) {
    
    e.value = 0
    e.dispatchEvent(new Event('input'))
  }
}

function resetState () {
  clearAnimationSliders()
  el('target-orientation').checked = true
  el('target-orientation').dispatchEvent(new Event('input'))
  state.modelL = new Quaternion
  state.modelR = new Quaternion
}

// Output a JSON string describing the currently snapshotted states.
function outputPalette (overwrite) {
  const palette = {}

  palette.orientations = []
  document.querySelectorAll('.position-snapshot')
    .forEach(s => palette.orientations.push({
      L: s.dataset.quatL, 
      R: s.dataset.quatR }))

  palette.spins = []
  document.querySelectorAll('.velocity-snapshot')
    .forEach(s => palette.spins.push(
      s.dataset.velocityList.split(',').map(e => Number(e))
    ))

  palette.arrangements = []
  document.querySelectorAll('.lighting-snapshot')
    .forEach(s => palette.arrangements.push(
      JSON.parse(s.dataset.lightData)
    ))

  palette.current = {
    Lstring: state.modelL.toString(),
    Rstring: state.modelR.toString(),
    velocity: state.animationSpeeds || Array(12).fill(0),
    lighting: state.lighting
  }
  
  Object.assign(palette.current, overwrite?.current)

  const json = JSON.stringify(palette)
  el('json-textarea').value = json
  localStorage.setItem('palette', json)
}

// Read compositions from their textarea, add them to the UI.
function loadCompositions () {
  const list = JSON.parse(el('composition-list-textarea').value)
  // Drop the old list:
  el('composition-list').textContent = ''
  for (const e of list) {
    const composition = JSON.parse(e.string)
    // Revive the state object:
    addComposition({
      modelL: Quaternion.parse(composition.Lstring),
      modelR: Quaternion.parse(composition.Rstring),
      animationSpeeds: composition.velocity,
      lighting: composition.lighting
    }, e.name)
  }
}

// Read values from the data textarea, load them into the current state.
function loadPalette () {
  try {
    const palette = JSON.parse(el('json-textarea').value)

    clearSnapshots()

    for (const e of palette.orientations) {
      takePositionSnapshot({ modelL: e.L, modelR: e.R })
    }

    for (const v of palette.spins) {
      takeVelocitySnapshot({ animationSpeeds: v })
    }

    for (const a of palette.arrangements) {
      takeLightingSnapshot({ lighting: a })
    }

    state.modelL = Quaternion.parse(palette.current.Lstring)
    state.modelR = Quaternion.parse(palette.current.Rstring)
    state.animationSpeeds = palette.current.velocity
    state.lighting = palette.current.lighting
    syncPickers()

    el('diffuse-opacity').value = state.lighting.diffuseOpacity
    el('specular-opacity').value = state.lighting.speuclarOpacity
    el('diffuse-opacity').dispatchEvent(new Event('input'))
    el('specular-opacity').dispatchEvent(new Event('input'))

    for (const [i,e] of
      document.querySelectorAll('.animation-speeds input').entries()) {
      
      e.value = state.animationSpeeds[i]
      e.dispatchEvent(new Event('input'))
    }

    // Writing the snapshots overwrote the palette string, so regenerate it:
    outputPalette()

  } catch (e) {
    log('No initial palette available.')
  }
}

function generateName () {
  const gems = [
    'amethyst', 'jade', 'sapphire', 'pearl', 'amber', 'emerald', 'lapis',
    'quartz', 'turquoise', 'opal', 'topaz', 'onyx', 'carnelian', 'agate',
    'malachite', 'tourmaline', 'ruby', 'pyrite', 'citrine', 'peridot',
    'jasper', 'fluorite', 'aventurine', 'zircon', 'nephrite', 'spinel',
    'sunstone', 'beryl', 'kyanite', 'rhodochrosite', 'titanite',
    'amber', 'coral'
  ]

  const birds = [
    'passerine', 'sandpiper', 'crow', 'mallard', 'owl', 'cuckoo', 'rail',
    'grebe', 'kingfisher', 'cormorant', 'stork', 'pelican', 'parrot',
    'crane', 'seagull', 'sparrow', 'hummingbird', 'dove', 'avocet',
    'thrush', 'albatross', 'shrike', 'raven', 'starling', 'wren', 'magpie',
    'citril', 'oriole', 'puffin', 'crake', 'ibis', 'jay', 'condor',
    'flamingo', 'robin', 'myna', 'canary', 'lark'
  ]

  return gems[Math.floor(Math.random() * gems.length)]
    + ' ' + birds[Math.floor(Math.random() * birds.length)]
}

function outputCompositionText () {
  const entries = document.querySelectorAll('.composition-entry')
  const compositions = []

  for (const c of entries) {
    const name = c.dataset.catchyName
    const string = c.dataset.compositionString
    compositions.push({ name, string })
  }

  const stringified = JSON.stringify(compositions)
  el('composition-list-textarea').value = stringified
  localStorage.setItem('compositions', stringified)
}

// Record the current state variables as a composition entry
function addComposition (source = state, name) {
  const li = document.createElement('li')
  const restoreButton = document.createElement('button')
  const closeButton = document.createElement('button')
  const input = document.createElement('input')

  const composition = {
    Lstring: source.modelL.toString(),
    Rstring: source.modelR.toString(),
    velocity: source.animationSpeeds || Array(12).fill(0),
    lighting: source.lighting
  }
  const compositionString = JSON.stringify(composition)
  const generatedName = name || generateName()

  li.classList.add('composition-entry')
  restoreButton.classList.add('composition-restore-button')
  closeButton.classList.add('composition-close-button')
  input.setAttribute('type', 'text')
  input.value = generatedName
  li.append(restoreButton)
  li.append(input)
  li.append(closeButton)
  li.dataset.compositionString = compositionString
  li.dataset.catchyName = generatedName
  li.style.backgroundColor = `hsl(${Math.round(Math.random()*360)},`
    +`40%,${Math.round(Math.random()*10)+15}%)`

  input.addEventListener('focus', () => {
    input.select()
  })

  input.addEventListener('input', event => {
    li.dataset.catchyName = event.target.value
    outputCompositionText()
  })

  closeButton.addEventListener('click', () => {
    li.remove()
    outputCompositionText()
  })

  restoreButton.addEventListener('click', () => {
    const restored = JSON.parse(compositionString)
    state.modelL = Quaternion.parse(restored.Lstring)
    state.modelR = Quaternion.parse(restored.Rstring)
    state.animationSpeeds = restored.velocity
    state.lighting = restored.lighting

    // Update the UI to match
    syncPickers()
    el('diffuse-opacity').value = state.lighting.diffuseOpacity
    el('specular-opacity').value = state.lighting.speuclarOpacity
    el('diffuse-opacity').dispatchEvent(new Event('input'))
    el('specular-opacity').dispatchEvent(new Event('input'))
    for (const [i,e] of
      document.querySelectorAll('.animation-speeds input').entries()) {
      
      e.value = state.animationSpeeds[i]
      e.dispatchEvent(new Event('input'))
    }
  })

  el('composition-list').append(li)
  outputCompositionText()
}

function initListeners () {
  window.addEventListener('resize', event => {
    for (const s of [
      state.animation1,
      state.animation2
    ]) {
      const ctx = s.context
      ctx.canvas.width = ctx.canvas.clientWidth
      ctx.canvas.height = ctx.canvas.clientHeight
      ctx.viewport(0, 0, ctx.canvas.width, ctx.canvas.height)
      if (!s.keepAnimating) { requestAnimationFrame(s.draw) }
    }
  })

  el('reset-button')
    .addEventListener('click', () => { resetState() })

  el('add-composition')
    .addEventListener('click', () => { addComposition() })

  el('load-button')
    .addEventListener('click', () => { loadPalette() })

  el('snapshot-position-button')
    .addEventListener('click', () => { takePositionSnapshot() })

  el('snapshot-velocities-button')
    .addEventListener('click', () => { takeVelocitySnapshot() })

  el('snapshot-lighting-button')
    .addEventListener('click', () => { takeLightingSnapshot() })

  el('copy-text-button')
    .addEventListener('click', () => {
    const text = el('json-textarea').value
    navigator.clipboard.writeText(text)
  })

  el('json-textarea')
    .addEventListener('focus', event => {
    outputPalette()
    event.target.select()
  })

  el('composition-list-textarea')
    .addEventListener('focus', event => {
    event.target.select()
  })

  el('composition-copy-text-button')
    .addEventListener('click', () => {
    const text = el('composition-list-textarea').value
    navigator.clipboard.writeText(text)
  })

  el('composition-load-button')
    .addEventListener('click', () => {
    loadCompositions()
  })

  window.addEventListener('deviceorientation', event => {
    const n = state.rollingAlpha.length
    state.alphaIndex++
    state.alphaIndex %= n
    state.averageAlpha -= state.rollingAlpha[state.alphaIndex % n] / n
    state.rollingAlpha[state.alphaIndex] = event.alpha
    state.averageAlpha += event.alpha / n
    
    state.betaIndex++
    state.betaIndex %= n
    state.averageBeta -= state.rollingBeta[state.betaIndex % n] / n
    state.rollingBeta[state.betaIndex] = event.beta
    state.averageBeta += event.beta / n
    
    state.gammaIndex++
    state.gammaIndex %= n
    state.averageGamma -= state.rollingGamma[state.gammaIndex % n] / n
    state.rollingGamma[state.gammaIndex] = event.gamma
    state.averageGamma += event.gamma / n
  })

  // Color event handlers and initialization
  const negativeColors = document.querySelectorAll('.light-negative')
  readColors()
  function readColors () {
    for (const [i,e] of
      document.querySelectorAll('.light-picker').entries()) {
      
      const positive = floatFromHex(e.value.replace('#', ''))
      const negative = floatFromHex(negativeColors[i].value.replace('#', ''))
      const signedColor = [
        positive.r - negative.r,
        positive.g - negative.g,
        positive.b - negative.b
      ]

      // Put the color in the right place:
      if (i < 4) {
        Object.assign(state.lighting.specularLights[i].rgb, signedColor)
      } else if (i < 7) {
        Object.assign(state.lighting.diffuseLights[i % 4].rgb, signedColor)
      } else if (i === 7) {
        Object.assign(state.lighting.glow.rgb, signedColor)
      } else if (i === 8) {
        Object.assign(state.lighting.membrane.rgb, signedColor)
      }
    }

    let rgb = floatFromHex(el('near-frame-color').value.replace('#', ''))
    Object.assign(state.lighting.nearFrameColor,
      [rgb.r, rgb.g, rgb.b])
    rgb = floatFromHex(el('far-frame-color').value.replace('#', ''))
    Object.assign(state.lighting.farFrameColor,
      [rgb.r, rgb.g, rgb.b])
  }

  for (const [i,e] of
    document.querySelectorAll('.light-picker').entries()) {

    e.addEventListener('input', readColors)
    negativeColors[i].addEventListener('input', readColors)
  }

  el('near-frame-color').addEventListener('input', readColors)
  el('far-frame-color').addEventListener('input', readColors)

  for (const [i,e] of
    document.querySelectorAll('.sliders input').entries()) {

    state.sliders[i] = parseFloat(e.value)
    document.querySelectorAll('.sliders .value-display')[i]
        .textContent = state.sliders[i]

    e.addEventListener('input', event => {
      state.sliders[i] = parseFloat(event.target.value)
      document.querySelectorAll('.sliders .value-display')[i]
        .textContent = state.sliders[i]
    })
  }

  for (const [i,e] of
    document.querySelectorAll('.animation-speeds input').entries()) {

    state.animationSpeeds[i] = parseFloat(e.value)
    document.querySelectorAll('.animation-speeds .value-display')[i]
      .textContent = state.animationSpeeds[i]

    e.addEventListener('input', event => {
      const v = parseFloat(event.target.value)
      state.animationSpeeds[i] = v
      document.querySelectorAll('.animation-speeds .value-display')[i]
        .textContent = state.animationSpeeds[i]
      if (v === 0) { e.classList.remove('accent-on') }
      else { e.classList.add('accent-on') }
    })
    }

  for (const [i,e] of
    document.querySelectorAll('input[type="checkbox"]').entries()) {
    
    state.checkboxes[i] = e.checked
    e.addEventListener('input', event => {
      state.checkboxes[i] = event.target.checked
    })
  }

  el('angle-constraint').addEventListener('input', event => {
    state.constrainAngles = parseInt(el('angle-constraint').value)
    el('input-discrete').checked = true
    el('input-discrete').dispatchEvent(new Event('input'))
  })

  // Register display events for composition opacity sliders
  const opacityValues =
    document.querySelectorAll('.opacity-container .value-display')
  for (const [i,e] of
    document.querySelectorAll('.opacity-container input[type="range"]')
    .entries()) {
    e.addEventListener('input', event => {
      opacityValues[i].textContent = e.value
      if (i === 0) { state.lighting.diffuseOpacity = parseFloat(e.value) }
      if (i === 1) { state.lighting.specularOpacity = parseFloat(e.value) }
    })
    e.dispatchEvent(new Event('input'))
  }

  for (const [i,e] of
    document.querySelectorAll('input[type="radio"]').entries()) {
    e.addEventListener('input', event => {
      const v = event.target.value
      switch (v) {
        case 'animation':
          state.rollerTarget = 'animation'
          el('input-continuous').checked = true
          el('input-continuous').dispatchEvent(new Event('input'))
          break
        case 'orientation':
          state.rollerTarget = 'orientation'
          break
        case 'continuous':
          state.constrainAngles = 0
          log('switching to continuous. ', state.constrainAngles)
          break
        case 'discrete':
          resetState()
          state.constrainAngles = parseInt(el('angle-constraint').value)
          log('switching to discrete. ', state.constrainAngles)
          break
        default:
          state.rollerTarget = v
      }
      if (state.rollerTarget === 'animation') {
        for (const e of document.querySelectorAll('.roller')) {
          e.classList.add('play-overlay')
          e.classList.remove('orientation-overlay')
        }
      } else {
        for (const e of document.querySelectorAll('.roller')) {
          e.classList.remove('play-overlay')
          e.classList.add('orientation-overlay')
        }
      }
    })
  }

  const pointerdown = event => {
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.pointerdown = true
  }
  el('main-canvas').addEventListener('pointerdown', pointerdown)
  el('second-canvas').addEventListener('pointerdown', pointerdown)
  
  const pointerup = event => {
    state.pointerdown = false
    state.releasedViewL = state.viewL
    state.releasedViewR = state.viewR
    state.viewSnapT = 0
  }
  el('main-canvas').addEventListener('pointerup', pointerup)
  el('second-canvas').addEventListener('pointerup', pointerup)

  const mouseleave = event => {
    pointerup()
  }
  el('main-canvas').addEventListener('mouseleave', mouseleave)
  el('second-canvas').addEventListener('mouseleave', mouseleave)

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
  el('second-canvas').addEventListener('pointermove', pointermove)

  // The model orientation is controlled by twelve degrees of freedom:
  // Six local rotations (xy, xz, yz, xw, yw, zw), and six global.
  function commonRollerDownHandler (event, rollerIndex) {
    state.turnModel = true
    state.rollerPos[rollerIndex].x = event.clientX
    state.rollerPos[rollerIndex].y = event.clientY
    state.positionRemainder.x = 0
    state.positionRemainder.y = 0
    if (window.getSelection) { window.getSelection().removeAllRanges() }
    else if (document.selection) { document.selection.empty() }

    for (const r of document.querySelectorAll('.roller div')) {
      r.classList.add('no-highlight')
    }

    event.target.classList.add('always-highlight')
  }

  // 3D local rotations
  el('rot-xy-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 0)
    state.currentRollerIndex = 0
    state.correspondingAnimationSlider = el('xy-speed-local')
    state.turnL = Quaternion.from([0, 0, -1, 1])
    state.turnR = Quaternion.from([0, 0, 1, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = false
  })
  el('rot-yz-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 0)
    state.currentRollerIndex = 0
    state.correspondingAnimationSlider = el('yz-speed-local')
    state.turnL = Quaternion.from([1, 0, 0, 1])
    state.turnR = Quaternion.from([-1, 0, 0, 1])
    state.rollerLockX = true
    state.rollerLockY = false
    state.rollGlobal = false
  })
  el('rot-xz-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 0)
    state.currentRollerIndex = 0
    state.correspondingAnimationSlider = el('xz-speed-local')
    state.turnL = Quaternion.from([0, 1, 0, 1])
    state.turnR = Quaternion.from([0, -1, 0, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = false
  })

  // 4D local rotations
  el('rot-zw-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 1)
    state.currentRollerIndex = 1
    state.correspondingAnimationSlider = el('zw-speed-local')
    state.turnL = Quaternion.from([0, 0, 1, 1])
    state.turnR = Quaternion.from([0, 0, 1, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = false
  })
  el('rot-yw-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 1)
    state.currentRollerIndex = 1
    state.correspondingAnimationSlider = el('yw-speed-local')
    state.turnL = Quaternion.from([0, 1, 0, 1])
    state.turnR = Quaternion.from([0, 1, 0, 1])
    state.rollerLockX = true
    state.rollerLockY = false
    state.rollGlobal = false
  })
  el('rot-xw-local').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 1)
    state.currentRollerIndex = 1
    state.correspondingAnimationSlider = el('xw-speed-local')
    state.turnL = Quaternion.from([1, 0, 0, 1])
    state.turnR = Quaternion.from([1, 0, 0, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = false
  })

  // 3D global rotations
  el('rot-xy-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 2)
    state.currentRollerIndex = 2
    state.correspondingAnimationSlider = el('xy-speed-global')
    state.turnL = Quaternion.from([0, 0, -1, 1])
    state.turnR = Quaternion.from([0, 0, 1, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = true
  })
  el('rot-yz-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 2)
    state.currentRollerIndex = 2
    state.correspondingAnimationSlider = el('yz-speed-global')
    state.turnL = Quaternion.from([1, 0, 0, 1])
    state.turnR = Quaternion.from([-1, 0, 0, 1])
    state.rollerLockX = true
    state.rollerLockY = false
    state.rollGlobal = true
  })
  el('rot-xz-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 2)
    state.currentRollerIndex = 2
    state.correspondingAnimationSlider = el('xz-speed-global')
    state.turnL = Quaternion.from([0, 1, 0, 1])
    state.turnR = Quaternion.from([0, -1, 0, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = true
  })

  // 4D global rotations
  el('rot-zw-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 3)
    state.currentRollerIndex = 3
    state.correspondingAnimationSlider = el('zw-speed-global')
    state.turnL = Quaternion.from([0, 0, 1, 1])
    state.turnR = Quaternion.from([0, 0, 1, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = true
  })
  el('rot-yw-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 3)
    state.currentRollerIndex = 3
    state.correspondingAnimationSlider = el('yw-speed-global')
    state.turnL = Quaternion.from([0, 1, 0, 1])
    state.turnR = Quaternion.from([0, 1, 0, 1])
    state.rollerLockX = true
    state.rollerLockY = false
    state.rollGlobal = true
  })
  el('rot-xw-global').addEventListener('pointerdown', event => {
    commonRollerDownHandler(event, 3)
    state.currentRollerIndex = 3
    state.correspondingAnimationSlider = el('xw-speed-global')
    state.turnL = Quaternion.from([1, 0, 0, 1])
    state.turnR = Quaternion.from([1, 0, 0, 1])
    state.rollerLockX = false
    state.rollerLockY = true
    state.rollGlobal = true
  })

  function rollerMove (event) {
    const idx = state.currentRollerIndex
    const nx = (event.clientX - state.rollerPos[idx].x)
      / event.target.offsetWidth
    const ny = (event.clientY - state.rollerPos[idx].y)
      / event.target.offsetHeight

    state.positionRemainder.x += nx
    state.positionRemainder.y += ny

    switch (state.rollerTarget) {
      case 'orientation':
        if (state.turnModel) {
          let t = 0

          // Lock rotations to discrete angles if specified
          if (state.constrainAngles) {
            const angleStep = 0.5 * state.constrainAngles * π / 180

            if (!state.rollerLockX) {
              if (state.positionRemainder.x > 0.1) {
                state.positionRemainder.x -= 0.1
                t += angleStep
              }
              if (state.positionRemainder.x < -0.1) {
                state.positionRemainder.x += 0.1
                t -= angleStep
              }
            }
  
            if (!state.rollerLockY) {
              if (state.positionRemainder.y > 0.1) {
                state.positionRemainder.y -= 0.1
                t += angleStep
              }
              if (state.positionRemainder.y < -0.1) {
                state.positionRemainder.y += 0.1
                t -= angleStep
              }
            }

          } else { // Continuously advance angle if unconstrained:
            if (!state.rollerLockX) { t += nx * π / 4 }
            if (!state.rollerLockY) { t += ny * π / 4 }
          }

          // For transformations in the global frame,
          // apply transformations to the end of the stack:
          // x' = tL modelL x0 modelR tR
          // For transformations in the local frame,
          // apply transformations to the beginning of the stack:
          // x' = modelL tL x0 tR modelR
          if (state.rollGlobal) {
            state.modelL.premultiply(state.turnL.atAngle(t))
            state.modelR.postmultiply(state.turnR.atAngle(t))

          } else {
            state.modelL.postmultiply(state.turnL.atAngle(t))
            state.modelR.premultiply(state.turnR.atAngle(t))
          }

          state.modelL.normalize()
          state.modelR.normalize()

          el('current-l').textContent = state.modelL.toFixedString()
          el('current-r').textContent = state.modelR.toFixedString()
        }
        break;
      case 'animation':
        if (state.correspondingAnimationSlider) {
          const sliderStepSize = parseFloat(
            state.correspondingAnimationSlider.getAttribute('step'))

          let v = parseFloat(state.correspondingAnimationSlider.value)

          if (!state.rollerLockX) {
            if (state.positionRemainder.x > 0.1) {
              state.positionRemainder.x -= 0.1
              v += sliderStepSize
            }
            if (state.positionRemainder.x < -0.1) {
              state.positionRemainder.x += 0.1
              v -= sliderStepSize
            }
          }

          if (!state.rollerLockY) {
            if (state.positionRemainder.y > 0.1) {
              state.positionRemainder.y -= 0.1
              v += sliderStepSize
            }
            if (state.positionRemainder.y < -0.1) {
              state.positionRemainder.y += 0.1
              v -= sliderStepSize
            }
          }
          
          state.correspondingAnimationSlider.value = v
          state.correspondingAnimationSlider.dispatchEvent(
            new Event('input'))
        }
        break;
    }

    state.rollerPos[idx].x = event.clientX
    state.rollerPos[idx].y = event.clientY
  }

  for(const e of [
    document.querySelector('.roller-3d-local'),
    document.querySelector('.roller-4d-local'),
    document.querySelector('.roller-3d-global'),
    document.querySelector('.roller-4d-global')
  ]) {
    e.addEventListener('pointermove', rollerMove)
    e.addEventListener('pointerup', releaseRoller)
    e.addEventListener('pointerleave', releaseRoller)

    function releaseRoller () {
      state.turnModel = false
      state.correspondingAnimationSlider = null
      for (const r of document.querySelectorAll('.roller div')) {
        r.classList.remove('no-highlight')
        r.classList.remove('always-highlight')
      }
    }
  }

  // Initialize values for radio butttons
  el('target-orientation').checked = true
  el('target-orientation').dispatchEvent(new Event('input'))
  el('input-continuous').checked = true
  el('input-continuous').dispatchEvent(new Event('input'))

  // Initialize animation speeds to zero
  clearAnimationSliders()
}

const defaultCompositions = '[{"name":"diamond light","string":"{\\"Lstring\\":\\"-0.3131402677372033i + -0.6640532542139448j + -0.5375850672399217k + -0.4147031996166503\\",\\"Rstring\\":\\"0.8585978717974221i + 0.4014240064175323j + -0.2816808469769332k + 0.1494133931934474\\",\\"velocity\\":[0,0.05,0.05,0,0,0,0,0,0,0,0.025,-0.1],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.3333333333333333,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.25098039215686274,0.5019607843137255]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.10196078431372549,0.4]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.050980392156862744,0,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.07450980392156863,0.12941176470588237]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.45098039215686275,0.5764705882352941,1]},\\"nearFrameColor\\":[0.7333333333333333,0.9411764705882353,0.9137254901960784],\\"farFrameColor\\":[0.01568627450980392,0.24313725490196078,0.9176470588235294],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1}}"},{"name":"vaporwave","string":"{\\"Lstring\\":\\"0.1394071025225485i + -0.4481163340118159j + -0.0709746547627450k + 0.8801818047081984\\",\\"Rstring\\":\\"-0.1394071025225485i + 0.4481163340118159j + 0.0709746547627450k + 0.8801818047081984\\",\\"velocity\\":[0,0.175,0,0,0,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.3333333333333333,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.25098039215686274,0.5019607843137255]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.10196078431372549,0.4]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.050980392156862744,0,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.3333333333333333,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.25098039215686274,0.5019607843137255]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.07450980392156863,0.12941176470588237]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[-0.4980392156862745,0.09803921568627451,0.6]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.396078431372549,0.3568627450980392,0.8745098039215686]},\\"nearFrameColor\\":[0.8901960784313725,0.3411764705882353,0.7411764705882353],\\"farFrameColor\\":[1,0.30980392156862746,0.3254901960784314],\\"diffuseOpacity\\":0.5,\\"specularOpacity\\":1}}"},{"name":"faraway blue","string":"{\\"Lstring\\":\\"0.0605275572953415i + -0.9548858532785907j + -0.1156438570064427k + -0.2667506707673511\\",\\"Rstring\\":\\"0.0351183920396373i + 0.8784023024689672j + 0.1257131074949993k + 0.4597524422598619\\",\\"velocity\\":[0,0.05,0,0,0,0,0,0,0,0,0.025,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.3333333333333333,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.25098039215686274,0.5019607843137255]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.10196078431372549,0.4]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.050980392156862744,0,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.07450980392156863,0.12941176470588237]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.39215686274509803,0.8235294117647058]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.45098039215686275,0.5764705882352941,1]},\\"nearFrameColor\\":[0.7333333333333333,0.9411764705882353,0.9137254901960784],\\"farFrameColor\\":[0.01568627450980392,0.24313725490196078,0.9176470588235294],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1}}"},{"name":"alien","string":"{\\"Lstring\\":\\"0.2719416974696960i + 0.5572645835393245j + -0.1997443759137715k + -0.7586870773915904\\",\\"Rstring\\":\\"0.6799567378424413i + 0.2931561264137852j + 0.3459172895544312k + -0.5762460837143951\\",\\"velocity\\":[0,0.1,0,0,0.1,0,0,0,0,0.05,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.7176470588235294,0.21568627450980393,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.7411764705882353,0.9019607843137255]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.10196078431372549,0.4]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.050980392156862744,0,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.07450980392156863,0.12941176470588237]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0.5137254901960784,0,0.6431372549019608]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgb\\":[0,0.4745098039215686,0.23921568627450981]},\\"nearFrameColor\\":[0.403921568627451,0.996078431372549,0.9215686274509803],\\"farFrameColor\\":[0.45098039215686275,0.06666666666666667,0.42745098039215684],\\"diffuseOpacity\\":1,\\"specularOpacity\\":0.25}}"}]'
