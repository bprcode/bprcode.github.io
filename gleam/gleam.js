'use strict';

const π = Math.PI
const τ = π * 2
const log = console.log.bind(console)
console.clear()

// debug -- have set dimensions to /2 to test MSAA development

const state = {
  sliders: [],
  checkboxes: [],
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

  const shaders = buildShaders()
  const geometry = buildGeometry()

  const mainCanvas = document.getElementById('main-canvas')
  let gl = mainCanvas.getContext(
    'webgl2', { alpha: false, premultipliedAlpha: false, antialias: false })
  if (!gl) {
    gl = mainCanvas.getContext(
      'webgl', { alpha: false, premultipliedAlpha: false, antialias: false })
  }

  document.getElementById('first-title').querySelector('.view-label')
    .textContent =
    gl.getParameter(gl.VERSION)
    + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)

  const gl2 = document.getElementById('second-canvas')
    .getContext(
      'webgl', { alpha: false, premultipliedAlpha: false, antialias: false  })
  document.getElementById('second-title').querySelector('.view-label')
    .textContent =
    gl2.getParameter(gl2.VERSION)
    + ' / ' + gl2.getParameter(gl2.SHADING_LANGUAGE_VERSION)

  for (const ctx of [gl, gl2]) {
    ctx.canvas.width = ctx.canvas.clientWidth / 1
    ctx.canvas.height = ctx.canvas.clientHeight / 1
  }

  function commonCubeAnimation () {
    ident(this.M)
    mult4(this.M, scaleMatrix(0.15), this.M)
    mult4(this.M,
      rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.M)
      mult4(this.M,
      rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.M)
    mult4(this.M, translateMatrix(
                    0.1*Math.cos(this.dt/1000),
                    0.1*Math.sin(this.dt/2000),
                    -3 + 0.5*Math.sin(this.dt/1000)),
      this.M)
  }

  function commonTesseractAnimation () {
    ident(this.M3)
    ident(this.M4)

    // Before 4d projection
    if (state.checkboxes[0]) {
    mult4(this.M4,
          rotateXY(τ * Math.sin(π/4 + this.dt / 11250)),
          this.M4)
    mult4(this.M4,
          rotateYW(τ * Math.sin(π/4 + this.dt / 6750)),
          this.M4)
    mult4(this.M4,
            rotateZW(τ * Math.sin(π/4 + this.dt / 9000.0)),
            this.M4)
    mult4(this.M4,
            rotateYW(τ * Math.sin(π/4 + this.dt / 18000.0)),
            this.M4)
    }
    
    if (state.checkboxes[1]) {
      state.beta = this.dt / 230
      state.gamma = this.dt / 170
    }

    // After 4d projection
    mult4(this.M3, scaleMatrix(2.0), this.M3)
    mult4(this.M3,
          rotateYZ((90 - state.beta) * τ / 360),
          this.M3)
    mult4(this.M3,
          rotateXZ((180 - state.gamma) * τ / 360),
          this.M3)
    mult4(this.M3, translateMatrix(0, 0, -20), this.M3)
  }

  function initBlurCompositor () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
    this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
    this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
    this.uDepthTex = gl.getUniformLocation(this.program, 'depthTex')
    this.uFocalDistance = gl.getUniformLocation(this.program, 'focalDistance')

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

    gl.uniform1f(this.uFocalDistance, state.sliders[1])

    // blurTexture should already be bound
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

    // // Clean up:
    gl.enable(gl.DEPTH_TEST)
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
    const texAlternates = [
      blankTexture(gl, () => gl.canvas.clientWidth / 1),
      blankTexture(gl, () => gl.canvas.clientWidth / 1)
    ]
  
    for (let i = 0; i < fboAlternates.length; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboAlternates[i])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, texAlternates[i], 0)
  
      verifyFramebuffer(gl)
    }
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    
    if (!this.shared.blurRes) {
      console.warn('Warning: initial blurRes unavailable.')
    }
    if (!this.shared.clearTexture) {
      console.warn('Warning: initial clearTexture unavailable.')
    }
    this.fboAlternates = fboAlternates
    this.texAlternates = texAlternates
  }
  
  function drawBlur () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    let bx = 1/this.shared.blurRes * Math.cos(π * this.dt/1000)
    
    bx = 1/this.shared.blurRes
    let by = 0
  
    gl.disable(gl.DEPTH_TEST)
    gl.viewport(0, 0, this.shared.blurRes, this.shared.blurRes)
  
    const needErase = [true, true]
    const iterations = 6
  
    let readSource = this.shared.clearTexture
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

  function initPlainCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    this.M = []
    this.normal = gl.getAttribLocation(this.program, 'normal')
    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal,
      3, gl.FLOAT, false, this.mesh.byteStride,
      3 * Float32Array.BYTES_PER_ELEMENT)

    const res = gl.canvas.clientWidth
    // const clearTexture = blankTexture(gl, res)
    
    // const depthBuffer = gl.createRenderbuffer()
    // gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
    // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
    //   res, res)

    // const fboClear = gl.createFramebuffer()
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fboClear)
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    //   gl.TEXTURE_2D, clearTexture, 0)
    // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
    //   gl.RENDERBUFFER, depthBuffer)

    // verifyFramebuffer(gl)

    // gl.activeTexture(gl.TEXTURE0 + 1)
    // gl.bindTexture(gl.TEXTURE_2D, clearTexture)

    // gl.activeTexture(gl.TEXTURE0)

    // this.shared.clearTexture = clearTexture
    // this.fboClear = fboClear
    this.shared.res = res

    window.addEventListener('resize', event => {
      this.shared.res = gl.canvas.clientWidth
    })
  }
  
  function drawPlainCube () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
  
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.shared.res, this.shared.res)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    commonCubeAnimation.call(this)
  
    gl.uniformMatrix4fv(this.model, false, this.M)
  
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  }

  function drawTexturedQuad () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
  }

  function initClearTesseract () {
    /** @type {WebGL2RenderingContext} */
    const gl = this.gl
    const res = gl.canvas.clientWidth / 1

    if (gl instanceof WebGL2RenderingContext) {
      log('Preparing tesseract for wgl2...')

        // Allocate a multisampled color buffer
        this.rb = gl.createRenderbuffer()
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb)

        const samples = Math.min(16, gl.getParameter(gl.MAX_SAMPLES))
        log(`Creating multisampled render target with ${samples} samples`)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER,
          samples, gl.RGBA8, res, res)

        // Allocate a multisampled depth buffer
        this.db = gl.createRenderbuffer()
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.db)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER,
          samples, gl.DEPTH_COMPONENT16, res, res)

        // debug -- will need to set up listener to resize rb
        // debug -- check -- is the depth buffer working?
        const fboAA = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboAA)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
          gl.RENDERBUFFER, this.rb)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER, this.db)

        verifyFramebuffer(gl)
        this.shared.fboAA = fboAA

    } else {
      log('WebGL1 -- skipping MSAA initialization')
      // log('prep for wgl1. Max samples: '
      //   + gl.getParameter(gl.MAX_SAMPLES))
    }
    
    this.M3 = []
    this.M4 = []

    this.uM3 = gl.getUniformLocation(this.program, 'M3')
    this.uM4 = gl.getUniformLocation(this.program, 'M4')

    const clearTexture =
      blankTexture(gl, () => gl.canvas.clientWidth / 1,
        gl.RGBA)
    const depthTexture =
      blankTexture(gl, () => gl.canvas.clientWidth / 1,
        gl.appropriateDepthFormat)

    const fboClear = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboClear)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, clearTexture, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D, depthTexture, 0)

    verifyFramebuffer(gl)

    // depth channel on texture unit 2
    gl.activeTexture(gl.TEXTURE0 + 2)
    gl.bindTexture(gl.TEXTURE_2D, depthTexture)
    
    // clear color channel on texture unit 1
    gl.activeTexture(gl.TEXTURE0 + 1)
    gl.bindTexture(gl.TEXTURE_2D, clearTexture)

    gl.activeTexture(gl.TEXTURE0)

    this.shared.res = res
    this.shared.blurRes = res
    this.shared.fboClear = fboClear
    this.shared.clearTexture = clearTexture
    this.shared.depthTexture = depthTexture

    window.addEventListener('resize', event => {
      this.shared.res = gl.canvas.clientWidth / 1
      this.shared.blurRes = gl.canvas.clientWidth / 1
    })
  }
  
  function drawClearTesseract () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    commonTesseractAnimation.call(this)
    
    gl.uniformMatrix4fv(this.uM3, false, this.M3)
    gl.uniformMatrix4fv(this.uM4, false, this.M4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboClear)
    gl.viewport(0, 0, this.shared.res, this.shared.res)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.drawArrays(gl.LINES, 0, this.mesh.blocks)
  }

  function initGlassTesseract () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl
    
    this.M3 = []
    this.M4 = []

    this.uM3 = gl.getUniformLocation(this.program, 'M3')
    this.uM4 = gl.getUniformLocation(this.program, 'M4')
    this.normal = gl.getAttribLocation(this.program, 'normal')

    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal, this.components, gl.FLOAT, false,
      this.mesh.byteStride, Float32Array.BYTES_PER_ELEMENT * 4)
    //
    const res = gl.canvas.clientWidth / 1
    // const clearTexture =
    //   blankTexture(gl, () => gl.canvas.clientWidth, gl.RGBA)
    // const depthTexture =
    //   blankTexture(gl, () => gl.canvas.clientWidth, gl.DEPTH_COMPONENT)

    // const fboClear = gl.createFramebuffer()
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fboClear)
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    //   gl.TEXTURE_2D, clearTexture, 0)
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
    //   gl.TEXTURE_2D, depthTexture, 0)

    // verifyFramebuffer(gl)

    // // depth channel on texture unit 2
    // gl.activeTexture(gl.TEXTURE0 + 2)
    // gl.bindTexture(gl.TEXTURE_2D, depthTexture)
    
    // // clear color channel on texture unit 1
    // gl.activeTexture(gl.TEXTURE0 + 1)
    // gl.bindTexture(gl.TEXTURE_2D, clearTexture)

    // gl.activeTexture(gl.TEXTURE0)

    this.shared.res = res
    // this.shared.blurRes = res
    // this.shared.fboClear = fboClear
    // this.shared.clearTexture = clearTexture
    // this.shared.depthTexture = depthTexture

    window.addEventListener('resize', event => {
      this.shared.res = gl.canvas.clientWidth / 1
      // this.shared.blurRes = gl.canvas.clientWidth
    })
  }

  function drawGlassTesseract () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    commonTesseractAnimation.call(this)
    
    gl.uniformMatrix4fv(this.uM3, false, this.M3)
    gl.uniformMatrix4fv(this.uM4, false, this.M4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.shared.res, this.shared.res)
    // gl.clearColor(0, 0, 0, 1)
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
  }

  function drawDonutTesseract () {
    /** @type {WebGL2RenderingContext} */
    const gl = this.gl

    commonTesseractAnimation.call(this)
    
    gl.uniformMatrix4fv(this.uM3, false, this.M3)
    gl.uniformMatrix4fv(this.uM4, false, this.M4)

    // If using MSAA, render and resolve,
    // otherwise render directly to texture.
    if (this.shared.fboAA) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboAA)
      gl.viewport(0, 0, this.shared.res, this.shared.res)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  
      gl.disable(gl.CULL_FACE)
      gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)

      // Resolve MSAA:
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.shared.fboAA)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.shared.fboClear)
      gl.clearBufferfv(gl.COLOR, 0, [1, 0, 1, 1])
      gl.blitFramebuffer(
        0, 0, this.shared.res, this.shared.res,
        0, 0, this.shared.res, this.shared.res,
        gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST
      )

    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboClear)
      gl.viewport(0, 0, this.shared.res, this.shared.res)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  
      gl.disable(gl.CULL_FACE)
      gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
    }
  }

  function initTesseractCompositor () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
    this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
    this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
    this.uDepthTex = gl.getUniformLocation(this.program, 'depthTex')
    this.uZFocalDistance =
      gl.getUniformLocation(this.program, 'zFocalDistance')
    this.uWFocalDistance =
      gl.getUniformLocation(this.program, 'wFocalDistance')
    this.uZFieldWidth =
      gl.getUniformLocation(this.program, 'zFieldWidth')
    this.uWFieldWidth =
      gl.getUniformLocation(this.program, 'wFieldWidth')

    this.uZNear = gl.getUniformLocation(this.program, 'zNear')
    this.uZFar = gl.getUniformLocation(this.program, 'zFar')
    gl.uniform1f(this.uZNear, this.shared.nearPlane)
    gl.uniform1f(this.uZFar, this.shared.farPlane)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
      this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.uniform1i(this.uBlurTex, 0)
    gl.uniform1i(this.uClearTex, 1)
    gl.uniform1i(this.uDepthTex, 2)
  }

  function drawTesseractCompositor () {
    /** @type {WebGLRenderingContext} */
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.shared.res, this.shared.res)

    let wd = state.sliders[2]

    if (state.checkboxes[2]) {
      wd = (Math.sin(τ * (this.dt / 9000)) ** 3) * 0.85 + 0.95
    }

    gl.uniform1f(this.uZFocalDistance, state.sliders[0])
    gl.uniform1f(this.uZFieldWidth, state.sliders[1])
    gl.uniform1f(this.uWFocalDistance, wd)
    gl.uniform1f(this.uWFieldWidth, state.sliders[3])

    // blurTexture should already be bound
    // debug -- doing it anyway for a different pipeline
    // gl.bindTexture(gl.TEXTURE_2D, this.shared.depthTexture)
    gl.bindTexture(gl.TEXTURE_2D, this.shared.blurTexture)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

    // // Clean up:
    gl.enable(gl.DEPTH_TEST)
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
      init: initClearTesseract,
      draw: drawDonutTesseract
    },
    { // post-process the output with iterated Gaussian blur:
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.blur1dFrag,
      mesh: geometry.texSquare,
      init: initBlur,
      draw: drawBlur
    },
    { // compose the blur (0) and clear (1) textures using depth (2).
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.blurCompositorFrag,
      mesh: geometry.texSquare,
      init: initTesseractCompositor,
      draw: drawTesseractCompositor
    },
    { // Draw diffuse light panes:
      vertexShader: shaders.normals4dVert,
      fragmentShader: shaders.glassTestFrag,
      mesh: geometry.normalTesseract,
      components: 4,
      init: initGlassTesseract,
      draw: drawGlassTesseract
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
      fragmentShader: shaders.greenFromWFrag,
      mesh: geometry.donutTesseract,
      components: 4,
      init: initClearTesseract,
      draw: drawDonutTesseract
    },
    { // post-process the output with iterated Gaussian blur:
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.blur1dFrag,
      mesh: geometry.texSquare,
      init: initBlur,
      draw: drawBlur
    },
    { // compose the blur (0) and clear (1) textures using depth (2).
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.blurCompositorFrag,
      mesh: geometry.texSquare,
      init: initTesseractCompositor,
      draw: drawTesseractCompositor
    },
    { // Draw diffuse light panes:
      vertexShader: shaders.normals4dVert,
      fragmentShader: shaders.glassTestFrag,
      mesh: geometry.normalTesseract,
      components: 4,
      init: initGlassTesseract,
      draw: drawGlassTesseract
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
 * @param {WebGLRenderingContext |WebGL2RenderingContext} gl 
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
 * Allocate a blank WebGLTexture and initialize it with common parameters.
 * @param {WebGLRenderingContext | WebGL2RenderingContext} context The
 * context binding this texture
 * @param {number} resolution Width/height of the texture
 * @param {GLenum} format Defaults to gl.RGBA, can be gl.DEPTH_COMPONENT
 * @returns {WebGLTexture} 
 */
function blankTexture (context, resolution, format) {
  /**@type {WebGLRenderingContext} */
  const gl = context
  const tex = gl.createTexture()
  let res
  format ??= gl.RGBA

  if (typeof resolution === 'function') {
    res = resolution()
    window.addEventListener('resize', event => {
      const restore = gl.getParameter(gl.TEXTURE_BINDING_2D)
      res = resolution()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      setTexture()
      gl.bindTexture(gl.TEXTURE_2D, restore)
    })
  } else {
    res = resolution
  }

  gl.bindTexture(gl.TEXTURE_2D, tex)

  if (format === gl.DEPTH_COMPONENT16 || format === gl.DEPTH_COMPONENT) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  setTexture()

  function setTexture () {
    if (format === gl.RGBA) {
      gl.texImage2D(gl.TEXTURE_2D, 0, format,
        res, res, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, null)
    } else if (format === gl.DEPTH_COMPONENT) {
      gl.texImage2D(gl.TEXTURE_2D, 0, format,
        res, res, 0, gl.DEPTH_COMPONENT,
        gl.UNSIGNED_SHORT, null)
    } else if (format === gl.DEPTH_COMPONENT16) {
      gl.texImage2D(gl.TEXTURE_2D, 0, format,
        res, res, 0, gl.DEPTH_COMPONENT,
        gl.UNSIGNED_SHORT, null)
    } else {
      throw new Error('Unsupported texture format for blankTexture.')
    }
  }
  
  return tex
}

/**
 * Check for successful initialization of a framebuffer;
 * report error if encountered.
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl context to use
 */
function verifyFramebuffer(gl) {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    log('test:')
      // Get a list of FRAMEBUFFER enums,
      // match the corresponding value.
      // n.b. querying Object.entries on a WebGL2RenderingContext will throw
      // an error from a canvas get method.
      const enums = Object.keys(Object.getPrototypeOf(gl))
                      .filter(x => x.startsWith('FRAMEBUFFER'))
      for (const e of enums) {
        if(gl[e] === status) {
          logError('Framebuffer incomplete: ' + e)
        }
      }
  }
}

/**
 * Initialize a WebGL rendering loop with a list of rendering phases.
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl context to use.
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
      ctx.canvas.width = ctx.canvas.clientWidth / 1
      ctx.canvas.height = ctx.canvas.clientHeight / 1
      ctx.viewport(0, 0, ctx.canvas.width, ctx.canvas.height)
      if (!s.keepAnimating) { requestAnimationFrame(s.draw) }
    }
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

  return distribution

  function g (x) {
    return 1 / (sigma * Math.sqrt(2 * π))
            * Math.exp(-0.5 * (x/sigma) ** 2)
  }
}
