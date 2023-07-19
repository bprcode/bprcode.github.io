'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

export class AnimationController {
  currentFrame = null
  keepAnimating = false
  needUpdate = false
  render = null

  constructor (options) {
    Object.assign(this, options)
  }

  play () {
    // Ignore play calls if already playing
    if (this.keepAnimating) { return }
    this.keepAnimating = true
    this.requestExclusiveFrame()
  }

  pause () {
    this.keepAnimating = false
  }

  redraw () {
    this.requestExclusiveFrame()
  }

  requestExclusiveFrame () {
    if (this.currentFrame) {
      console.log('ignoring redundant draw request ', this.currentFrame)
      return
    }

    if (!this.render) {
      throw Error('No renderer provided.')
    }

    this.currentFrame = requestAnimationFrame(this.render)
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
 * Track FPS, averaged about every second.
 * If animationController.showFPS is defined, call it periodically.
 */
function countFrame (time, controller) {
  controller.intervalStart ??= time
  controller.frameCount ??= 0

  controller.frameCount++
  const dt = time - controller.intervalStart

  if (dt > 1000) {
    controller.lastFPS = 1000 * controller.frameCount / dt
    controller.intervalStart = time
    controller.frameCount = 0
    if (controller.showFPS) { controller.showFPS() }
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

/**
 * Initialize a WebGL rendering loop with a list of rendering phases.
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl context to use.
 * @param {Object} shared An object containing state shared between phases.
 * Must include a reference to an AnimationController.
 * @param {Array} phases An array of rendering phase objects. Each specifies
 * the vertex and fragment shader to use, the mesh to upload as an attribute
 * array, and optionally an init() and draw() method.
 * @returns {Function} The frame-drawing function for RequestAnimationFrame.
 */
export function createRenderer (gl, shared, phases = []) {
  if (!phases.length) { throw new Error('No rendering phases specified.') }
  if (!shared.animationController) {
    throw new Error('animationController needed.')
  }

  polyfillExtensions(gl)

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

    // Assume most phases want an attribute for vertex positions, named 'pos'
    p.pos = gl.getAttribLocation(p.program, 'pos')

    gl.useProgram(p.program)

    gl.enableVertexAttribArray(p.pos)
    gl.vertexAttribPointer(p.pos, p.components, gl.FLOAT, false,
      p.mesh.byteStride || 0, 0)

    // Allow customized per-phase initialization
    if (p.init) { p.init() }
  }

  // Commonly shared GL state
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.DEPTH_TEST)

  // Drawing function returned by createRenderer.
  // Draws each phase.
  function drawFrame (t) {
    shared.animationController.currentFrame = null
    countFrame(t, shared.animationController)
    drawFrame.pauseTime ??= 0
    drawFrame.t0 ??= t
    if (drawFrame.pauseTime) {
      drawFrame.t0 += t - drawFrame.pauseTime
      drawFrame.pauseTime = 0
    }
    const dt = t - drawFrame.t0

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    for (const p of phases) {
      p.dt = dt

      if (p.program) {
        gl.bindVertexArray(p.vao)
        gl.useProgram(p.program)
      }

      p.draw()
    }

    if (shared.animationController.keepAnimating) {
      shared.animationController.needUpdate = true
      shared.animationController.requestExclusiveFrame()

    } else {
      drawFrame.pauseTime = t
    }
  }

  return drawFrame
}
