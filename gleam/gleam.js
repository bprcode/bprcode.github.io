'use strict';

const π = Math.PI
const τ = π * 2
const log = console.log.bind(console)
const el = document.getElementById.bind(document)

const state = {
  sliders: [],
  checkboxes: [],
  dx: 0,
  dy: 0,
  alpha: 0, // device orientation angles
  beta: 0,
  gamma: 0,
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
  // To enable static definition in VSCode, these objects have been
  // exposed as globals in their respective files:
  // const shaders = buildShaders()
  // const geometry = buildGeometry()
  // const painters = buildPainters()

  initListeners()

  for (const c of [el('main-canvas'), el('second-canvas')]) {
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
    gl2 = el('main-canvas').getContext(
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
  state.animation1.draw = glPipeline(gl,
    { animationState: state.animation1,
      nearPlane: 1,
      farPlane: 100 },
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
    { // Draw diffuse light panes:
      vertexShader: shaders.normals4dVert,
      fragmentShader: shaders.glassTestFrag,
      mesh: geometry.normalTesseract,
      components: 4,
      init: painters.initGlassTesseract,
      draw: painters.drawGlassTesseract
    },
  ])

  state.animation2.context = gl2
  state.animation2.draw = glPipeline(gl2,
    { animationState: state.animation2,
      nearPlane: 1,
      farPlane: 100 },
  [
    {
      vertexShader: shaders.projector4dVert,
      fragmentShader: shaders.wFrag_ALTERNATE,
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
    { // Draw diffuse light panes:
      vertexShader: shaders.normals4dVert_ALTERNATE,
      fragmentShader: shaders.glassTestFrag_ALTERNATE,
      mesh: geometry.normalTesseract,
      components: 4,
      init: painters.initGlassTesseract,
      draw: painters.drawGlassTesseract
    },
  ])

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

    if (shared.animationState.keepAnimating) {
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

function initListeners () {
  window.addEventListener('resize', event => {
    for (const s of [state.animation1, state.animation2]) {
      const ctx = s.context
      ctx.canvas.width = ctx.canvas.clientWidth
      ctx.canvas.height = ctx.canvas.clientHeight
      ctx.viewport(0, 0, ctx.canvas.width, ctx.canvas.height)
      if (!s.keepAnimating) { requestAnimationFrame(s.draw) }
    }
  })

  window.addEventListener('deviceorientation', event => {
    state.alpha = event.alpha
    state.beta = event.beta
    state.gamma = event.gamma
  })

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
    document.querySelectorAll('input[type="checkbox"]').entries()) {
    
    state.checkboxes[i] = e.checked
    e.addEventListener('input', event => {
      state.checkboxes[i] = event.target.checked
    })
  }

  document.getElementById('main-canvas')
    .addEventListener('mousedown', event => {
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.mousedown = true
  })
  
  document.getElementById('main-canvas')
    .addEventListener('mouseup', event => {
    state.mousedown = false
  })

  document.getElementById('main-canvas')
    .addEventListener('mousemove', event => {
    if (state.mousedown) {
      state.dx = event.clientX - state.lastX
      state.dy = event.clientY - state.lastY

      state.theta += state.dx / 100 * π/4
      state.phi += state.dy / 100 * π/4
    }

    state.lastX = event.clientX
    state.lastY = event.clientY
    state.nx = (event.clientX - event.target.offsetLeft)
                  / event.target.offsetWidth
    state.ny = 1 - (event.clientY - event.target.offsetTop)
                / event.target.offsetHeight

  })
}
