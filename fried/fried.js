'use strict';

const π = Math.PI
const τ = π * 2
const log = console.log.bind(console)
console.clear()

const state = {
  dx: 0,
  dy: 0,
  theta: 0,
  phi: 0,
  alpha: 0, // device orientation angles
  beta: 0,
  gamma: 0,
  kernel: Array(9).fill(0),
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
  initListeners()

  for (const c of [document.getElementById('main-canvas'),
                  document.getElementById('second-canvas')]) {
    if (c) {
      const rect = c.getBoundingClientRect()
      c.setAttribute('width', rect.width)
      c.setAttribute('height', rect.height)
    }
  }

  // turns out compositing doesn't go so well with lower res
  // might be able to perform some transform to recover?
  const lofiRez = document.querySelector('canvas').width
  const shaders = buildShaders()
  const geometry = buildGeometry()

  const gl = document.getElementById('main-canvas')
    .getContext('webgl', { alpha: false, premultipliedAlpha: false })
  const gl2 = document.getElementById('second-canvas')
    .getContext('webgl', { alpha: false, premultipliedAlpha: false })
  document.getElementById('first-title').querySelector('.view-label')
    .textContent =
    gl.getParameter(gl.VERSION)
    + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
  document.getElementById('second-title').querySelector('.view-label')
    .textContent =
    gl2.getParameter(gl2.VERSION)
    + ' / ' + gl2.getParameter(gl2.SHADING_LANGUAGE_VERSION)

  function commonCubeAnimation () {
    ident(this.MV)
    mult4(this.MV,
      rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV)
      mult4(this.MV,
      rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV)
    mult4(this.MV, translateMatrix(
                    2.5*Math.cos(this.dt/1000),
                    Math.sin(this.dt/2000),
                    -30.0 + 8.0*Math.sin(this.dt/1000)),
      this.MV)
  }

  // Rendering pass for outputting depth to a color texture
  // as an alternative to WEBGL_depth_texture
  function initDepthCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    this.MV = []

    this.shared.fbSize ??= 128
    const fbSize = this.shared.fbSize

    const depthTexture = gl.createTexture()

    gl.bindTexture(gl.TEXTURE_2D, depthTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT,
      fbSize, fbSize, 0, gl.DEPTH_COMPONENT,
      gl.UNSIGNED_SHORT, null)

    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D, depthTexture, 0)
    gl.bindTexture(gl.TEXTURE_2D, null) // pointless?

    const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
      logError('Framebuffer incomplete: '
        + parseFramebufferStatus(framebufferStatus))
    }

    this.shared.fboDepth = fbo
    this.shared.depthTexture = depthTexture
  }

  function drawDepthCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboDepth)
    gl.viewport(0, 0, this.shared.fbSize, this.shared.fbSize)

    gl.enable(gl.DEPTH_TEST)
    gl.clear(gl.DEPTH_BUFFER_BIT)
    gl.colorMask(false, false, false, false)

    commonCubeAnimation.call(this)

    gl.uniformMatrix4fv(this.modelview, false, this.MV)

    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.colorMask(true, true, true, true)
  }

  function initBlurCompositor () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
    this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
    this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
    this.uDepthTex = gl.getUniformLocation(this.program, 'depthTex')

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
      this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.uniform1i(this.uBlurTex, 0)
    gl.uniform1i(this.uClearTex, 1)
    gl.uniform1i(this.uDepthTex, 2)
  }

  function compositeBlur () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    // Think we can skip rebinding texture0 -- should be used by
    // previous stages
    // gl.activeTexture(gl.TEXTURE0)
    // gl.bindTexture(gl.TEXTURE_2D, this.shared.blurTexture)
    // blurTexture should probably already be bound
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

    // // Clean up:
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
  }

  function initTexturedQuad () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    this.uTex = gl.getUniformLocation(this.program, 'uTex')
    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
      this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    const demoTexture = gl.createTexture()
    const textureSize = 64
    gl.bindTexture(gl.TEXTURE_2D, demoTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
      textureSize, textureSize, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, checkerboard())

    this.demoTexture = demoTexture
    this.textureSize = textureSize

    function checkerboard () {
      const board = new Uint8Array(textureSize * textureSize * 4)
      const fraction = textureSize / 4
      for (let i = 0; i < textureSize; i++){
        const g = Math.floor(2 * (i % fraction) / fraction)
        for (let j = 0; j < textureSize; j++) {
          const f = Math.floor(2 * (j % fraction) / fraction)
          board.set([240 * f, 100 * g, 100, 64],
            (i * textureSize + j) * 4)
        }
      }
      return board
    }
  }

  function initBlur () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
    
    this.uTex = gl.getUniformLocation(this.program, 'uTex')
    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
    this.kernel = gl.getUniformLocation(this.program, 'kernel')
    this.blurStep = gl.getUniformLocation(this.program, 'blurStep')
  
    // Provide texture coordinates as an attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
      this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  
    // Provide normalized Gaussian weights
    gl.uniform1fv(this.kernel,
      normalizedGaussianKernel(0.1, shaders.blurKernelSize))
  
    // Initialize two framebuffers, each with a color texture,
    // to alternate between when blur rendering
    const fboAlternates = [gl.createFramebuffer(), gl.createFramebuffer()]
    const texAlternates = [gl.createTexture(), gl.createTexture()]
  
    for (let i = 0; i < fboAlternates.length; i++) {
      gl.bindTexture(gl.TEXTURE_2D, texAlternates[i])
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        lofiRez, lofiRez, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboAlternates[i])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, texAlternates[i], 0)
  
      const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
        logError('Framebuffer incomplete: '
          + parseFramebufferStatus(framebufferStatus))
      }
    }
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  
    this.fboAlternates = fboAlternates
    this.texAlternates = texAlternates
  }
  
  function drawBlur () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    let bx = 1/lofiRez * Math.cos(π * this.dt/1000)
    // debug:
    bx = 1/lofiRez
    let by = 0
  
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.viewport(0, 0, lofiRez, lofiRez)
  
    const needErase = [true, true]
    const iterations = 8
  
    let readSource = this.shared.lofiTexture
    for (let i = 0; i < iterations; i++) {
  
      // Set write destination
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAlternates[i % 2])
      if(needErase[i % 2]) {
        gl.clear(gl.COLOR_BUFFER_BIT)
        needErase[i % 2] = false
      }
  
      // Set read source
      gl.bindTexture(gl.TEXTURE_2D, readSource)
      
      gl.uniform2fv(this.blurStep, [bx, by])
      ;[bx, by] = [by, bx]
  
      gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
  
      // Next iteration, read from the texture we just drew:
      readSource = this.texAlternates[i % 2]
    }
  
    // Make the results available to the compositor:
    this.shared.blurTexture = readSource
  }

  function initClearCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    this.MV = []
    this.normal = gl.getAttribLocation(this.program, 'normal')
    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal,
      3, gl.FLOAT, false, this.mesh.byteStride,
      3 * Float32Array.BYTES_PER_ELEMENT)

    const clearTexture = gl.createTexture()
    const res = gl.canvas.width

    gl.bindTexture(gl.TEXTURE_2D, clearTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
      res, res, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, null)
    
    const depthBuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
      res, res)

    const fboClear = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboClear)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, clearTexture, 0)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER, depthBuffer)

    const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
      logError('Framebuffer incomplete: '
        + parseFramebufferStatus(framebufferStatus))
    }

    gl.activeTexture(gl.TEXTURE0 + 1)
    gl.bindTexture(gl.TEXTURE_2D, clearTexture)

    gl.activeTexture(gl.TEXTURE0)

    this.shared.clearTexture = clearTexture
    this.fboClear = fboClear
    this.res = res
  }
  
  function drawClearCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboClear)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.viewport(0, 0, this.res, this.res)

    commonCubeAnimation.call(this)
  
    gl.uniformMatrix4fv(this.modelview, false, this.MV)
  
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  }

  function initNormalCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    this.MV = []
    this.normal = gl.getAttribLocation(this.program, 'normal')
    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal,
      3, gl.FLOAT, false, this.mesh.byteStride,
      3 * Float32Array.BYTES_PER_ELEMENT)
  }
  
  function drawNormalCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    commonCubeAnimation.call(this)
  
    gl.uniformMatrix4fv(this.modelview, false, this.MV)
  
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  }

  function initLofiCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    this.MV = []
    this.normal = gl.getAttribLocation(this.program, 'normal')
    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal,
      3, gl.FLOAT, false, this.mesh.byteStride,
      3 * Float32Array.BYTES_PER_ELEMENT)
  
    const lofiTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, lofiTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
      lofiRez, lofiRez, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, null)
  
    const depthTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, depthTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT,
      lofiRez, lofiRez, 0, gl.DEPTH_COMPONENT,
      gl.UNSIGNED_SHORT, null)
  
    const fboLofi = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboLofi)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, lofiTexture, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D, depthTexture, 0)
  
    const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
      logError('Framebuffer incomplete: '
        + parseFramebufferStatus(framebufferStatus))
    }
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  
    gl.activeTexture(gl.TEXTURE0 + 2)
    gl.bindTexture(gl.TEXTURE_2D, depthTexture)

    gl.activeTexture(gl.TEXTURE0)

    this.shared.fboLofi = fboLofi
    this.shared.lofiTexture = lofiTexture
    this.shared.depthTexture = depthTexture
  }
  
  function drawLofiCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboLofi)
    gl.viewport(0, 0, lofiRez, lofiRez)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    commonCubeAnimation.call(this)
  
    gl.uniformMatrix4fv(this.modelview, false, this.MV)
  
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  }

  function drawTexturedQuad () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
  }

  function drawTestQuad () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.bindTexture(gl.TEXTURE_2D, this.shared.lofiTexture)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
  }

  function drawQuadFromDepth () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.bindTexture(gl.TEXTURE_2D, this.shared.depthTexture)
    // gl.bindTexture(gl.TEXTURE_2D, this.demoTexture)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
  }

  state.animation1.context = gl
  state.animation1.draw = glStart(gl, { animationState: state.animation1 },
  [
    {
      vertexShader: shaders.depthVertHack,
      fragmentShader: shaders.depthFragHack,
      mesh: geometry.triCube,
      init: initDepthCube,
      draw: drawDepthCube
    },
    {
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.depthExperimentFrag,
      mesh: geometry.texSquare,
      init: initTexturedQuad,
      draw: drawQuadFromDepth
    },
  ])

  state.animation2.context = gl2
  state.animation2.draw = glStart(gl2, { animationState: state.animation2 },
  [
    /* Rendering plan:
    Render hi-res scene to texture unit 0
    Render blurry lo-fi scene to texture unit 1
    Render depth texture to texture unit 2
    Finally, compose 0 and 1, weighted by 2, onto the main canvas.
    DEBUG -- TODO, LATER: Combine the high-res draw and the composition
    operation into one pass. It is not necessary to store the high-res
    texture. Just use the output as it's rendered.
    */
    { // draw the scene clearly, at full resolution:
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.passthroughFrag,
      mesh: geometry.triCube,
      init: initClearCube,
      draw: drawClearCube
    },
    { // draw the lofi scene to a color and depth attachment:
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.passthroughFrag,
      mesh: geometry.triCube,
      init: initLofiCube,
      draw: drawLofiCube
    },
    { // post-process the output with iterated Gaussian blur:
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.bloom1d,
      mesh: geometry.texSquare,
      init: initBlur,
      draw: drawBlur
    },
    { // compose the final scene:
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.blurCompositorFrag,
      mesh: geometry.texSquare,
      init: initBlurCompositor,
      draw: compositeBlur
    }
    // {
    //   vertexShader: shaders.vertsWithNormals,
    //   fragmentShader: shaders.passthroughFrag,
    //   mesh: geometry.triCube,
    //   init: initNormalCube,
    //   draw: drawNormalCube
    // }
  ])

} catch (e) {
  logError('\n🚩 Initialization error: ' + e.message
        + '\n' + e.stack)
}
}

