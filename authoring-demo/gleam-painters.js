'use strict';

// function buildPainters () {
//   if (buildPainters.painters) { return buildPainters.painters }
const painters = {}
// const shaders = buildShaders()

painters.commonCubeAnimation = function () {
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

painters.commonTesseractAnimation = function () {
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
  
  let beta = state.averageBeta
  let gamma = state.averageGamma
  if (state.checkboxes[1]) {
    beta = this.dt / 170
    gamma = this.dt / 110
  }

  // After 4d projection
  if (this.shared.applyView) { this.shared.applyView.call(this) }

  mult4(this.M3, scaleMatrix(2.0), this.M3)
  // mult4(this.M3,
  //       rotateYZ((90 + beta) * τ / 360),
  //       this.M3)
  // mult4(this.M3,
  //       rotateXZ((180 - gamma) * τ / 360),
  //       this.M3)
  mult4(this.M3, translateMatrix(0, 0, -20), this.M3)
}

painters.initBlurCompositor = function () {
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

painters.compositeBlur = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  // blurTexture should already be bound
  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

  // // Clean up:
  gl.enable(gl.DEPTH_TEST)
}

painters.initBlur = function () {
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
    blankTexture(gl, () => gl.canvas.clientWidth),
    blankTexture(gl, () => gl.canvas.clientWidth)
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

painters.drawBlur = function () {
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

painters.initPlainCube = function () {
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

painters.drawPlainCube = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, this.shared.res, this.shared.res)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  painters.commonCubeAnimation.call(this)

  gl.uniformMatrix4fv(this.model, false, this.M)

  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
}

painters.drawTexturedQuad = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
}

painters.initEdgeTesseract = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl
  const res = gl.canvas.clientWidth

  // From experience, devices only supporting 4x MSAA also tend to
  // incur a steep performance penalty using it, so we only run
  // antialiasing on more performant platforms.
  if (!(gl instanceof WebGLRenderingContext)
      && gl.getParameter(gl.MAX_SAMPLES) > 8) {
        
      const rb = gl.createRenderbuffer()
      const db = gl.createRenderbuffer()
      const samples = Math.min(16, gl.getParameter(gl.MAX_SAMPLES))
      log('Applying ' + samples + ' xMSAA')

      function fitRenderbuffer (buffer, format) {
        const restore = gl.getParameter(gl.RENDERBUFFER_BINDING)
        const res = gl.canvas.clientWidth

        gl.bindRenderbuffer(gl.RENDERBUFFER, buffer)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER,
          samples, format, res, res)

        gl.bindRenderbuffer(gl.RENDERBUFFER, restore)
      }

      fitRenderbuffer(rb, gl.RGBA8)
      fitRenderbuffer(db, gl.DEPTH_COMPONENT16)

      window.addEventListener('resize', event => {
        fitRenderbuffer(rb, gl.RGBA8)
        fitRenderbuffer(db, gl.DEPTH_COMPONENT16)
      })

      const fboAA = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboAA)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.RENDERBUFFER, rb)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER, db)

      verifyFramebuffer(gl)
      this.shared.fboAA = fboAA

  } else {
    logError('✔ Bypassing MSAA.')
  }
  
  this.M3 = []
  this.M4 = []

  this.uM3 = gl.getUniformLocation(this.program, 'M3')
  this.uM4 = gl.getUniformLocation(this.program, 'M4')
  this.qModelL = gl.getUniformLocation(this.program, 'qModelL')
  this.qModelR = gl.getUniformLocation(this.program, 'qModelR')
  this.qViewL = gl.getUniformLocation(this.program, 'qViewL')
  this.qViewR = gl.getUniformLocation(this.program, 'qViewR')
  this.nearFrameColor = gl.getUniformLocation(this.program, 'nearFrameColor')
  this.farFrameColor = gl.getUniformLocation(this.program, 'farFrameColor')

  const clearTexture =
    blankTexture(gl, () => gl.canvas.clientWidth,
      gl.RGBA)
  const depthTexture =
    blankTexture(gl, () => gl.canvas.clientWidth,
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
    this.shared.res = gl.canvas.clientWidth
    this.shared.blurRes = gl.canvas.clientWidth
  })

  // If the mesh appears to contain normals, prepare to use them
  // and provide specular colors.
  if(this.mesh.stride === 8) {
    this.normal = gl.getAttribLocation(this.program, 'normal')
    gl.enableVertexAttribArray(this.normal)
    gl.vertexAttribPointer(this.normal, this.components, gl.FLOAT, false,
      this.mesh.byteStride, Float32Array.BYTES_PER_ELEMENT * 4)

    this.specularColor1 = gl.getUniformLocation(this.program, 'specularColor1')
    this.specularColor2 = gl.getUniformLocation(this.program, 'specularColor2')
    this.specularColor3 = gl.getUniformLocation(this.program, 'specularColor3')
    this.specularColor4 = gl.getUniformLocation(this.program, 'specularColor4')
    this.frameSpecularWeight =
      gl.getUniformLocation(this.program, 'frameSpecularWeight')
  }
}

