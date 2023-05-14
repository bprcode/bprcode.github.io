'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { state, log, logError } from './cycle.js'
import { shaders } from './gleam-shaders.js'
import { π, ident, mult4, scaleMatrix, translateMatrix }
  from './sundry-matrix.js'

export const painters = {}

painters.commonTesseractAnimation = function () {
  ident(this.M3)
  ident(this.M4)

  // After 4d projection
  if (this.shared.animator) { this.shared.animator.call(this) }

  mult4(this.M3, scaleMatrix(2.0), this.M3)
  mult4(this.M3, translateMatrix(0, 0, -20), this.M3)
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
  const fboAlternates = [
    gl.createFramebuffer(),
    gl.createFramebuffer()
  ]
  const texAlternates = [
    blankTexture(gl, gl.TEXTURE0 + 3,
      () => Math.floor(gl.canvas.clientWidth / 2)),
    blankTexture(gl, gl.TEXTURE0 + 4,
      () => Math.floor(gl.canvas.clientWidth / 2))
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
  
  let bx = 1/this.shared.blurRes
  let by = 0

  gl.viewport(0, 0, this.shared.blurRes, this.shared.blurRes)
  gl.disable(gl.BLEND)

  const needErase = [true, true]
  const iterations = state.blurPassCount

  // Initially, read from texture unit 1:
  this.shared.readTexture = 1
  gl.uniform1i(this.uTex, this.shared.readTexture)

  for (let i = 0; i < iterations; i++) {
    // Set write destination
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAlternates[i % 2])
    if(needErase[i % 2]) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      needErase[i % 2] = false
    }

    gl.uniform2fv(this.blurStep, [bx, by])
    ;[bx, by] = [by, bx]

    // Set read source
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
    
    // Alternate between texture unit 3 and 4:
    this.shared.readTexture = 3 + i % 2
    gl.uniform1i(this.uTex, this.shared.readTexture)
  }

  gl.enable(gl.BLEND)
  return
}

painters.prepareBlurSurfaces = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl
  const res = gl.canvas.clientWidth

  let lastRes = null

  if (!(gl instanceof WebGLRenderingContext)) {
        
      const rb = gl.createRenderbuffer()
      const samples = Math.min(16, gl.getParameter(gl.MAX_SAMPLES))
      const fboAA = gl.createFramebuffer()

      log('Applying ' + samples + 'x MSAA')
      logError('Applying ' + samples + 'x MSAA\n')

      function fitRenderbuffer (buffer, format) {
        const updatedRes = gl.canvas.clientWidth
        if (lastRes === updatedRes) { return }
        const restore = gl.getParameter(gl.RENDERBUFFER_BINDING)

        gl.bindRenderbuffer(gl.RENDERBUFFER, buffer)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER,
          samples, format, updatedRes, updatedRes)

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboAA)
        // N.B. the following call does not need to happen on every resize
        // for most platforms, but Chrome mobile requires it:
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
          gl.RENDERBUFFER, rb)

        gl.bindRenderbuffer(gl.RENDERBUFFER, restore)
        lastRes = updatedRes
      }

      fitRenderbuffer(rb, gl.RGBA8)

      window.addEventListener('resize', event => {
        fitRenderbuffer(rb, gl.RGBA8)
      })

      verifyFramebuffer(gl)
      this.shared.fboAA = fboAA

  } else {
    logError('✔ Bypassing MSAA.')
  }

  const clearTexture = blankTexture(gl, gl.TEXTURE0 + 1,
    () => gl.canvas.clientWidth, gl.RGBA)

  const fboClear = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboClear)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D, clearTexture, 0)

  verifyFramebuffer(gl)

  this.shared.res = res
  this.shared.blurRes = Math.floor(res / 2)
  this.shared.fboClear = fboClear
  this.shared.clearTexture = clearTexture

  window.addEventListener('resize', event => {
    this.shared.res = gl.canvas.clientWidth
    this.shared.blurRes = Math.floor(gl.canvas.clientWidth / 2)
  })
}

painters.initTesseractBorder = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl
  
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
    this.specularDirection1 =
      gl.getUniformLocation(this.program, 'specularDirection1')
    this.specularDirection2 =
      gl.getUniformLocation(this.program, 'specularDirection2')
    this.specularDirection3 =
      gl.getUniformLocation(this.program, 'specularDirection3')
    this.specularDirection4 =
      gl.getUniformLocation(this.program, 'specularDirection4')
    this.frameSpecularWeight =
      gl.getUniformLocation(this.program, 'frameSpecularWeight')
  }
}

