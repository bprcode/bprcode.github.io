'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

import { shaders } from './fractal-shaders.js'
import { AnimationController, createRenderer }
  from './gl-animations.js'

const log = console.log.bind(console)

export class FractalController extends AnimationController {
  onZoom = null

  set zoomLinear (z) {
    this._zoomLinear = z
    this.zoomFactor = 8 ** z
    if (this.onZoom) { this.onZoom() }
  }

  get zoomLinear () {
    return this._zoomLinear
  }

  acquire (canvas) {
    const context = canvas.getContext(
      'webgl2', { alpha: false, premultipliedAlpha: true, antialias: false })

    if (!context) { throw Error('Unable to acquire WebGL2 rendering context')}

    this.context = context
    this.width = canvas.scrollWidth
    this.height = canvas.scrollHeight
    log('Initial fractal controller dimensions set to: ',
      this.width, this.height)

    this.render = createRenderer(
      this.context,
      { animationController: this },
      [
        {
          vertexShader: shaders.passthrough2dVert,
          fragmentShader: shaders.singleDoubleMandelbrot,
          init: initFlat,
          draw: drawFlat,
          mesh: [
            -1, -1,
            1, -1,
            1,  1,
            -1,  1,
          ],
          components: 2
        }
      ]
    )
  }
}

function initFlat () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl

  this.uCanvasReciprocal =
    gl.getUniformLocation(this.program, 'canvasReciprocal')
  this.uOffsetX = gl.getUniformLocation(this.program, 'offsetX')
  this.uOffsetY = gl.getUniformLocation(this.program, 'offsetY')
  this.uZoom = gl.getUniformLocation(this.program, 'zoom')
  this.uViewportResolution =
    gl.getUniformLocation(this.program, 'viewportResolution')
  this.uZoomedReciprocal =
    gl.getUniformLocation(this.program, 'zoomedReciprocal')
  this.uOne = gl.getUniformLocation(this.program, 'one')
  this.uOneA = gl.getUniformLocation(this.program, 'oneA')
  this.uOneB = gl.getUniformLocation(this.program, 'oneB')
  this.uOneC = gl.getUniformLocation(this.program, 'oneC')
  this.uOneD = gl.getUniformLocation(this.program, 'oneD')
  this.uOverOne = gl.getUniformLocation(this.program, 'overOne')
  this.uUnderOne = gl.getUniformLocation(this.program, 'underOne')
  this.uOsc = gl.getUniformLocation(this.program, 'osc')
  this.uUseDoublePrecision =
    gl.getUniformLocation(this.program, 'useDoublePrecision')
  this.uIterations = gl.getUniformLocation(this.program, 'iterations')
  this.uAB = gl.getUniformLocation(this.program, 'AB')

  gl.uniform1f(this.uOne, 1) // Used to block unwanted shader optimization
  gl.uniform1f(this.uOneA, 1)
  gl.uniform1f(this.uOneB, 1)
  gl.uniform1f(this.uOneC, 1)
  gl.uniform1f(this.uOneD, 1)
  gl.uniform1f(this.uOverOne, 1.0000001)
  gl.uniform1f(this.uUnderOne, 0.9999999)
  gl.uniform1f(this.uIterations, 20)
}

function drawFlat () {
  /** @type {WebGLRenderingContext} */
  const gl = this.gl
  const controller = this.shared.animationController

  const offX = splitv(controller.offset[0], 32)
  const offY = splitv(controller.offset[1], 32)

  if (controller.width === 0 || controller.height === 0) {
    return
  }

  if (!controller.width) {
    throw Error('Dimensions not specified for animation.')
  }

  gl.viewport(0, 0,
    controller.width,
    controller.height)
  gl.uniform2f(this.uViewportResolution,
    controller.width,
    controller.height)
  gl.uniform2fv(this.uOffsetX, offX)
  gl.uniform2fv(this.uOffsetY, offY)
  gl.uniform2fv(this.uZoom, splitv(controller.zoomFactor, 32))
  gl.uniform1f(this.uOsc, (this.dt / 2000) % 3)

  gl.uniform1f(this.uIterations, controller.iterations)
  if (controller.AB) {
    gl.uniform1i(this.uAB, true)
    log('setting uAB true')
    
  } else {
    gl.uniform1i(this.uAB, false)
    log('setting uAB false')
  }

  gl.uniform1i(this.uUseDoublePrecision,
    controller.precision === 'double'
    ? true
    : false
  )

  const splitZoomedReciprocal =
    splitv((controller.zoomFactor)
      * (1 / Math.max(
        controller.width,
        controller.height)),
        32)

  gl.uniform2fv(this.uZoomedReciprocal,
    splitZoomedReciprocal)

  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}

// Float-float operations adapted from:
// Guillaume da Graçca, David Defour. Implementation of float-float operators
// on graphics hardware. Real Numbers and Computers 7, Jul 2006, Nancy, France.
// pp.23-32. ￿hal-00021443￿
function split (double, s) {
  const c = (2**s + 1) * double
  const big = c - double // Carries error from addition and subtraction
  const hi = c - big // Roughly the top 7 significant figures of the double
  const lo = double - hi
  return { hi, lo }
}

function splitv (double, s) {
  const result = split(double, s)
  return [result.hi, result.lo]
}
