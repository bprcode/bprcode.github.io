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
 * Compute a 4x4 * 4x1 matrix product (column-major), assign result
 * @param {Number[]} result array to receive result
 * @param {Number[]} A 16-element column-major premultiplier matrix
 * @param {Number[]} v operand vector
 */
function mult4vec (result, A, v) {
  if (result === v) {
    const vCopy = [...v]
    v = vCopy
  }
  
  result[0] = A[0]*v[0] + A[4]*v[1] + A[8]*v[2] + A[12]*v[3]
  result[1] = A[1]*v[0] + A[5]*v[1] + A[9]*v[2] + A[13]*v[3]
  result[2] = A[2]*v[0] + A[6]*v[1] + A[10]*v[2] + A[14]*v[3]
  result[3] = A[3]*v[0] + A[7]*v[1] + A[11]*v[2] + A[15]*v[3]
}

/**
 * Compute a 4x4 matrix product, assign result
 * @param {Number[]} result the array to write into
 * @param {Number[]} A premultiplying matrix
 * @param {Number[]} B operand matrix
 * @returns {Number[]} reference to first argument
 */
function mult4 (result, A, B) {

  if (result === B) {
    const Bcopy = [...B]
    B = Bcopy
  }
  if (result === A) {
    const Acopy = [...A]
    A = Acopy
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
    1,  0,  0,  0,
    0,  Math.cos(theta),  Math.sin(theta),  0,
    0,  -Math.sin(theta),  Math.cos(theta),  0,
    0,  0,  0,  1,
  ]
}

function rotateXZ (theta) {
  return [
    Math.cos(theta), 0, -Math.sin(theta), 0,
    0, 1,  0, 0,
    Math.sin(theta), 0, Math.cos(theta), 0,
    0, 0, 0, 1,
  ]
}

function rotateXY (theta) {
  return [
    Math.cos(theta), Math.sin(theta), 0, 0,
    -Math.sin(theta), Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]
}

// debug -- choice of sign ambiguous?
function rotateXW (theta) {
  return [
    Math.cos(theta), 0, 0, Math.sin(theta),
    0, 1, 0, 0,
    0, 0, 1, 0,
    -Math.sin(theta), 0, 0, Math.cos(theta),
  ]
}

function rotateYW (theta) {
  return [
    1, 0, 0, 0,
    0, Math.cos(theta), 0, Math.sin(theta),
    0, 0, 1, 0,
    0, -Math.sin(theta), 0, Math.cos(theta),
  ]
}

function rotateZW (theta) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, Math.cos(theta), Math.sin(theta),
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
