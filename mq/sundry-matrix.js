'use strict';

function scaleMatrix (sx, sy, sz) {
  if (typeof sz === 'undefined')
    sz = sx
  if (typeof sy === 'undefined')
    sy = sx

  return [
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1,
  ]
}

/**
 * translateMatrix, generates 16-element column-major matrix
 * @param {Number} x 
 * @param {Number} y 
 * @param {Number} z 
 * @returns 4x4 translation matrix
 */
function translateMatrix (x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]
}

/**
 * Compute a 4x4 * 4x1 matrix product (column-major), assign result.
 * @param {Number[]} result array to receive result
 * @param {Number[]} A 16-element column-major premultiplier matrix
 * @param {Number[]} v operand vector
 */
function mult4vec (result, A, v) {
  if (result === v) {
    v = [...v]
  }
  
  result[0] = A[0]*v[0] + A[4]*v[1] + A[8]*v[2] + A[12]*v[3]
  result[1] = A[1]*v[0] + A[5]*v[1] + A[9]*v[2] + A[13]*v[3]
  result[2] = A[2]*v[0] + A[6]*v[1] + A[10]*v[2] + A[14]*v[3]
  result[3] = A[3]*v[0] + A[7]*v[1] + A[11]*v[2] + A[15]*v[3]
}

/**
 * Compute a 4x4 matrix column-major product, assign result.
 * @param {Number[]} result the array to write into
 * @param {Number[]} A premultiplying matrix
 * @param {Number[]} B operand matrix
 * @returns {Number[]} reference to first argument
 */
function mult4 (result, A, B) {

  if (result === B) {
    B = [...B]
  }
  if (result === A) {
    A = [...A]
  }

  for (let i = 0; i < 4; i++) {

    result[i] =       A[i]    * B[0]
                      +A[4+i] * B[1]
                      +A[8+i] * B[2]
                      +A[12+i]* B[3]
    result[4+i] =     A[i]    * B[4]
                      +A[4+i] * B[5]
                      +A[8+i] * B[6]
                      +A[12+i]* B[7]
    result[8+i] =     A[i]    * B[8]
                      +A[4+i] * B[9]
                      +A[8+i] * B[10]
                      +A[12+i]* B[11]
    result[12+i] =    A[i]    * B[12]
                      +A[4+i] * B[13]
                      +A[8+i] * B[14]
                      +A[12+i]* B[15]
  }

  return result;
}

/**
 * Compute a 3x3 column-major matrix product, assign result.
 * @param {Number[]} result The matrix which will recevie the product
 * @param {Number[]} A The premultiplying matrix
 * @param {Number[]} B The postmultiplying matrix
 */
function mult3 (result, A, B) {
  if (result === A) {
    A = [...A]
  }
  if (result === B) {
    B = [...B]
  }

  result[0] = A[0]*B[0] + A[3]*B[1] + A[6]*B[2]
  result[1] = A[1]*B[0] + A[4]*B[1] + A[7]*B[2]
  result[2] = A[2]*B[0] + A[5]*B[1] + A[8]*B[2]

  result[3] = A[0]*B[3] + A[3]*B[4] + A[6]*B[5]
  result[4] = A[1]*B[3] + A[4]*B[4] + A[7]*B[5]
  result[5] = A[2]*B[3] + A[5]*B[4] + A[8]*B[5]

  result[6] = A[0]*B[6] + A[3]*B[7] + A[6]*B[8]
  result[7] = A[1]*B[6] + A[4]*B[7] + A[7]*B[8]
  result[8] = A[2]*B[6] + A[5]*B[7] + A[8]*B[8]
}

/**
 * Multiply a vector by a column-major 3x3 matrix.
 * @param {Number[]} result The 3-component array to receive the result.
 * @param {*} M The 3x3 premultiplying matrix (column-major).
 * @param {*} v The vector to act upon.
 */
function mult3vec (result, M, v) {
  if (result === v) {
    v = [...v]
  }

  result[0] = M[0]*v[0] + M[3]*v[1] + M[6]*v[2]
  result[1] = M[1]*v[0] + M[4]*v[1] + M[7]*v[2]
  result[2] = M[2]*v[0] + M[5]*v[1] + M[8]*v[2]
}