/**
 * If certain features are not present on the WebGLRenderingContext,
 * acquire those extensions and add them to the context object.
 * @param {WebGLRenderingContext} gl The context object to modify.
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

  const depthTextureExt = gl.getExtension('WEBGL_depth_texture')
  if (!depthTextureExt) {
    throw new Error('This browser does not support depth textures.'
     + ' Unable to display content.')
  } else {
    gl.depthTextureExt = depthTextureExt // Prevent garbage collection.
  }
}

/**
 * Initialize a WebGL rendering loop with a list of rendering phases.
 * @param {WebGLRenderingContext} gl The webgl context to use.
 * @param {Object} shared An object containing state shared between phases.
 * Must include a reference to animationState, which controls animation loops.
 * @param {Array} phases An array of rendering phase objects. Each specifies
 * the vertex and fragment shader to use, the mesh to upload as an attribute
 * array, and optionally an init() and draw() method.
 * @returns {Function} The frame-drawing function for RequestAnimationFrame.
 */
function glStart (gl, shared, phases = []) {
try {
  if (!phases.length) { throw new Error('No rendering phases specified.') }
  if (!shared.animationState) { throw new Error('animationState needed.')}

  polyfillExtensions(gl)

  shared.projection = frustum({ near: 0.451, far: 1000, fov: 25, aspect: 1.0 })

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
    p.projection = gl.getUniformLocation(p.program, 'projection')
    p.modelview = gl.getUniformLocation(p.program, 'modelview')

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

  // Drawing function returned by glStart.
  // Draws each phase.
  function drawFrame (t) {
    drawFrame.pauseTime ??= 0
    drawFrame.t0 ??= t
    if (drawFrame.pauseTime) {
      drawFrame.t0 += t - drawFrame.pauseTime
      drawFrame.pauseTime = 0
    }
    const dt = t - drawFrame.t0

    gl.clearColor(0.1, 0.1, 0.1, 1)
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

function parseFramebufferStatus (status) {
  return Object.entries(WebGLRenderingContext)
          .find(x => x[1] === status)[0]
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

  for (const [i,e] of document.querySelectorAll('.kernel input').entries()) {
    state.kernel[i] = e.value

    e.addEventListener('input', event => {
      state.kernel[i] = parseFloat(event.target.value)
    })
    e.addEventListener('focus', event => {
      event.target.select()
    })
    e.addEventListener('blur', event => {
      if (isNaN(parseFloat(event.target.value))) {
        event.target.value = 0.0
        event.target.dispatchEvent(new Event('input'))
      }
    })
  }

  function loadKernel (k) {
    for (const [i,e] of document.querySelectorAll('.kernel input')
                        .entries()) {
      e.value = k[i]
      e.dispatchEvent(new Event('input'))
    }
  }

  const kernelPresets = [
    [ // edge detect
      -0.125, -0.125, -0.125,
      -0.125,  1,     -0.125,
      -0.125, -0.125, -0.125
   ],
   [ // Gaussian blur
      0.045, 0.122, 0.045,
      0.122, 0.332, 0.122,
      0.045, 0.122, 0.045
   ],
   [ // emboss
      -2, -1,  0,
      -1,  1,  1,
      0,  1,  2
   ],
   [ // unsharpen
    -1, -1, -1,
    -1,  9, -1,
    -1, -1, -1
   ]
  ]
  for (const [i,e] of document.querySelectorAll('.presets input').entries()) {
    e.addEventListener('change', event => {
      loadKernel(kernelPresets[i])
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

function show (m, tag = undefined) {
  show.set ??= new Set()
  if (tag && show.set.has(tag))
    return

  show.set.add(tag)

  let tr = []
  m.forEach(v => tr.push( String(v).slice(0,5).padEnd(10) ))
  log(tag.padEnd(30) + '(column -> row major):')
  log(tr[0], tr[4], tr[8], tr[12])
  log(tr[1], tr[5], tr[9], tr[13])
  log(tr[2], tr[6], tr[10], tr[14])
  log(tr[3], tr[7], tr[11], tr[15])
}


function initBloomCube () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.MV = []
  this.normal = gl.getAttribLocation(this.program, 'normal')
  gl.enableVertexAttribArray(this.normal)
  gl.vertexAttribPointer(this.normal,
    3, gl.FLOAT, false, this.mesh.byteStride,
    3 * Float32Array.BYTES_PER_ELEMENT)

  this.shared.fbSize ??= 128
  const fbSize = this.shared.fbSize

  const brightSource = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, brightSource)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
    fbSize, fbSize, 0, gl.RGBA,
    gl.UNSIGNED_BYTE, null)

  const depthBuffer = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
    fbSize, fbSize)

  const fboBright = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboBright)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D, brightSource, 0)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER, depthBuffer)

  const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
    logError('Framebuffer incomplete: '
      + parseFramebufferStatus(framebufferStatus))
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  this.shared.fboBright = fboBright
  this.shared.brightSource = brightSource
}

