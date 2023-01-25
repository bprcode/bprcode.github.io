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

function initialize () {
try {
  initListeners()

  for (const c of [document.getElementById('main-canvas')]//,
                  ){// document.getElementById('second-canvas')]) {
    if (c) {
      const rect = c.getBoundingClientRect()
      c.setAttribute('width', rect.width)
      c.setAttribute('height', rect.height)
    }

    if (document.getElementById('legend')) {
      document.getElementById('legend').textContent =
        gl.getParameter(gl.VERSION)
        + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    }
  }

  buildShaders()

  // Build geometry
  const hexagon = [
    -1,    0,
    -0.5, -0.8660254,
     0.5, -0.8660254,
     1,    0,
     0.5,  0.8660254,
    -0.5,  0.8660254,
  ]

  const square2d = [
    -1, -1,
    1,  -1,
    1,  1,
    -1, 1,
  ]

  const texSquare = Mesh.from(square2d)
  texSquare.stride = 2
  texSquare.interleave(v => [(v[0] + 1) / 2, (v[1] + 1) / 2])
  texSquare.stride = 4

  const flatQuad = new Mesh(
    -1,  1,  1, //front
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
  )
  
  const quadLoop = new Mesh(
    -1,  1,  1, //front
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1
  )
  
  quadLoop.stride = 3
  // quadLoop.log('quadLoop: ')
  const triCube = extrudeLineStrip(quadLoop, 0, 0, 2.0)
  // const wireCube = extrudeLineStrip(quadLoop, 0, 0, 2.0)
  // wireCube.replace(v => [v[0], v[1], v[2] - 2], 3)
  // wireCube.push(...Mesh.from(quadLoop))

  const tesseract = wireframeTesseract()

  // triCube.log('after extrude:')
  /*
  const triCube = Mesh.from([
    ...flatQuad,
    ...transformMesh3(flatQuad, rotateXMatrix(π/2)),
    ...transformMesh3(flatQuad, rotateXMatrix(π)),
    ...transformMesh3(flatQuad, rotateXMatrix(3*π/2)),
    ...transformMesh3(flatQuad, rotateYMatrix(π/2)),
    ...transformMesh3(flatQuad, rotateYMatrix(-π/2)),
  ])//*/
  // const hex3d = Mesh.from(hexagon).replace(v => [v[0], v[1], 0.0], 2)
  // hex3d.stride = 3
  // const fan = fanClose(hex3d)
  // fan.replace(invertTriangle, 9)

  triCube.replace(breakQuad, 12)
  triCube.push(
    ...fanClose(quadLoop.slice(0, 12)).invertTriangles(),
    ...transformMesh3(fanClose(quadLoop.slice(0, 12)), translateMatrix(0,0,2)))

  triCube.replace(v => { // Compute and interleave normals
    const n = triangleNormal3(v)
    return [
      v[0], v[1], v[2], ...n,
      v[3], v[4], v[5], ...n,
      v[6], v[7], v[8], ...n,
    ]
  }, 9)
  triCube.stride = 6

  const gl = document.getElementById('main-canvas').getContext('webgl')
  const gl2 = document.getElementById('second-canvas').getContext('webgl2')
  document.getElementById('first-title').querySelector('.view-label')
    .textContent =
    gl.getParameter(gl.VERSION)
    + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
  document.getElementById('second-title').querySelector('.view-label')
    .textContent =
    gl2.getParameter(gl2.VERSION)
    + ' / ' + gl2.getParameter(gl2.SHADING_LANGUAGE_VERSION)

  polyfillExtensions(gl)
  polyfillExtensions(gl2)

  // Initialization callback for texture demo
  function initTexturer () {
    const gl = this.gl
    this.uTex = gl.getUniformLocation(this.program, 'uTex')
    this.uKernel = gl.getUniformLocation(this.program, 'kernel')
    this.uSize = gl.getUniformLocation(this.program, 'uSize')

    // Initialize the attribute buffer for texture coordinates:
    this.aTexel = gl.getAttribLocation(this.program, 'aTexel')

    /*  Here's how to allocate a separate array to store texture coordinates:
    this.stBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    //*/
    // Using the pre-existing interleaved data for texture coordinates:
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(this.aTexel)
    gl.vertexAttribPointer(this.aTexel, 2, gl.FLOAT, false,
      this.mesh.byteStride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // Initialize a texture:
    const textureSize = 128
    gl.uniform1f(this.uSize, textureSize)
    this.texOb = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texOb)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, // internal format
        textureSize, textureSize, // width, height
        0, // border
        gl.RGBA, // upload format
        gl.UNSIGNED_BYTE, // upload type
        demoTexture())

    loadLocalImage.call(this)
    function loadLocalImage () {
      const image = new Image()
      image.onload = () => {
        try {
        gl.bindTexture(gl.TEXTURE_2D, this.texOb)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,gl.RGBA,
          gl.UNSIGNED_BYTE, image)
          
        } catch (e) {
          document.querySelector('.feedback').style['visibility'] = 'visible'
          document.querySelector('.feedback').textContent
            += `Unable to access ${image.src}\n`
            + e.message
        }
      }

      image.src = './pathetic.png'
    }

    function demoTexture () {
      const size = textureSize
      const tex = new Uint8Array(size * size * 4)
      for (let i = 0; i < size*size; i++) {
        tex.set([255 * i/(size*size), 0, 255 * (i % size / size), 255], i*4)
      }

      return tex
    }
  }

  // Per-frame operations for texturing demo
  function stageTexturer () {
    const gl = this.gl
    gl.uniform1fv(this.uKernel, state.kernel)
    // gl.activeTexture(gl.TEXTURE0)
    // gl.bindTexture(gl.TEXTURE_2D, this.texOb)
    // gl.uniform1i(this.uTex, 0)
  }

  // Provided as a callback to an OpenGL context animation loop.
  function orbiter () {
    mult4(this.MV,
          rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV)
    mult4(this.MV,
            rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV)
    mult4(this.MV, translateMatrix(2.5*Math.cos(this.dt/1000),
            Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
            this.MV)
  }

  // debug -- almost identical to orbiter, but 4d
  function norbiter () {
    ident(this.MV3)
    ident(this.MV4)

    mult4(this.MV3, scaleMatrix(2.0), this.MV3)
    mult4(this.MV3,
          rotateXY(τ * Math.sin(π/4 + this.dt / 5000.0)), this.MV3)
    mult4(this.MV3,
            rotateXZ(τ * Math.sin(π/4 + this.dt / 4000.0)), this.MV3)
    mult4(this.MV3, translateMatrix(2.5*Math.cos(this.dt/1000),
            Math.sin(this.dt/2000), -30.0 + 8.0*Math.sin(this.dt/1000)),
            this.MV3)

    this.gl.uniformMatrix4fv(this.uMV3, false, this.MV3)
    this.gl.uniformMatrix4fv(this.uMV4, false, this.MV4)
  }

  // Similar behavior to orbiter, but split into 4- and 3-d operations.
  function fourbiter () {
    ident(this.MV3)
    ident(this.MV4)

    // Before 4d projection
    mult4(this.MV4,
          rotateXY(τ * Math.sin(π/4 + this.dt / 7500.0)),
          this.MV4)
    mult4(this.MV4,
          rotateYW(τ * Math.sin(π/4 + this.dt / 4500.0)),
          this.MV4)
    mult4(this.MV4,
            rotateZW(τ * Math.sin(π/4 + this.dt / 6000.0)),
            this.MV4)
    mult4(this.MV4,
            rotateYW(τ * Math.sin(π/4 + this.dt / 12000.0)),
            this.MV4)
    // After 4d projection
    mult4(this.MV3, scaleMatrix(2.0), this.MV3)
    mult4(this.MV3,
          rotateYZ((90 - state.beta) * τ / 360),
          this.MV3)
    mult4(this.MV3,
          rotateXZ((180 - state.gamma) * τ / 360),
          this.MV3)
    mult4(this.MV3, translateMatrix(0, 0, -15), this.MV3)
    // mult4(this.MV3, translateMatrix(2.5*Math.cos(this.dt/1000),
    //         Math.sin(this.dt/2000), -20.0 + 8.0*Math.sin(this.dt/1000)),
    //         this.MV3)

    this.gl.uniformMatrix4fv(this.uMV3, false, this.MV3)
    this.gl.uniformMatrix4fv(this.uMV4, false, this.MV4)
  }

  const squareMesh = Mesh.from(square2d)
  squareMesh.stride = 2

  /* 4d tesseract demo */
  // state.animation1.context = gl
  // state.animation1.animator = glMain(gl,
  //   { components: 4, animationState: state.animation1 }, [
  //     {
  //       drawMode: gl.LINES,
  //       vertexShader: shaders.vertexProjector4d,
  //       fragmentShader: shaders.wShader,
  //       mesh: tesseract,
  //       stage: fourbiter
  //     }
  //   ])

  /* 3d oblique wireframe demo
  state.animation1.animator = glMain(gl,
    { components: 3, animationState: state.animation1 }, [
    {
      drawMode: gl.LINE_STRIP,
      vertexShader: shaders.oblique3d,
      fragmentShader: shaders.blueShader,
      mesh: wireCube
    }
  ]) // */

  /* Wireframe demo
  state.animation1.animator = glMain(gl,
    { components: 3, animationState: state.animation1 }, [
    {
      drawMode: gl.LINES,
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.blueShader,
      mesh: generateNormalPorcupine(triCube),
    },
    { // second phase
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.blueShader,
      mesh: triCube,
      drawMode: gl.LINE_STRIP,
      supplyNormals: true,
    }
  ])//*/

  // texture demo
  state.animation1.context = gl
  state.animation1.animator = glMain(gl,
    { components: 2, animationState: state.animation1 }, [
      {
        drawMode: gl.TRIANGLE_FAN,
        vertexShader: shaders.textureVert,
        fragmentShader: shaders.textureFrag,
        mesh: texSquare,
        init: initTexturer,
        stage: function () {
          const gl = this.gl
          gl.uniform1fv(this.uKernel, [0,0,0,0,1,0,0,0,0])
        }
      }
    ])

  state.animation2.context = gl2
  state.animation2.animator = glMain(gl2,
    { components: 2, animationState: state.animation2 }, [
    {
      vertexShader: shaders.textureVert,
      fragmentShader: shaders.textureFrag,
      mesh: texSquare,
      drawMode: gl2.TRIANGLE_FAN,
      init: initTexturer,
      stage: stageTexturer
    }
  ])
  /*
  state.animation2.context = gl2
  state.animation2.animator = glMain(gl2,
    { components: 3, animationState: state.animation2 }, [
    { // first phase
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.redShader,
      mesh: triCube,
      drawMode: gl2.TRIANGLES,
      supplyNormals: true,
      stage: orbiter
    },
    // { // debug phase
    //   vertexShader: shaders.debugVert,
    //   fragmentShader: shaders.blueShader,
    //   mesh: triCube,
    //   drawMode: gl2.LINE_STRIP,
    //   supplyNormals: false
    // },
    { // second phase
      vertexShader: shaders.vertsWithNormals,
      fragmentShader: shaders.blueShader,
      mesh: generateNormalPorcupine(triCube),
      drawMode: gl2.LINES,
      supplyNormals: false,
      stage: orbiter
    }
  ])//*/

} catch (e) {
  document.querySelector('.feedback').style['visibility'] = 'visible'
  document.querySelector('.feedback').textContent
    += '\n🚩 Initialization error: ' + e.message
        + '\n' + e.stack
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
}