// Write a 4x4 column-major identity matrix into array M
function ident (M) {
  M[0] = 1
  M[1] = 0
  M[2] = 0
  M[3] = 0
  
  M[4] = 0
  M[5] = 1
  M[6] = 0
  M[7] = 0
  
  M[8] = 0
  M[9] = 0
  M[10] = 1
  M[11] = 0
  
  M[12] = 0
  M[13] = 0
  M[14] = 0
  M[15] = 1
}

function crossProduct (u, v) {
  return [
    u[1]*v[2] - u[2]*v[1],
    u[2]*v[0] - u[0]*v[2],
    u[0]*v[1] - u[1]*v[0]
  ]
}

/**
 * Calculate the normal to a triangle.
 * @param {Number[]} tri The source triangle (9-element array, 3x3 components)
 * @returns The unit normal [x, y, z] to the triangle.
 */
function triangleNormal3 (tri) {
  const BminusA = [tri[3]-tri[0], tri[4]-tri[1], tri[5]-tri[2]]
  const CminusA = [tri[6]-tri[0], tri[7]-tri[1], tri[8]-tri[2]]
  const det = [
     BminusA[1]*CminusA[2] - BminusA[2]*CminusA[1],
    -BminusA[0]*CminusA[2] + BminusA[2]*CminusA[0],
     BminusA[0]*CminusA[1] - BminusA[1]*CminusA[0]
  ]
  const magnitude = Math.sqrt(det[0]*det[0] + det[1]*det[1] + det[2]*det[2])
  det[0] /= magnitude
  det[1] /= magnitude
  det[2] /= magnitude

  return det
}

// Compute a matrix product for two 4x4 matrices
// interpreted as column-major arrays
function product4x4 (A, B) {
  let result = Array(16).fill(0)

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let n = 0; n < 4; n++) {
        // result i,j += A i,n * B n,j
        result[ 4*j+i ] += A[ 4*n+i ] * B[ 4*j+n ]
      }

    }
  }

  return result;
}

function rotateYZ (theta) {
  return [
    1,  0,                0,               0,
    0,  Math.cos(theta),  Math.sin(theta), 0,
    0,  -Math.sin(theta), Math.cos(theta), 0,
    0,  0,                0,               1,
  ]
}

function rotateXZ (theta) {
  return [
    Math.cos(theta), 0, -Math.sin(theta), 0,
    0,               1, 0,                0,
    Math.sin(theta), 0, Math.cos(theta),  0,
    0,               0, 0,                1,
  ]
}

function rotateXY (theta) {
  return [
    Math.cos(theta),  Math.sin(theta), 0, 0,
    -Math.sin(theta), Math.cos(theta), 0, 0,
    0,                0,               1, 0,
    0,                0,               0, 1,
  ]
}

// debug -- choice of sign ambiguous?
function rotateXW (theta) {
  return [
    Math.cos(theta),  0, 0, Math.sin(theta),
    0,                1, 0, 0,
    0,                0, 1, 0,
    -Math.sin(theta), 0, 0, Math.cos(theta),
  ]
}

function rotateYW (theta) {
  return [
    1, 0,                 0, 0,
    0, Math.cos(theta),   0, Math.sin(theta),
    0, 0,                 1, 0,
    0, -Math.sin(theta),  0, Math.cos(theta),
  ]
}

function rotateZW (theta) {
  return [
    1, 0, 0,                0,
    0, 1, 0,                0,
    0, 0, Math.cos(theta),  Math.sin(theta),
    0, 0, -Math.sin(theta), Math.cos(theta),
  ]
}

function identityMatrix (n = 4) {
  const result = Array(n**2).fill(0)
  for(let i = 0; i < n; i++)
    result[ i*n + i ] = 1

  return result
}

/**
 * Generate a linear projection frustum matrix
 * @param {} dimensions should specify { near, far, left, right, top, bottom }
 * or { near, far, fov (in degrees), aspect }
 * @returns {Number[]} 16-element column-major projection matrix
 */
function frustum (dimensions) {
  let {near: n, far: f, left: l, right: r, top: t, bottom: b} = dimensions
  if (dimensions.fov && dimensions.aspect) {
    const halfWidth = Math.tan(dimensions.fov/2 * Math.PI/180) * n
    const halfHeight = halfWidth / dimensions.aspect
    l = -halfWidth
    r = halfWidth
    t = halfHeight
    b = -halfHeight
  }

  return [
    2*n / (r - l),    0,            0,              0,
    0,                2*n/(t-b),    0,              0,
    (r+l)/(r-l),      (t+b)/(t-b),  (n+f)/(n-f),    -1,
    0,                0,            2*n*f/(n-f),     0
  ]
}