painters.drawClearTesseract = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  painters.commonTesseractAnimation.call(this)
  
  gl.uniformMatrix4fv(this.uM3, false, this.M3)
  gl.uniformMatrix4fv(this.uM4, false, this.M4)

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboClear)
  gl.viewport(0, 0, this.shared.res, this.shared.res)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.drawArrays(gl.LINES, 0, this.mesh.blocks)
}

painters.initGlassTesseract = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl
  
  this.M3 = []
  this.M4 = []

  this.uM3 = gl.getUniformLocation(this.program, 'M3')
  this.uM4 = gl.getUniformLocation(this.program, 'M4')
  this.normal = gl.getAttribLocation(this.program, 'normal')

  this.qModelL = gl.getUniformLocation(this.program, 'qModelL')
  this.qModelR = gl.getUniformLocation(this.program, 'qModelR')
  this.qViewL = gl.getUniformLocation(this.program, 'qViewL')
  this.qViewR = gl.getUniformLocation(this.program, 'qViewR')
  this.opacity = gl.getUniformLocation(this.program, 'opacity')
  this.glowColor = gl.getUniformLocation(this.program, 'glowColor')
  this.membraneColor = gl.getUniformLocation(this.program, 'membraneColor')

  this.diffuseColor1 = gl.getUniformLocation(this.program, 'diffuseColor1')
  this.diffuseColor2 = gl.getUniformLocation(this.program, 'diffuseColor2')
  this.diffuseColor3 = gl.getUniformLocation(this.program, 'diffuseColor3')

  this.specularColor1 = gl.getUniformLocation(this.program, 'specularColor1')
  this.specularColor2 = gl.getUniformLocation(this.program, 'specularColor2')
  this.specularColor3 = gl.getUniformLocation(this.program, 'specularColor3')
  this.specularColor4 = gl.getUniformLocation(this.program, 'specularColor4')

  gl.enableVertexAttribArray(this.normal)
  gl.vertexAttribPointer(this.normal, this.components, gl.FLOAT, false,
    this.mesh.byteStride, Float32Array.BYTES_PER_ELEMENT * 4)

  const res = gl.canvas.clientWidth

  this.shared.res ??= res

  window.addEventListener('resize', event => {
    this.shared.res = gl.canvas.clientWidth
  })
}

painters.drawGlassTesseract = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  if (this.opacityFunction) {
    const t = this.opacityFunction.call(this)

    if (t <= 0.001) { return }
    gl.uniform1f(this.opacity, t)
  }

  painters.commonTesseractAnimation.call(this)
  
  gl.uniformMatrix4fv(this.uM3, false, this.M3)
  gl.uniformMatrix4fv(this.uM4, false, this.M4)
  gl.uniform4fv(this.glowColor, state.lighting.glow.rgba)
  gl.uniform4fv(this.membraneColor, state.lighting.membrane.rgba)
  gl.uniform4fv(this.diffuseColor1, state.lighting.diffuseLights[0].rgba)
  gl.uniform4fv(this.diffuseColor2, state.lighting.diffuseLights[1].rgba)
  gl.uniform4fv(this.diffuseColor3, state.lighting.diffuseLights[2].rgba)

  gl.uniform4fv(this.specularColor1, state.lighting.specularLights[0].rgba)
  gl.uniform4fv(this.specularColor2, state.lighting.specularLights[1].rgba)
  gl.uniform4fv(this.specularColor3, state.lighting.specularLights[2].rgba)
  gl.uniform4fv(this.specularColor4, state.lighting.specularLights[3].rgba)

  gl.viewport(0, 0, this.shared.res, this.shared.res)
  
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE)
  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  gl.disable(gl.BLEND)
  gl.enable(gl.DEPTH_TEST)
}

