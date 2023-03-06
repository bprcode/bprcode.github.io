
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
    rotateXY(t * Math.sin(p/4 + this.dt / 5000.0)), this.MV)
    mult4(this.MV,
    rotateXZ(t * Math.sin(p/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(
                  2.5*Math.cos(t * this.dt/3000),
                  Math.sin(t * this.dt/12000),
                  -30.0 + 8.0*Math.sin(t * this.dt/6000)),
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

  let bx = 1/this.shared.fbSize * Math.cos(p * this.dt/1000)
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
    rotateXY(t * Math.sin(p/4 + this.dt / 5000.0)), this.MV)
  mult4(this.MV,
    rotateXZ(t * Math.sin(p/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(2.5*Math.cos(this.dt/1000),
    Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
    this.MV)

  gl.uniformMatrix4fv(this.modelview, false, this.MV)

  gl.drawArrays(gl.TRIANGLES, 0, this.mesh.blocks)
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
    rotateXY(t * Math.sin(p/4 + this.dt / 5000.0)), this.MV)
  mult4(this.MV,
    rotateXZ(t * Math.sin(p/4 + this.dt / 4000.0)), this.MV)
  mult4(this.MV, translateMatrix(2.5*Math.cos(this.dt/1000),
    Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
    this.MV)

  gl.uniformMatrix4fv(this.modelview, false, this.MV)

  gl.drawArrays(gl.LINES, 0, this.mesh.blocks)
}