/**
 * Initialize a WebGL instance, based on specified properties, optionally with
 * multiple rendering passes according to a list of phases.
 * Each phase can optionally specify:
 * 
 * .vertexShader, .fragmentShader, .supplyNormals, .mesh, .byteStride, .drawMode,
  .drawCall

  each phase receives:
*
  .gl, .program, .buffer, .dt
*
* also attribute and uniform locations:
*
    .pos, .normal, .time, .osc, .mouse, .resolution, .projection, .modelview

 * @param {*} gl 
 * @param {*} props 
 * @param {*} phases 
 */
function glMain (gl, props = {}, phases = []) {
try {
  if (!phases.length) { phases[0] = {} }

  // Acquire the context's dimensions to later set uniforms
  const canvasRect = gl.canvas.getBoundingClientRect()

  log('setting up '+phases.length+ ' rendering phase(s)...')
  for (const p of phases) {
    // Initialize phase properties
    p.gl = gl
    p.vertexShader ??= props.vertexShader
    p.fragmentShader ??= props.fragmentShader
    p.supplyNormals ??= props.supplyNormals ?? false
    p.mesh ??= props.mesh || square2d
    p.byteStride ??= p.mesh?.byteStride
                    ?? 2 * Float32Array.BYTES_PER_ELEMENT
    p.drawMode ??= props.drawMode
    p.MV = []
    p.MV3 = []
    p.MV4 = []
    
    // Compile and link the shaders
    p.vs = compileShader(gl, p.vertexShader, gl.VERTEX_SHADER)
    p.fs = compileShader(gl, p.fragmentShader, gl.FRAGMENT_SHADER)
    p.program = gl.createProgram()
    gl.attachShader(p.program, p.vs)
    gl.attachShader(p.program, p.fs)
    linkProgram(gl, p.program)

    gl.deleteShader(p.vs)
    gl.deleteShader(p.fs)
    p.vs = null
    p.fs = null
    
    // Acquire a VAO to store vertex array state.
    p.vao = gl.createVertexArray()
    gl.bindVertexArray(p.vao)

    // Load the attribute buffer
    p.vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p.mesh), gl.STATIC_DRAW)
    // That's confusing, right? bindBuffer(ARRAY_BUFFER) manipulates
    // ARRAY_BUFFER itself, but bufferData writes into the location identified
    // by ARRAY_BUFFER

    // Acquire the positions of shader variables
    p.pos = gl.getAttribLocation(p.program, 'pos')
    p.normal = gl.getAttribLocation(p.program, 'normal')
    p.time = gl.getUniformLocation(p.program, 'time')
    p.osc = gl.getUniformLocation(p.program, 'osc')
    p.mouse = gl.getUniformLocation(p.program, 'mouse')
    p.resolution = gl.getUniformLocation(p.program, 'resolution')
    p.projection = gl.getUniformLocation(p.program, 'projection')
    p.modelview = gl.getUniformLocation(p.program, 'modelview')
    p.uMV3 = gl.getUniformLocation(p.program, 'MV3')
    p.uMV4 = gl.getUniformLocation(p.program, 'MV4')

    gl.useProgram(p.program)
    gl.uniform2fv(p.resolution, [canvasRect.width, canvasRect.height])

    // Set up vertex attribute state which will be remembered by the VAO.
    gl.enableVertexAttribArray(p.pos)
    gl.vertexAttribPointer(p.pos, props.components || 2, gl.FLOAT, false,
                            p.byteStride, 0)
    if (p.supplyNormals) {
      gl.enableVertexAttribArray(p.normal)
      gl.vertexAttribPointer(p.normal,
        props.components, gl.FLOAT, false, p.byteStride,
        3 * Float32Array.BYTES_PER_ELEMENT)
    }

    // Optional, but disable the ARRAY_BUFFER pointer.
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // Do phase-specific initialization, if provided.
    if (p.init) { p.init() }
  }

  // Common initialization between phases
  const P = frustum({ near: 0.451, far: 1000, fov: 25, aspect: 1.0 })

  gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

  const clearColor = props.clearColor || [0.1, 0.1, 0.1, 1]
  gl.clearColor(...clearColor)

  function drawFrame(t) {
    drawFrame.pauseTime ??= 0
    drawFrame.t0 ??= t
    if (drawFrame.pauseTime) {
      drawFrame.t0 += t - drawFrame.pauseTime
      drawFrame.pauseTime = 0
    }
    const dt = t - drawFrame.t0

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    for (const p of phases) {
      p.dt = dt
      gl.bindVertexArray(p.vao)

      if (phases.length > 1) {
        gl.useProgram(p.program)
      }

      gl.uniform1f(p.time, dt)
      gl.uniform1f(p.osc, Math.sin(dt / 1000.0))
      gl.uniform2fv(p.mouse, [state.nx, state.ny])

      ident(p.MV)

      // Allow each phase to define its own per-frame logic:
      if (p.stage) { p.stage() }

      // Supply matrices to uniform locations
      gl.uniformMatrix4fv(p.projection, false, P)
      gl.uniformMatrix4fv(p.modelview, false, p.MV)

      gl.drawArrays(p.drawMode ?? gl.TRIANGLES, 0,
                      p.mesh?.blocks)
    }

    if (props.animationState?.keepAnimating) {
      requestAnimationFrame(drawFrame)
    } else {
      drawFrame.pauseTime = t
    }
  }
  
  requestAnimationFrame(drawFrame)
  return drawFrame

} catch (e) {
  document.querySelector('.feedback').style['visibility'] = 'visible'
  document.querySelector('.feedback').innerHTML = formatShaderError(e)
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

function flip3Quad (q) {
  return [
    q[0], q[1], q[2],
    q[6], q[7], q[8],
    q[3], q[4], q[5],

    q[9], q[10], q[11],
    q[15], q[16], q[17],
    q[12], q[13], q[14]
  ]
}

function translate3 (mesh, x, y, z) {
  const result = []
  for (let i = 0; i < mesh.length; i += 3) {
    result[i] = mesh[i] + x
    result[i+1] = mesh[i+1] + y
    result[i+2] = mesh[i+2] + z
  }
  return result
}

/**
 * Apply a 4x4 transformation matrix to every point
 * of a dense 3-component mesh.
 * @param {number[]} mesh The mesh to act upon
 * @param {number[]} matrix The matrix to multiply each vertex by
 * @returns {number[]} The new result mesh.
 */
function transformMesh3 (mesh, matrix) {
  const result = []
  const x = []
  for (let i  = 0; i < mesh.length; i += 3) {
    const v = [mesh[i], mesh[i+1], mesh[i+2], 1]
    mult4vec(x, matrix, v)
    result[i]   = x[0]
    result[i+1] = x[1]
    result[i+2] = x[2]
  }
  return result
}

/**
 * Swap the order of a triangle to change its handedness.
 * @param {number[]} triangle 9-component array listing the current triangle
 * vertices.
 * @returns {number[]} 9-component array with the vertices in swapped order.
 */
function invertTriangle (triangle) {
  return [
    triangle[0], triangle[1], triangle[2],
    triangle[6], triangle[7], triangle[8],
    triangle[3], triangle[4], triangle[5]
  ]
}

/**
 * Generate a set of quads connecting a line strip to its translated image.
 * @param {number[]} strip The 3*n element strip of n 3-points to extrude
 * @param {number} dx The amount to extrude in the x-direction
 * @param {number} dy The amount to extrude in the y-direction
 * @param {number} dz The amount to extrude in the z-direction
 * @returns {Mesh} The 3*4*n element strip of n 4-point 3-number groups
 */
function extrudeLineStrip (strip, dx, dy, dz) {
  const quads = new Mesh
  const extrusion = Mesh.from(strip)
  extrusion.replace(v => [v[0] + dx, v[1] + dy, v[2] + dz], 3)

  for (let edge = 0; edge < (strip.length/3) - 1; edge++) {
    const i = edge * 3
    quads.push(...[
      extrusion[i],   extrusion[i+1], extrusion[i+2],
      strip[i],       strip[i+1],     strip[i+2],
      strip[i+3],     strip[i+4],     strip[i+5],
      extrusion[i+3], extrusion[i+4], extrusion[i+5],
    ])
  }

  quads.stride = 3
  return quads
}

/**
 * Turns a strip of points into a fan of triangles, repeating the original
 * <[0], [1], [2]> point as a common vertex.
 * @param {number[]} strip A list of points (3 numbers per vertex) describing
 * @returns {Mesh} A list of triangles built from the strip.
 */
function fanClose (strip) {
  const tris = new Mesh
  for (let i = 3; i <= strip.length - 6; i += 3) {
    tris.push(...[
      strip[0],   strip[1],   strip[2],
      strip[i],   strip[i+1], strip[i+2],
      strip[i+3], strip[i+4], strip[i+5],
    ])
  }
  tris.stride = 3
  return tris
}

/**
 * Generate a mesh for a tesseract spanning (-1,-,1,-1,-1) to (1,1,1,1).
 * This version produces closed loops for the edges of each square surface.
 * @returns {Mesh} An array of numbers (4 components * 16 vertices) describing
 * the coordinates of a tesseract.
 */
function wireframeTesseract () {
  const face = plotEdges
  const tesseract = new Mesh
  //          x  y  z  w
  const a = [-1, 1, 1, 1]
  const b = [-1,-1, 1, 1]
  const c = [ 1,-1, 1, 1]
  const d = [ 1, 1, 1, 1]
  const e = [ 1, 1,-1, 1]
  const f = [ 1,-1,-1, 1]
  const g = [-1,-1,-1, 1]
  const h = [-1, 1,-1, 1]

  const l = [-1, 1, 1,-1]
  const m = [-1,-1, 1,-1]
  const n = [ 1,-1, 1,-1]
  const o = [ 1, 1, 1,-1]
  const p = [ 1, 1,-1,-1]
  const q = [ 1,-1,-1,-1]
  const r = [-1,-1,-1,-1]
  const s = [-1, 1,-1,-1]

  // w+ surface cube
  face(a,b,c,d)
  face(a,h,g,b)
  face(h,e,f,g)
  face(e,d,c,f)
  face(a,d,e,h)
  face(c,b,g,f)

  // w- surface cube
  face(l,m,n,o)
  face(s,r,m,l)
  face(s,p,q,r)
  face(o,n,q,p)
  face(s,l,o,p)
  face(m,r,q,n)
  
  // cell boundaries around y-axis
  face(a,l,m,b)
  face(d,o,n,c)
  face(e,p,q,f)
  face(h,s,r,g)

  // xz-parallel cell boundaries on y = -1
  face(b,m,n,c)
  face(g,r,m,b)
  face(f,q,r,g)
  face(c,n,q,f)

  // xz-parallel cell boundaries on y = +1
  face(a,l,o,d)
  face(h,s,l,a)
  face(e,p,s,h)
  face(d,o,p,e)

  function plotEdges (v0, v1, v2, v3) {
    tesseract.push( ...[
      v0, v1,
      v1, v2,
      v2, v3,
      v3, v0
    ].flat() )
  }

  tesseract.stride = 4
  return tesseract
}

/**
 * Produce a set of vertices for visualizing normals.
 * @param {number[]} source An array of n vertices and normals (VVVNNN)
 * @returns {Mesh} A 2n array of (VVV), for visualizing with gl.LINES
 */
function generateNormalPorcupine (source) {
  const porcupine = Mesh.from(source)
  porcupine.replace(v => [
    v[0],       v[1],       v[2],
    v[0]+v[3],  v[1]+v[4],  v[2]+v[5]
  ], 6)
  porcupine.stride = 3
  return porcupine
}

/**
 * Turn a quad into two triangles.
 * @param {number[]} q Array of 12 numbers (4 vertices x 3 components)
 * @returns number[] Array of 18 values [6 vertices x 3 components]
 */
function breakQuad (q) {
  return [
    q[0], q[1], q[2],
    q[3], q[4], q[5],
    q[6], q[7], q[8],

    q[0], q[1], q[2],
    q[6], q[7], q[8],
    q[9], q[10], q[11]
  ]
}

class Mesh extends Array {
  stride = 1

  static from (...args) {
    let rv = super.from(...args)
    if (args[0].stride) { rv.stride = args[0].stride }
    return rv
  }

  get blocks () {
    return this.length / this.stride
  }

  get byteStride () {
    return this.stride * Float32Array.BYTES_PER_ELEMENT
  }

  log (title = '') {
    console.log(`  ` + title + ` ${this.length} elements / `
      + `${this.stride} stride = `
      + `${this.blocks} blocks`)

    for (let i = 0; i < this.length; i += this.stride) {
      let output =  `${i / this.stride})`.padEnd(5)
        + '<'.padStart(5)
      for (let j = 0; j < this.stride; j++) {
        output += this[i+j].toFixed(2).padStart(7)
                  + ( j < this.stride - 1
                      ? ','
                      : '' )
      }
      output += '  >'
      console.log(output)
    }
  }

  replace (callback, stride = this.stride) {
    const result = []
    let lastReplaceLength = 0

    for (let i = 0; i < this.length; i += stride) {
      const prior = []

      for (let j = 0; j < stride; j++) {
        prior.push(this[i + j])
      }

      const replacement = callback(prior)
      result.push(...replacement)

      lastReplaceLength = replacement.length
    }

    this.stride = lastReplaceLength
    this.length = 0
    this.push(...result)
    return this
  }

  interleave (callback, stride = this.stride) {
    const result = []
    let lastInsertLength = 0

    for (let i = 0; i < this.length; i += stride) {
      const prior = []

      for (let j = 0; j < stride; j++) {
        prior.push(this[i + j])
      }

      const insert = callback(prior)
      result.push(...prior, ...insert)

      lastInsertLength = insert.length
    }

    this.stride += lastInsertLength
    this.length = 0
    this.push(...result)
    return this
  }

  invertTriangles () {
    return this.replace(invertTriangle, 9)
  }

  sproutNormals () {
    return this.replace(v => { // Compute and interleave normals
      const n = triangleNormal3(v)
      return [
        v[0], v[1], v[2], ...n,
        v[3], v[4], v[5], ...n,
        v[6], v[7], v[8], ...n,
      ]
    }, 9)
  }
}

function initListeners () {
  window.addEventListener('resize', event => {
    const c = state.animation1.context
    c.canvas.width = c.canvas.clientWidth
    c.canvas.height = c.canvas.clientHeight
    c.viewport(0, 0, c.canvas.width, c.canvas.height)
    state.animation1.animator()
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
      log('change i=', i)
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