/**
 * @param {Number[]} M The matrix to act upon (3x3, column-major)
 * @returns The determinant of the matrix.
 */
function det3x3 (M) {
  return M[0]* (M[4]*M[8] - M[5]*M[7])
        -M[3]* (M[1]*M[8] - M[2]*M[7])
        +M[6]* (M[1]*M[5] - M[2]*M[4])
}

function inverse3x3 (M) {
  const result = []
  const det = det3x3(M)
  if (Math.abs(det - 0) < 0.000001) {
    return null
  }

  result[0] = (M[4]*M[8] - M[5]*M[7]) / det
  result[1] = (M[2]*M[7] - M[1]*M[8]) / det
  result[2] = (M[1]*M[5] - M[2]*M[4]) / det

  result[3] = (M[5]*M[6] - M[3]*M[8]) / det
  result[4] = (M[0]*M[8] - M[2]*M[6]) / det
  result[5] = (M[2]*M[3] - M[0]*M[5]) / det

  result[6] = (M[3]*M[7] - M[4]*M[6]) / det
  result[7] = (M[1]*M[6] - M[0]*M[7]) / det
  result[8] = (M[0]*M[4] - M[1]*M[3]) / det

  return result
}

/**
 * Yields the quaternion product qp as an [x, y, z, w] vector.
 * @param {*} q 
 * @param {*} p 
 * @returns {Number[]} The [x, y, z, w] product.
 */
function quatProduct (q, p) {
  return [
    // Using the [x, y, z, w] convention
    q[3]*p[0] + q[0]*p[3] + q[1]*p[2] - q[2]*p[1],
    q[3]*p[1] - q[0]*p[2] + q[1]*p[3] + q[2]*p[0],
    q[3]*p[2] + q[0]*p[1] - q[1]*p[0] + q[2]*p[3],
    q[3]*p[3] - q[0]*p[0] - q[1]*p[1] - q[2]*p[2]
  ]
}

function quatConjugate (q) {
  return [-q[0], -q[1], -q[2], q[3]]
}

class Quaternion extends Array {
  static product (q, p) { return quatProduct(q,p) }

  constructor () {
    super()
    this[0] = 0
    this[1] = 0
    this[2] = 0
    this[3] = 1
  }

  log (label) {
    const vcol = 'color:#fd0'
    const kcol = 'color:#0a8'
    console.log(`${String(label || '').padEnd(10)}`
      + `%c${fix(this[0])}%ci + `
      + `%c${fix(this[1])}%cj + `
      + `%c${fix(this[2])}%ck + `
      + `%c${fix(this[3])}`,
      vcol, kcol,
      vcol, kcol,
      vcol, kcol,
      vcol
    )
  
    function fix (v) {
      return String(v.toFixed(2))
        .replace('0.00', '0')
        .replace('0.', '.')
        .replace('1.00', '1').padStart(3)
    }
  }

  conjugate () {
    this[0] = -this[0]
    this[1] = -this[1]
    this[2] = -this[2]

    return this
  }

  premultiply (q) {
    const x = this[0]
    const y = this[1]
    const z = this[2]
    const w = this[3]

    this[0] = q[3]*x + q[0]*w + q[1]*z - q[2]*y
    this[1] = q[3]*y - q[0]*z + q[1]*w + q[2]*x
    this[2] = q[3]*z + q[0]*y - q[1]*x + q[2]*w
    this[3] = q[3]*w - q[0]*x - q[1]*y - q[2]*z

    return this
  }

  postmultiply (p) {
    const x = this[0]
    const y = this[1]
    const z = this[2]
    const w = this[3]
    
    this[0] = w*p[0] + x*p[3] + y*p[2] - z*p[1]
    this[1] = w*p[1] - x*p[2] + y*p[3] + z*p[0]
    this[2] = w*p[2] + x*p[1] - y*p[0] + z*p[3]
    this[3] = w*p[3] - x*p[0] - y*p[1] - z*p[2]

    return this
  }

  normalize () {
    const magnitude = Math.sqrt(
        this[0] * this[0]
      + this[1] * this[1]
      + this[2] * this[2]
      + this[3] * this[3]
    )

    if (magnitude === 0) { return this }
    this[0] /= magnitude
    this[1] /= magnitude
    this[2] /= magnitude
    this[3] /= magnitude

    return this
  }
}