function drawBloomCube () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboBright)
  gl.viewport(0, 0, this.shared.fbSize, this.shared.fbSize)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  
  ident(this.MV)
  mult4(this.MV,
    rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV)
    mult4(this.MV,
    rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(
                  2.5*Math.cos(τ * this.dt/3000),
                  Math.sin(τ * this.dt/12000),
                  -30.0 + 8.0*Math.sin(τ * this.dt/6000)),
    this.MV)

  gl.uniformMatrix4fv(this.modelview, false, this.MV)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  gl.disable(gl.BLEND)
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
}

function initBloomQuad () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl
  
  this.uTex = gl.getUniformLocation(this.program, 'uTex')
  this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
  this.kernel = gl.getUniformLocation(this.program, 'kernel')
  this.blurStep = gl.getUniformLocation(this.program, 'blurStep')

  // Provide texture coordinates as an attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
  gl.enableVertexAttribArray(this.aTexel)
  gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
    this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // Provide normalized Gaussian weights
  gl.uniform1fv(this.kernel, [
    .204092, .180051, .123785, .066496, .027622
  ])

  // Initialize two framebuffers, each with a color texture,
  // to alternate between when blur rendering
  this.shared.fbSize ??= 128
  const fbSize = this.shared.fbSize
  const fboAlternates = [gl.createFramebuffer(), gl.createFramebuffer()]
  const texAlternates = [gl.createTexture(), gl.createTexture()]

  for (let i = 0; i < fboAlternates.length; i++) {
    gl.bindTexture(gl.TEXTURE_2D, texAlternates[i])
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
      fbSize, fbSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboAlternates[i])
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, texAlternates[i], 0)

    const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
      logError('Framebuffer incomplete: '
        + parseFramebufferStatus(framebufferStatus))
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  this.fboAlternates = fboAlternates
  this.texAlternates = texAlternates
}