painters.useClearTarget = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl
}

painters.drawDonutTesseract = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl

  painters.commonTesseractAnimation.call(this)

  gl.uniformMatrix4fv(this.uM3, false, this.M3)
  gl.uniformMatrix4fv(this.uM4, false, this.M4)
  gl.uniform4fv(this.nearFrameColor, state.lighting.nearFrameColor)
  gl.uniform4fv(this.farFrameColor, state.lighting.farFrameColor)
  if (this.frameSpecularWeight) {
    gl.uniform1f(this.frameSpecularWeight, state.lighting.borderSpecularity)
  }

  // If the mesh has normals, provide colors for specularity:
  if (this.mesh.stride === 8) {
    gl.uniform4fv(this.specularColor1, state.lighting.specularLights[0].rgba)
    gl.uniform4fv(this.specularColor2, state.lighting.specularLights[1].rgba)
    gl.uniform4fv(this.specularColor3, state.lighting.specularLights[2].rgba)
    gl.uniform4fv(this.specularColor4, state.lighting.specularLights[3].rgba)
  }

  // If using MSAA, render and resolve,
  // otherwise render directly to texture.
  if (this.shared.fboAA) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboAA)
    gl.viewport(0, 0, this.shared.res, this.shared.res)
    gl.clearColor(0, 0, 0, 0)
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
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.disable(gl.CULL_FACE)
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
  }
}

painters.initTesseractCompositor = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
  this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
  this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
  this.uDepthTex = gl.getUniformLocation(this.program, 'depthTex')

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

painters.drawTesseractCompositor = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, this.shared.res, this.shared.res)

  gl.bindTexture(gl.TEXTURE_2D, this.shared.blurTexture)
  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)

  // // Clean up:
  gl.enable(gl.DEPTH_TEST)
}

//   return buildPainters.painters = painters
// }

/**
 * Allocate a blank WebGLTexture and initialize it with common parameters.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} context The
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
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl context to use
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

// Utility function for converting lighting data from prior RGB format
function convertLightingToAlpha (original) {
  for (const ref of [
    original.specularLights[0],
    original.specularLights[1],
    original.specularLights[2],
    original.specularLights[3],
    original.diffuseLights[0],
    original.diffuseLights[1],
    original.diffuseLights[2],
    original.glow,
    original.membrane
  ]) {
    if (ref.rgb) {
      const prev = ref.rgb
      ref.rgba = [...ref.rgb, 0]
      delete ref.rgb
      log('converted ' + prev + ' to ' + ref.rgba)
    }
  }
  if (original.nearFrameColor.length === 3) {
    original.nearFrameColor.push(0)
  }
  if (original.farFrameColor.length === 3) {
    original.farFrameColor.push(1)
  }

  original.borderSpecularity ??= 0

  return original
}

class Lighting {
  static Light = class {
    xyzw = [0,0,0,0]
    rgba = [0,0,0,0]
  }

  constructor () {
    this.specularLights = [
      new Lighting.Light,
      new Lighting.Light,
      new Lighting.Light,
      new Lighting.Light
    ]
    
    this.diffuseLights = [
      new Lighting.Light,
      new Lighting.Light,
      new Lighting.Light,
    ]

    this.glow = new Lighting.Light
    this.membrane = new Lighting.Light

    this.nearFrameColor = [0,0,0,0]
    this.farFrameColor = [0,0,0,1]

    this.diffuseOpacity = 1
    this.specularOpacity = 0
    this.borderSpecularity = 0
  }

  
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
