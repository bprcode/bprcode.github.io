'use strict';

const log = console.log.bind(console)
const el = document.getElementById.bind(document)

const state = {
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

  // Number of times to run the blur filter; controlled by slider
  blurPassCount: 2,

  // State objects for each animation
  animation1: { keepAnimating: true },
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

  el('composition-list-textarea').value =
    localStorage.getItem('compositions') || defaultCompositions
  el('json-textarea').value = localStorage.getItem('palette')
  initListeners()
  loadPalette()
  loadCompositions()

  // Simulate an initial click
  document.querySelector('.composition-entry')
    .querySelector('.composition-restore-button')
    .dispatchEvent(new Event('click'))
    
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
      applyView: quatView
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

  log('using near=' + shared.nearPlane, ' far=' + shared.farPlane)
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
}

function syncPickers () {
  const positives = document.querySelectorAll('.light-picker')
  const negatives = document.querySelectorAll('.light-negative')
  const clarities = document.querySelectorAll('.clarity-picker')

  for (const [i, rgba] of [
    state.lighting.specularLights[0].rgba,
    state.lighting.specularLights[1].rgba,
    state.lighting.specularLights[2].rgba,
    state.lighting.specularLights[3].rgba,
    state.lighting.diffuseLights[0].rgba,
    state.lighting.diffuseLights[1].rgba,
    state.lighting.diffuseLights[2].rgba,
    state.lighting.glow.rgba,
    state.lighting.membrane.rgba
  ].entries())
  {
    const hexes = hexFromFloatRGB(rgba)
    positives[i].value = hexes.positive
    negatives[i].value = hexes.negative
    clarities[i].value = '#'
      + Math.round(rgba[3] * 0xff).toString(16).padStart(2,'0')
      + '0000'
  }

  el('near-frame-color').value =
    hexFromFloatRGB(state.lighting.nearFrameColor).positive
  el('far-frame-color').value =
    hexFromFloatRGB(state.lighting.farFrameColor).positive
  el('near-frame-clarity').value = '#'
    + Math.round(state.lighting.nearFrameColor[3] * 0xff)
      .toString(16).padStart(2,'0')
    + '0000'
  el('far-frame-clarity').value = '#'
    + Math.round(state.lighting.farFrameColor[3] * 0xff)
      .toString(16).padStart(2,'0')
    + '0000'
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
    state.animation1.requestScreenshot = copyScreenshot
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
    state.animation1.requestScreenshot = copyScreenshot
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

function resetColors () {
  for (const [i,c] of [
    state.lighting.specularLights[0].rgba,
    state.lighting.specularLights[1].rgba,
    state.lighting.specularLights[2].rgba,
    state.lighting.specularLights[3].rgba,
    state.lighting.diffuseLights[0].rgba,
    state.lighting.diffuseLights[1].rgba,
    state.lighting.diffuseLights[2].rgba,
    state.lighting.glow.rgba,
    state.lighting.membrane.rgba
  ].entries()) {
    c[0] = c[1] = c[2] = c[3] = 0
  }

  state.lighting.nearFrameColor = [0,0,0,0]
  state.lighting.farFrameColor = [0,0,0,0]
  
  syncPickers()
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
      lighting: convertLightingToAlpha(composition.lighting)
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
    state.lighting = convertLightingToAlpha(palette.current.lighting)
    syncPickers()

    el('diffuse-opacity').value = state.lighting.diffuseOpacity
    el('specular-opacity').value = state.lighting.specularOpacity
    el('border-specularity').value = state.lighting.borderSpecularity
    el('diffuse-opacity').dispatchEvent(new Event('input'))
    el('specular-opacity').dispatchEvent(new Event('input'))
    el('border-specularity').dispatchEvent(new Event('input'))

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
    Lstring: source.rememberModelL  ? source.rememberModelL.toString()
                                    : source.modelL.toString(),
    Rstring: source.rememberModelR  ? source.rememberModelR.toString()
                                    : source.modelR.toString(),
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
    el('specular-opacity').value = state.lighting.specularOpacity
    el('border-specularity').value = state.lighting.borderSpecularity
    el('diffuse-opacity').dispatchEvent(new Event('input'))
    el('specular-opacity').dispatchEvent(new Event('input'))
    el('border-specularity').dispatchEvent(new Event('input'))
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
  function updateBlurLevel () {
    if (el('main-canvas').clientWidth > 350) {
      state.blurPassCount = 4
    } else {
      state.blurPassCount = 2
    }

    el('blur-pass-count').value = state.blurPassCount
    el('blur-pass-count').dispatchEvent(new Event('input'))
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

  el('reset-button')
    .addEventListener('click', () => { resetState() })

  el('clear-button')
    .addEventListener('click', () => { resetColors() })

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

  el('remember-orientation')
    .addEventListener('click', () => {
    log('remembering ', state.modelL.toString(), ', ', state.modelR.toString())
    state.rememberModelL = Quaternion.from(state.modelL)
    state.rememberModelR = Quaternion.from(state.modelR)
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

  // Color event handlers and initialization
  const negativeColors = document.querySelectorAll('.light-negative')
  const clarityColors = document.querySelectorAll('.clarity-picker')
  readColors()
  // Make state.lighting reflect the contents of the color picker inputs:
  function readColors () {
    for (const [i,e] of
      document.querySelectorAll('.light-picker').entries()) {
      
      const positive = floatFromHex(e.value.replace('#', ''))
      const negative = floatFromHex(negativeColors[i].value.replace('#', ''))
      const clarity = floatFromHex(clarityColors[i].value.replace('#', '')).r
      const signedColor = [
        positive.r - negative.r,
        positive.g - negative.g,
        positive.b - negative.b,
        clarity
      ]

      // Put the color in the right place:
      if (i < 4) {
        Object.assign(state.lighting.specularLights[i].rgba, signedColor)
      } else if (i < 7) {
        Object.assign(state.lighting.diffuseLights[i % 4].rgba, signedColor)
      } else if (i === 7) {
        Object.assign(state.lighting.glow.rgba, signedColor)
      } else if (i === 8) {
        Object.assign(state.lighting.membrane.rgba, signedColor)
      }
    }

    let rgba = floatFromHex(el('near-frame-color').value.replace('#', ''))
    rgba.a = floatFromHex(el('near-frame-clarity').value.replace('#', '')).r
    Object.assign(state.lighting.nearFrameColor,
      [rgba.r, rgba.g, rgba.b, rgba.a])
    rgba = floatFromHex(el('far-frame-color').value.replace('#', ''))
    rgba.a = floatFromHex(el('far-frame-clarity').value.replace('#', '')).r
    Object.assign(state.lighting.farFrameColor,
      [rgba.r, rgba.g, rgba.b, rgba.a])
  }

  for (const [i,e] of
    document.querySelectorAll('.light-picker').entries()) {

    e.addEventListener('input', readColors)
    negativeColors[i].addEventListener('input', readColors)
    clarityColors[i].addEventListener('input', readColors)
  }

  el('near-frame-color').addEventListener('input', readColors)
  el('far-frame-color').addEventListener('input', readColors)
  el('near-frame-clarity').addEventListener('input', readColors)
  el('far-frame-clarity').addEventListener('input', readColors)

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
  el('diffuse-opacity').addEventListener('input', event => {
    state.lighting.diffuseOpacity = parseFloat(event.target.value)
    el('diffuse-opacity-display').textContent = event.target.value
  })
  el('specular-opacity').addEventListener('input', event => {
    state.lighting.specularOpacity = parseFloat(event.target.value)
    el('specular-opacity-display').textContent = event.target.value
  })
  el('border-specularity').addEventListener('input', event => {
    state.lighting.borderSpecularity = parseFloat(event.target.value)
    el('border-specularity-display').textContent = event.target.value
  })
  el('blur-pass-count').addEventListener('input', event => {
    state.blurPassCount = parseInt(event.target.value)
    el('blur-pass-count-display').textContent = event.target.value
  })

  el('diffuse-opacity').dispatchEvent(new Event('input'))
  el('specular-opacity').dispatchEvent(new Event('input'))
  el('border-specularity').dispatchEvent(new Event('input'))
  el('blur-pass-count').dispatchEvent(new Event('input'))
  updateBlurLevel()

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

const defaultCompositions = '[{"name":"belladonna","string":"{\\"Lstring\\":\\"0.0677192918663718i + 0.8903473063595305j + 0.1410171598122133k + 0.4275627815940406\\",\\"Rstring\\":\\"-0.0677192918663718i + -0.8903473063595305j + -0.1410171598122133k + 0.4275627815940406\\",\\"velocity\\":[0,0.175,0,0,0,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.403921568627451,0.09019607843137255,0.011764705882352941,0.41568627450980394]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9098039215686274,0.25882352941176473,1,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.1411764705882353,0.2,0.09803921568627452,0.42745098039215684]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.050980392156862744,0,0.2,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.6666666666666667,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.01568627450980392,-0.0862745098039216,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.4156862745098039,0.0392156862745098,0.3137254901960784,0.16862745098039217]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.5529411764705883,0.011764705882352941,0.18823529411764706,0.3843137254901961]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.396078431372549,0.3568627450980392,0.8745098039215686,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"trance","string":"{\\"Lstring\\":\\"0.8200316449185081i + 0.0106692207120664j + -0.3147740318708886k + 0.4778614631064459\\",\\"Rstring\\":\\"-0.3572710844321108i + -0.3303548027147990j + -0.8024287893867628k + 0.3454433593457628\\",\\"velocity\\":[0,0,0,0,0,0,0,0,0,0,-0.075,0.125],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3333333333333333,0,0,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.25098039215686274,0.5019607843137255,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.9098039215686274,0.2196078431372549,0.4,0.9254901960784314]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.050980392156862744,-0.0784313725490196,-0.592156862745098,1]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.8745098039215686,0.10588235294117647,0.13333333333333333,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.07450980392156863,0.12941176470588237,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9725490196078431,0.5098039215686274,0.3137254901960784,0]},\\"nearFrameColor\\":[0.09411764705882353,0.4392156862745098,0.396078431372549,0],\\"farFrameColor\\":[1,1,1,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"bordered hard edge demo","string":"{\\"Lstring\\":\\"-0.0343116669787290i + -0.9636375811929218j + -0.1526251989729309k + -0.2166353393579884\\",\\"Rstring\\":\\"0.0343116669787290i + 0.9636375811929218j + 0.1526251989729309k + -0.2166353393579884\\",\\"velocity\\":[0,0.175,0,0,0,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.403921568627451,0.09019607843137255,0.011764705882352941,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9098039215686274,0.25882352941176473,1,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.1411764705882353,0.2,0.09803921568627451,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.050980392156862744,0,0.2,1]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,1]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.5529411764705883,0.011764705882352941,0.18823529411764706,0.3843137254901961]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.396078431372549,0.3568627450980392,0.8745098039215686,1]},\\"nearFrameColor\\":[1,0,0,1],\\"farFrameColor\\":[0,1,0,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"MSAA test","string":"{\\"Lstring\\":\\"0.1203400606314361i + -0.6310597531937318j + -0.0999500458209271k + 0.7597972400878074\\",\\"Rstring\\":\\"-0.1203400606314361i + 0.6310597531937318j + 0.0999500458209271k + 0.7597972400878074\\",\\"velocity\\":[0,0.175,0,0,0,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.403921568627451,0.09019607843137255,0.011764705882352941,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9098039215686274,0.25882352941176473,1,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.1411764705882353,0.2,0.09803921568627451,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.050980392156862744,0,0.2,1]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.9921568627450981,-0.792156862745098,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[1,1,-1,1]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.5529411764705883,0.011764705882352941,0.18823529411764706,0.3843137254901961]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.11764705882352941,0.49019607843137253,1,1]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":0,\\"borderSpecularity\\":0}}"},{"name":"tourmaline tumbler","string":"{\\"Lstring\\":\\"0.1299921497591096i + 0.7772876077724429j + -0.5913833850226335k + -0.1708558097410710\\",\\"Rstring\\":\\"0.8173724347861789i + -0.0590371414789897j + -0.0851491187943197k + -0.5667155779974505\\",\\"velocity\\":[0,0.125,0,0,-0.075,0,0,0,0,-0.05,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9686274509803922,0,0,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[1,0.8352941176470589,0.25882352941176473,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.9568627450980393,0.09411764705882353,1]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.16862745098039217,0.9568627450980393,1]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7176470588235294,0,0.3215686274509804,0.7764705882352941]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3254901960784314,0.2784313725490196,0.8627450980392157,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"first light","string":"{\\"Lstring\\":\\"-0.1071283159749712i + -0.5278721734847635j + -0.0673338725457604k + -0.8398456060438698\\",\\"Rstring\\":\\"-0.0797513376928233i + -0.7701227836740818j + -0.0982346711291267k + 0.6252204184100423\\",\\"velocity\\":[0,0.05,0,0,-0.075,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.4549019607843137,0.9568627450980393,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-1,-1,-1,0.14901960784313725]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.9019607843137255,0.011764705882352941,0.21568627450980393,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.9764705882352941,0.050980392156862744,0.5098039215686274,0.1411764705882353]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,-0.023529411764705882,-0.16862745098039217,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3568627450980392,0,-0.2901960784313726,0.17647058823529413]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.4549019607843137,0.3568627450980392,0.2549019607843137,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9490196078431372,0.24313725490196078,0.06666666666666667,0.37254901960784315]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.24705882352941178,0.17647058823529413,0.5843137254901961,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.8,0.4627450980392157,0.00784313725490196,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"emerald draft","string":"{\\"Lstring\\":\\"0.8642162455872090i + 0.0323021199683406j + -0.0559489129773519k + -0.4989554820278219\\",\\"Rstring\\":\\"-0.1349669718580376i + 0.4938906479872055j + -0.8554436956969503k + -0.0779232175339453\\",\\"velocity\\":[0,0.025,0,0,0.1,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.0392156862745098,0.1803921568627451,0.21176470588235294,0.06666666666666667]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.4823529411764706,0.8196078431372549,1,0.38823529411764707]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.12156862745098039,0.3686274509803922,0.49411764705882355,0.10588235294117647]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.12549019607843137,0.3333333333333333,0.27058823529411763,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.3333333333333333,-0.058823529411764705,-0.09803921568627451,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.09411764705882353,0.3137254901960784,0.1450980392156863,0]},{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.6078431372549019,-0.11764705882352941,0.5333333333333333,0.7137254901960784]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.11372549019607843,0.5294117647058824,0.9882352941176471,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.34901960784313724,0.19215686274509805,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":0.5,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"}]'