painters.drawTesseractBorder = function () {
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

  // If the mesh has normals, provide values for specularity:
  if (this.mesh.stride === 8) {
    gl.uniform4fv(this.specularColor1, state.lighting.specularLights[0].rgba)
    gl.uniform4fv(this.specularColor2, state.lighting.specularLights[1].rgba)
    gl.uniform4fv(this.specularColor3, state.lighting.specularLights[2].rgba)
    gl.uniform4fv(this.specularColor4, state.lighting.specularLights[3].rgba)
    gl.uniform4fv(this.specularDirection1,
      state.lighting.specularLights[0].xyzw)
    gl.uniform4fv(this.specularDirection2,
      state.lighting.specularLights[1].xyzw)
    gl.uniform4fv(this.specularDirection3,
      state.lighting.specularLights[2].xyzw)
    gl.uniform4fv(this.specularDirection4,
      state.lighting.specularLights[3].xyzw)
  }

  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
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
  this.diffuseDirection1 =
    gl.getUniformLocation(this.program, 'diffuseDirection1')
  this.diffuseDirection2 =
    gl.getUniformLocation(this.program, 'diffuseDirection2')
  this.diffuseDirection3 =
    gl.getUniformLocation(this.program, 'diffuseDirection3')

  this.specularColor1 = gl.getUniformLocation(this.program, 'specularColor1')
  this.specularColor2 = gl.getUniformLocation(this.program, 'specularColor2')
  this.specularColor3 = gl.getUniformLocation(this.program, 'specularColor3')
  this.specularColor4 = gl.getUniformLocation(this.program, 'specularColor4')
  this.specularDirection1 =
    gl.getUniformLocation(this.program, 'specularDirection1')
  this.specularDirection2 =
    gl.getUniformLocation(this.program, 'specularDirection2')
  this.specularDirection3 =
    gl.getUniformLocation(this.program, 'specularDirection3')
  this.specularDirection4 =
    gl.getUniformLocation(this.program, 'specularDirection4')

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
  gl.uniform4fv(this.diffuseDirection1, state.lighting.diffuseLights[0].xyzw)
  gl.uniform4fv(this.diffuseDirection2, state.lighting.diffuseLights[1].xyzw)
  gl.uniform4fv(this.diffuseDirection3, state.lighting.diffuseLights[2].xyzw)

  gl.uniform4fv(this.specularColor1, state.lighting.specularLights[0].rgba)
  gl.uniform4fv(this.specularColor2, state.lighting.specularLights[1].rgba)
  gl.uniform4fv(this.specularColor3, state.lighting.specularLights[2].rgba)
  gl.uniform4fv(this.specularColor4, state.lighting.specularLights[3].rgba)
  gl.uniform4fv(this.specularDirection1,
    state.lighting.specularLights[0].xyzw)
  gl.uniform4fv(this.specularDirection2,
    state.lighting.specularLights[1].xyzw)
  gl.uniform4fv(this.specularDirection3,
    state.lighting.specularLights[2].xyzw)
  gl.uniform4fv(this.specularDirection4,
    state.lighting.specularLights[3].xyzw)

  gl.viewport(0, 0, this.shared.res, this.shared.res)

  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
}

/**
 * Target the shared "clear" framebuffer (for the unblurred image) if
 * MSAA is disabled, or instead target the shared framebuffer with MSAA
 * enabled, expecting to resolve the result with a future call to
 * resolveClearTarget().
 */
painters.useClearTarget = function () {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl

  // If using MSAA, render and resolve,
  // otherwise render directly to texture.
  if (this.shared.fboAA) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboAA)

  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shared.fboClear)
  }

  gl.viewport(0, 0, this.shared.res, this.shared.res)
  gl.clear(gl.COLOR_BUFFER_BIT)
}

/**
 * If the MSAA framebuffer is in use, resolve it.
 * Otherwise, do nothing.
 */
painters.resolveClearTarget = function() {
  /** @type {WebGL2RenderingContext} */
  const gl = this.gl

  if (this.shared.fboAA) {
    // Resolve MSAA:
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.shared.fboAA)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.shared.fboClear)
    gl.blitFramebuffer(
      0, 0, this.shared.res, this.shared.res,
      0, 0, this.shared.res, this.shared.res,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    )
  }
}

painters.initCompositor = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
  this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
  this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
  this.uClarityScale = gl.getUniformLocation(this.program, 'clarityScale')

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
  gl.enableVertexAttribArray(this.aTexel)
  gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
    this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  gl.uniform1i(this.uBlurTex, 0)
  gl.uniform1i(this.uClearTex, 1)
}