function drawBloomQuad () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  let bx = 1/this.shared.fbSize * Math.cos(π * this.dt/1000)
  // debug:
  bx = 1/this.shared.fbSize
  let by = 0

  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.viewport(0, 0, this.shared.fbSize, this.shared.fbSize)

  const needErase = [true, true]

  let readSource = this.shared.brightSource
  for (let i = 0; i < 10; i++) {

    // Set write destination
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAlternates[i % 2])
    if(needErase[i % 2]) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      needErase[i % 2] = false
    }

    // Set read source
    gl.bindTexture(gl.TEXTURE_2D, readSource)
    
    gl.uniform2fv(this.blurStep, [bx, by])
    ;[bx, by] = [by, bx]

    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

    // Next iteration, read from the texture we just drew:
    readSource = this.texAlternates[i % 2]
  }

  // Composite the final result onto the main canvas:
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.bindTexture(gl.TEXTURE_2D, readSource)
  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

  // Clean up:
  gl.disable(gl.BLEND)
  gl.enable(gl.DEPTH_TEST)
}

function initCube () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.normal = gl.getAttribLocation(this.program, 'normal')
  gl.enableVertexAttribArray(this.normal)
  gl.vertexAttribPointer(this.normal,
    3, gl.FLOAT, false, this.mesh.byteStride,
    3 * Float32Array.BYTES_PER_ELEMENT)

  this.MV = []
}

