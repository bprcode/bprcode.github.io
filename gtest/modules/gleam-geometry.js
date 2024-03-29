'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

/**
 * Extension of Array with methods making it easier to prepare data for WebGL.
 */
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

  /**
   * Sequentially process the contents of this array by passing them to
   * a callback function, then using the results of that function to replace
   * the original elements.
   */
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

export const geometry = {}

geometry.square2d = [
  -1, -1,
   1, -1,
   1,  1,
  -1,  1,
]

geometry.texSquare = Mesh.from(geometry.square2d)
geometry.texSquare.stride = 2
geometry.texSquare.interleave(v => [(v[0] + 1) / 2, (v[1] + 1) / 2])
geometry.texSquare.stride = 4

geometry.tesseractOutline = buildTesseract(edgeNormalFace, 8)
geometry.normalTesseract = buildTesseract(normalSquare, 8)

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
 * For each face, the provided callback will be invoked, with the vertices
 * provided as four separate arguments (each a 4D point), and access to the
 * mesh provided through the "this" reference.
 * The stride argument specifies the number of elements to read at a time
 * (4 for 4D vertex-only, 8 for 4D vertex-with-4D normal.)
 */
function buildTesseract (faceCallback, stride) {
  const tesseract = new Mesh
  const face = faceCallback.bind(tesseract)

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

  tesseract.stride = stride
  return tesseract
}

/**
 * Generates a square face of two-triangle trapezoids, with normals tilted
 * at 45 degrees,pointing through the center of each edge.
 */
function edgeNormalFace (v0, v1, v2, v3) {
  const t = 0.04
  const center = []
  const [n01, n12, n23, n30] = [[], [], [], []]

  // Find normal through each edge:
  for (let i = 0; i < 4; i++) {
    n01[i] = (v0[i] + v1[i]) / 2
    n12[i] = (v1[i] + v2[i]) / 2
    n23[i] = (v2[i] + v3[i]) / 2
    n30[i] = (v3[i] + v0[i]) / 2
  }

  // Find center of square face:
  for (let i = 0; i < 4; i++) {
    center[i] = (v0[i] + v1[i] + v2[i] + v3[i]) / 4
  }

  // Create a trapezoid for each edge, with a 45-degree-angled normal:
  for (const [a, b, n] of [
    [v0, v1, n01],
    [v1, v2, n12],
    [v2, v3, n23],
    [v3, v0, n30]
  ]) {
    const aInner = []
    const bInner = []

    for (let j = 0; j < 4; j++) {
      aInner[j] = a[j]*(1-t) + center[j]*t
    }
    for (let j = 0; j < 4; j++) {
      bInner[j] = b[j]*(1-t) + center[j]*t
    }

    this.push(...[
      a, n, b, n, aInner, n,
      aInner, n, b, n, bInner, n
    ].flat())
  }
}

/**
 * Generates a square composed of triangles,
 * with normals pointing through the center of each face.
 */
function normalSquare (v0, v1, v2, v3) {
  const n = []

  for (let i = 0; i < 4; i++) {
    n[i] = (v0[i] + v1[i] + v2[i] + v3[i]) / 4
  }

  this.push(...[
    v0, n, v1, n, v2, n,
    v0, n, v2, n, v3, n
  ].flat())
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