painters.initLensCompositor = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.aTexel = gl.getAttribLocation(this.program, 'aTexel')
  this.uBlurTex = gl.getUniformLocation(this.program, 'blurTex')
  this.uClearTex = gl.getUniformLocation(this.program, 'clearTex')
  this.uLensTex = gl.getUniformLocation(this.program, 'lensTex')
  this.uCloudPhase = gl.getUniformLocation(this.program, 'cloudPhase')
  this.uClarityScale = gl.getUniformLocation(this.program, 'clarityScale')

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
  gl.enableVertexAttribArray(this.aTexel)
  gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
    this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  gl.uniform1i(this.uBlurTex, 0)
  gl.uniform1i(this.uClearTex, 1)
  gl.uniform1i(this.uLensTex, 5)

  // Create temporary texture, asynchronously load texture data:
  this.lensTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + 5)
  gl.bindTexture(gl.TEXTURE_2D, this.lensTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
    1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]))

  const lensImage = new Image()
  lensImage.addEventListener('load', () => {
    log('Loaded!')
    const restore = gl.getParameter(gl.TEXTURE_BINDING_2D)
    gl.bindTexture(gl.TEXTURE_2D, this.lensTexture)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
      gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
      lensImage)
    gl.generateMipmap(gl.TEXTURE_2D)

    gl.bindTexture(gl.TEXTURE_2D, restore)
  })
  console.warn('debug -- testing delayed resource load')
  setTimeout(() => lensImage.src = '../cloud-contrast.png', 1000)
}

painters.drawCompositor = function () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  const cloudPeriod = 0.5 * 60000

  gl.uniform1f(this.uCloudPhase, (this.dt % cloudPeriod) / cloudPeriod)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, this.shared.res, this.shared.res)

  gl.uniform1i(this.uBlurTex, this.shared.readTexture)
  gl.uniform1f(this.uClarityScale, state.clarityScale)
  
  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.mesh.blocks)
}

/**
 * Allocate a blank WebGLTexture and initialize it with common parameters.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} context The
 * context binding this texture
 * @param {GLint} unit The texture unit on which to bind the texture 
 * @param {number|Function} resolution Width/height of the texture, or
 * a callback function to evaluate upon resize
 * @param {GLenum} format Defaults to gl.RGBA, can be gl.DEPTH_COMPONENT
 * @returns {WebGLTexture} 
 */
function blankTexture (context, unit, resolution, format) {
  /**@type {WebGLRenderingContext} */
  const gl = context
  const tex = gl.createTexture()
  let res = null
  let lastRes = null
  format ??= gl.RGBA

  if (typeof resolution === 'function') {
    res = resolution()
    lastRes = res

    window.addEventListener('resize', _ => {
      const restore = gl.getParameter(gl.TEXTURE_BINDING_2D)
      res = resolution()

      if (lastRes === res) { return }
      
      gl.bindTexture(gl.TEXTURE_2D, tex)
      setTexture()
      gl.bindTexture(gl.TEXTURE_2D, restore)
      lastRes = res
    })
  } else {
    res = resolution
    lastRes = res
  }

  gl.activeTexture(unit)
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
      // N.B. querying Object.entries on a WebGL2RenderingContext will throw
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

export class Lighting {
  static Light = class {
    xyzw = [0,0,0,0]
    rgba = [0,0,0,0]

    constructor (initial = {}) {
      if (initial.xyzw) { this.xyzw = [...initial.xyzw] }
      if (initial.rgba) { this.rgba = [...initial.rgba] }
    }
  }

  constructor () {
    this.specularLights = [
      new Lighting.Light({xyzw: [-0.707106781, 0, 0.707106781, 0]}),
      new Lighting.Light({xyzw: [0, -0.707106781, 0, -0.707106781]}),
      new Lighting.Light({xyzw: [0.577350269, 0.577350269, -0.577350269, 0]}),
      new Lighting.Light({xyzw: [0, 0, -1, 0]}),
    ]
    
    this.diffuseLights = [
      new Lighting.Light({xyzw: [-0.707106781, 0, 0.707106781, 0]}),
      new Lighting.Light({xyzw: [0, -0.707106781, 0, -0.707106781]}),
      new Lighting.Light({xyzw: [0, 0, 0, -1]}),
    ]

    this.glow = new Lighting.Light
    this.membrane = new Lighting.Light

    this.nearFrameColor = [0,0,0,0]
    this.farFrameColor = [0,0,0,0]

    this.diffuseOpacity = 1
    this.specularOpacity = 1
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