function drawCube () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  ident(this.MV)
  mult4(this.MV,
    rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV)
  mult4(this.MV,
    rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(2.5*Math.cos(this.dt/1000),
    Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
    this.MV)

  gl.uniformMatrix4fv(this.modelview, false, this.MV)

  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
}

function initPorky () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.MV = []
}

function drawPorky () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  ident(this.MV)
  mult4(this.MV,
    rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV)
  mult4(this.MV,
    rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(2.5*Math.cos(this.dt/1000),
    Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
    this.MV)

  gl.uniformMatrix4fv(this.modelview, false, this.MV)

  gl.drawArrays(gl.LINES, 0, this.mesh.blocks)
}

/**
 * Compute an array of values from a Gaussian distribution
 * The results are weighted to match their usage in the shader,
 * such that [0] + 2*Σ[1..steps - 1] = 1.0
 * https://www.desmos.com/calculator/go97pnmify
 * @param {number} sigma standard deviation (prior to normalization)
 * @param {number} steps the number of elements for the one-sided kernel
 */
function normalizedGaussianKernel (sigma, steps) {
  const yMin = 0.06 // The lowest y value to include
  const xMax = Math.sqrt(-2 * sigma ** 2 * Math.log(yMin * sigma *
                Math.sqrt(2 * π))) // the x value for yMin

  const dx = xMax / (steps - 1)
  const distribution = []
  let x = 0
  let sum = 0

  for (let i = 0; i < steps; i++) {
    const gx = g(x)
    distribution.push(gx)
    sum += 2*gx // each element, except the 0th, will be sampled twice
    x += dx
  }

  sum -= g(0) // correct for the first element's weight

  // normalize the result:
  distribution.forEach((e,i) => distribution[i] = e / sum)

  log(distribution)
  return distribution

  function g (x) {
    return 1 / (sigma * Math.sqrt(2 * π))
            * Math.exp(-0.5 * (x/sigma) ** 2)
  }
}
