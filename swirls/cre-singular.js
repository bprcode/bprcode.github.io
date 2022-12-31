const { mat4, vec3 } = glMatrix
const π = Math.PI;
const log = console.log.bind(console)
console.clear()

const canvas = document.getElementById('main-canvas')
const gl = canvas.getContext('webgl2')
// const gl2 = document.getElementById('second-canvas').getContext('webgl2')
const state = {
  dx: 0,
  dy: 0,
  theta: 0,
  phi: 0
}
const mainCanvasRect =
    document.getElementById('main-canvas')
    .getBoundingClientRect()

// document.getElementById('legend').textContent =
//   gl.getParameter(gl.VERSION)
//   + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)

function glMain (gl, props = {}) {

  let projM, shiftM, workingM

  if (props.ownMath || props.gpuProduct) {
    projM = frustum({
      near: 1, far: 100,
      left: -0.75, right: 0.75,
      top: 0.75, bottom: -0.75
    })
    shiftM = identityMatrix(4)
    workingM = identityMatrix(4)

  } else {
    projM = mat4.create()
    mat4.perspective(projM, 2 * Math.atan(3 / 4), 1, 1, 100)
    shiftM = mat4.create()
    workingM = mat4.create()
  }
  
  // Build the shader program
  const vs = compileShader(gl,
    props.gpuProduct  // Use the GPU to test the matrix product?
      ? testProductShader
      : projectingVertexShader
      , gl.VERTEX_SHADER)
  const fs = compileShader(gl, basicFragmentShader, gl.FRAGMENT_SHADER)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  linkProgram(gl, program)

  // Load the vertex (and color?) buffer
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorCube), gl.STATIC_DRAW)

  // Acquire the attribute and uniform locations
  const position = gl.getAttribLocation(program, 'position')
  const projection = gl.getUniformLocation(program, 'projectionView')
  const color = gl.getAttribLocation(program, 'color')

  if (props.gpuProduct) {
    props.P = gl.getUniformLocation(program, 'P')
    props.T = gl.getUniformLocation(program, 'T')
    props.R = gl.getUniformLocation(program, 'R')
    props.S = gl.getUniformLocation(program, 'S')
  }

  // Set up vertex data
  gl.enableVertexAttribArray(position)
  gl.enableVertexAttribArray(color)
  const stride = 6 * Float32Array.BYTES_PER_ELEMENT
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0)
  gl.vertexAttribPointer(color, 3, gl.FLOAT, false, stride,
                          3 * Float32Array.BYTES_PER_ELEMENT)

  // Enable the shader program
  gl.enable(gl.CULL_FACE)
  gl.useProgram(program)
  const clearColor = props.clearColor || [0,0,0.3,1]
  gl.clearColor(...clearColor)

  function drawFrame (t) {
    drawFrame.t0 ??= t
    const dt = t - drawFrame.t0

    gl.clear(gl.COLOR_BUFFER_BIT)

    if (props.gpuProduct) {

      gl.uniformMatrix4fv(props.P, false, frustum({
                                            near: 1, far: 100,
                                            left: -0.75, right: 0.75,
                                            top: 0.75, bottom: -0.75
                                          }))
      gl.uniformMatrix4fv(props.T, false, translateMatrix(0, 0, -5))
      gl.uniformMatrix4fv(props.R, false, rotateYMatrix(π/4 + dt / 1000))
      gl.uniformMatrix4fv(props.S, false, scaleMatrix(0.5))

    } else if (props.ownMath) {

      shiftM = identityMatrix(4)
        // IS THIS ACTUALLY THE RIGHT ORDER?
        // Have I "fixed" the wrong problem?
        // Shouldn't TRANSLATE then ROTATE be the one that orbits?
      //shiftM = product4x4(shiftM, translateMatrix(0, 0, -5))
      //shiftM = product4x4(shiftM, rotateYMatrix(π/4 + dt / 1000))
      //shiftM = product4x4(shiftM, rotateXMatrix(dt / 1700))

      // Alternative -- makes more sense?
      // shiftM = product4x4(rotateYMatrix(π/4 + dt / 1000), shiftM)
      shiftM = product4x4(scaleMatrix(0.5), shiftM)
      shiftM = product4x4(rotateYMatrix(π/4 + dt / 1000), shiftM)
      shiftM = product4x4(translateMatrix(0, 0, -5), shiftM)

      //shiftM = product4x4(rotateXMatrix(dt / 1700), shiftM)
      //shiftM = product4x4(rotateYMatrix(π/4 + dt / 1000), shiftM)
      //shiftM = product4x4(translateMatrix(0, 0, -5), shiftM)

      workingM = product4x4(projM, shiftM)

      gl.uniformMatrix4fv(projection, false, workingM)

    } else {
      const id = []
      const T = []
      const Ry = []
      const S = []
      const X = []
      mat4.identity(id)
      mat4.rotateY(Ry, id, π/4 + dt / 1000)
      mat4.scale(S, id, [0.5,0.5,0.5])
      mat4.translate(T, id, [0, 0, -5])
      // this is forwards???
      // mat4.mul(X, S, Ry)
      // mat4.mul(X, T, X)
      // mat4.mul(workingM, projM, X)

      // Reverse order convention --
      // Are you doing P S T or T S P ?
      // I was thinking "find the product at each step,
      // then premultiply," (hence list transformations
      // from right to left), but glMatrix is thinking,
      // "write the transformations from left to right"
      mat4.identity(workingM)
      mat4.mul(workingM, workingM, projM)
      mat4.translate(workingM, workingM, [0, 0, -5])
      mat4.rotateY(workingM, workingM, π/4 + dt / 1000)
      mat4.scale(workingM, workingM, [0.5, 0.5, 0.5])
      show(workingM, 'after projection * rotateY * scale * translate')

      gl.uniformMatrix4fv(projection, false, workingM)
    }

    // gl.uniformMatrix4fv(projection, false, projM)
    // gl.uniformMatrix4fv(view, false, shiftM)
    // gl.drawArrays(gl.LINE_STRIP, 0, 10)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, colorCube.length / 6)

    requestAnimationFrame(drawFrame)
  }

  requestAnimationFrame(drawFrame)
}

function honeycomb (gl, props = {}) {
  // Compile and link the shaders
  const vs = compileShader(gl, followVert, gl.VERTEX_SHADER)
  const fs = compileShader(gl, followFrag, gl.FRAGMENT_SHADER)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  linkProgram(gl, program)

  // Load the attribute buffer
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hexagon), gl.STATIC_DRAW)

  // Acquire the positions of shader variables
  const pos = gl.getAttribLocation(program, 'pos')
  const col = gl.getAttribLocation(program, 'col')
  const time = gl.getUniformLocation(program, 'time')
  const mouse = gl.getUniformLocation(program, 'mouse')
  const T = gl.getUniformLocation(program, 'T')

  // Introduce vertex data
  gl.enableVertexAttribArray(pos)
  // gl.enableVertexAttribArray(col)
  const stride = 2 * Float32Array.BYTES_PER_ELEMENT
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0)

  // Set the current program
  let M = identityMatrix()

  if (props.ab === 'A') {
    mult4(M, rotateZMatrix(π / 4), M)
    mult4(M, scaleMatrix(0.5), M)
    mult4(M, translateMatrix(0.3,0.1,0), M)
  } else {
    M = product4x4(rotateZMatrix(π / 4), M)
    M = product4x4(scaleMatrix(0.5), M)
    M = product4x4(translateMatrix(0.3,0.1,0), M)
  }

  gl.enable(gl.CULL_FACE)
  gl.useProgram(program)
  const clearColor = props.clearColor || [0.1, 0.1, 0.1, 1]
  gl.clearColor(...clearColor)

  function drawFrame(t) {
    drawFrame.t0 ??= t
    const dt = t - drawFrame.t0

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(time, dt)
    gl.uniform2fv(mouse, [state.nx, state.ny])

    // Draw a hex
    ident(M)
    mult4(M, rotateZMatrix(t/2000 * π / 4), M)
    mult4(M, scaleMatrix(0.35), M)
    mult4(M, translateMatrix(0.35, 0.2, 0), M)

    gl.uniformMatrix4fv(T, false, M)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, hexagon.length / 2)
    // Draw a hex
    ident(M)
    mult4(M, rotateZMatrix(-t/2000 * π / 4), M)

    mult4(M, scaleMatrix(0.25), M)
    mult4(M, translateMatrix(-0.35, -0.2, 0), M)

    gl.uniformMatrix4fv(T, false, M)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, hexagon.length / 2)

    requestAnimationFrame(drawFrame)
  }
  
  requestAnimationFrame(drawFrame)
}

function flatPlane (gl, props = {}) {
  // Compile and link the shaders
  const vs = compileShader(gl, followVert, gl.VERTEX_SHADER)
  const fs = compileShader(gl, mandalaFrag1, gl.FRAGMENT_SHADER)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  linkProgram(gl, program)

  // Load the attribute buffer
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(square2d), gl.STATIC_DRAW)

  // Acquire the positions of shader variables
  const pos = gl.getAttribLocation(program, 'pos')
  const time = gl.getUniformLocation(program, 'time')
  const mouse = gl.getUniformLocation(program, 'mouse')

  // Introduce vertex data
  gl.enableVertexAttribArray(pos)
  const stride = 2 * Float32Array.BYTES_PER_ELEMENT
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0)

  gl.enable(gl.CULL_FACE)
  gl.useProgram(program)
  const clearColor = props.clearColor || [0.1, 0.1, 0.1, 1]
  gl.clearColor(...clearColor)

  function drawFrame(t) {
    drawFrame.t0 ??= t
    const dt = t - drawFrame.t0

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(time, dt)
    gl.uniform2fv(mouse, [state.nx, state.ny])

    gl.drawArrays(gl.TRIANGLE_FAN, 0, square2d.length / 2)

    requestAnimationFrame(drawFrame)
  }
  
  requestAnimationFrame(drawFrame)
}

function compileShader (context, source, type) {
  const shader = context.createShader(type)
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS))
    throw new Error(context.getShaderInfoLog(shader))
  return shader
}

function linkProgram (context, program) {
  context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS))
    throw new Error(context.getProgramInfoLog(program))
}

// Mandala fragment shader
const mandalaFrag1 =
/* glsl */`
precision highp float;
#define pi 3.1415926538
#define tau 6.2831853076

uniform float time;
uniform vec2 mouse;

float fuzzyEquals(float a, float b) {
  return pow( 1.0 - clamp(abs(a - b), 0.0, 1.0), 20.0);
}

float f(vec2 p) {
  vec2 v = (p - vec2(0.5, 0.5) ) / 0.35;
  float r = distance(v, vec2(0.0, 0.0));
  float theta = atan(v.y, v.x);
  float osc = sin(time / 4000.0);
  const float range = 18.0;

  float sum = 0.0;

  for (float i = -range; i <= range; i += 2.0) {
    float blur = 1.0 - pow(i / range, 2.0);

    sum += blur * fuzzyEquals(
      r, cos(
        (0.7 + osc * 0.3)
        * (theta + i * tau) )
      );
  }

  return sum;
}

float g(vec2 p) {
  float r = distance(p, vec2(0.5, 0.5));
  float theta = atan(p.y, p.x);

  return r - sin(pow(time * theta, 2.0));
}

float theta(vec2 p) {
  return atan(p.y, p.x);
}

void main(void) {
  const float size = 400.0;
  vec2 nPos = gl_FragCoord.xy / size;

  float a = f(nPos);
  float b = g(nPos);

  gl_FragColor = vec4(
          a * vec3(0.0, 0.2, 1.0),
          1.0);
}
`

// Follow-along vertex shader (just passthrough)
const followVert =
/* glsl */`//#version 300 es
precision highp float;

attribute vec4 pos;

void main(void) {
  gl_Position = pos;
}
`

// Follow-along fragment shader
const followFrag =
/* glsl */`//#version 300 es
precision highp float;

uniform float time;
uniform vec2 mouse;

float f(vec2 v) {
  return smoothstep(0.02, 0.0, abs(v.y*v.y - v.x));
}

void main(void) {
  const float size = 400.0;
  vec2 nPos = gl_FragCoord.xy / size;
  float t = nPos.x;

  // Function plot
  float fv = f(nPos);

  gl_FragColor = vec4(nPos.x, 0.0, nPos.y, 1.0)
                  + fv * vec4(0.0, 1.0, 0.0, 1.0);
}`

const flatFrag =
/* glsl */`#version 300 es
precision highp float;

uniform float time;
in vec4 newPos;
in vec4 center;
in float t;
in float size;
out vec4 finalColor;

void main(void) {

  float k = 6.28;
  float d = distance(center, newPos) / size;
  float dp = pow(distance(center, newPos) / (size * 0.8), 2.5);
  float angle = k * dp + time / 500.0;
  vec2 dv = vec2(newPos.x - center.x, newPos.y - center.y) / size;
  mat2 R = mat2(cos(angle), sin(angle),
                -sin(angle), cos(angle));
  vec2 colorVec = R * vec2(dv);

  vec4 spinColor = vec4( (colorVec.x + 1.0) / 2.0,
                    0,
                    (colorVec.y + 1.0) / 2.0,
                    1.0);
  finalColor = vec4(spinColor.x / (0.5+dp), spinColor.y + dp * 0.2, spinColor.z + dp * 1.0, 1.0);
  // finalColor = spinColor
                // + dp * vec4(0, 0.0, 1.0, 1.0);
}`

/*
u = Mv
M =
u = R(t * d) * v
*/
// Crunch a series of vec3's, applying a uniform projection
const projectingVertexShader =
/* glsl */`#version 300 es
precision highp float;

uniform mat4 projectionView;
in vec3 position;
in vec3 color;
out vec3 fragColor;

void main(void) {
  fragColor = color;
  gl_Position = projectionView * vec4(position, 1.0);
}
`

const vertexShader2d =
/* glsl */`#version 300 es
precision highp float;

uniform mat4 T;
uniform float time;

in vec2 pos;
out vec4 newPos;
out float t;
out float size;
out vec4 center;

void main(void) {
  center = T * vec4(0, 0, 0, 1.0);
  size = distance(T * vec4(1.0, 0, 0, 1.0), center);
  
  newPos = T * vec4(pos, 0, 1.0);
  t = (newPos.x + 1.0) / 2.0;
  gl_Position = vec4(newPos);
}`

const testProductShader =
/* glsl */`#version 300 es
precision highp float;

uniform mat4 P;
uniform mat4 T;
uniform mat4 R;
uniform mat4 S;

in vec3 position;
in vec3 color;
out vec3 fragColor;

void main(void) {
  fragColor = color;
  fragColor.r *= 0.5;
  gl_Position = P * T * R * S * vec4(position, 1.0);
}
`

const basicFragmentShader = 
/* glsl */`#version 300 es
precision highp float;

in vec3 fragColor;
out vec4 resultColor;

void main(void){
  resultColor = vec4(fragColor, 1.0);
}
`

// Just return a flat color for every vertex
const monochromeFragmentShader =
/* glsl */`#version 300 es
precision highp float;

out vec4 resultColor;

void main(void){
  resultColor = vec4(0.7, 0.2, 0.1, 1.0);
}
`

const hexagon = [
  -1, 0,
  -0.5, -0.8660254,
  0.5, -0.8660254,
  1, 0,
  0.5, 0.8660254,
  -0.5, 0.8660254,
]

const square2d = [
  -1, -1,
  1,  -1,
  1,  1,
  -1, 1,
]

const mugHolder = [
  -1, 1, 1,
  1, 1, 1,
  1, 1, -1,
  -1, 1, -1,
  -1, 1, 1,

  -1, -1, 1,
  1, -1, 1,
  1, -1, -1,
  -1, -1, -1,
  -1, -1, 1,
]

const colorCube = [
  -1,   -1,    1,    1.0,    0.0,    0.0,  // 0
  1,    -1,    1,    0.8,    0.2,    0.0,  // 1
  -1,    1,    1,    0.6,    0.4,    0.0,  // 2
  1,     1,    1,    0.4,    0.6,    0.0,   // 3

  1,     1,   -1,    0.2,    0.8,    0.0,  // 4
  1,    -1,    1,    0.0,    1.0,    0.0,  // 5
  1,    -1,   -1,    1.0,    0.8,    0.2,  // 6
  -1,   -1,   -1,    1.0,    0.6,    0.4,   // 3

  1,   1,    -1,     1.0,    0.4,    0.6,  // 8
  -1,    1,    -1,   1.0,    0.2,    0.8,  // 9
  -1,    1,    1,    1.0,    0.0,    1.0,  // 10
  -1,    -1,    -1,  1.0,    0.0,    0.8,   // 11

  -1,   -1,    1,    1.0,    0.0,    0.6,  // 12
  1,    -1,    1,    1.0,    0.0,    0.4,  // 13
]

document.getElementById('main-canvas')
  .addEventListener('mousedown', event => {
  state.lastX = event.clientX
  state.lastY = event.clientY
  state.mousedown = true;
})
document.getElementById('main-canvas')
  .addEventListener('mouseleave', event => {
    state.mousedown = false;
})
document.getElementById('main-canvas')
  .addEventListener('mouseup', event => {
  state.mousedown = false;
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

function translateMatrix (x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]
}

// Compute a 4x4 matrix product, assign result
function mult4 (result, A, B) {
  let Bcopy
  let Acopy

  if (result === B) {
    Bcopy = new Array(16)
    for (let n = 0; n < 16; n++) { Bcopy[n] = B[n] }
    B = Bcopy
  }
  if (result === A) {
    Acopy = new Array(16)
    for (let n = 0; n < 16; n++) { Acopy[n] = A[n] }
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

function naiveProduct (A, B) {
  let result = Array(16).fill(0)

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let n = 0; n < 4; n++) {
        // result i,j += A i,n * B n,j
        result[ 4*i+j ] += A[ 4*i+n ] * B[ 4*n+j ]
      }

    }
  }

  return result;
}

function rotateXMatrix (theta) {
  return [
    1,  0,  0,  0,
    0,  Math.cos(theta),  Math.sin(theta),  0,
    0,  -Math.sin(theta),  Math.cos(theta),  0,
    0,  0,  0,  1,
  ]
}

function rotateYMatrix (theta) {
  return [
    Math.cos(theta), 0, -Math.sin(theta), 0,
    0, 1,  0, 0,
    Math.sin(theta), 0, Math.cos(theta), 0,
    0, 0, 0, 1,
  ]
}

function rotateZMatrix (theta) {
  return [
    Math.cos(theta), Math.sin(theta), 0, 0,
    -Math.sin(theta), Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]
}


function identityMatrix (n = 4) {
  const result = Array(n**2).fill(0)
  for(let i = 0; i < n; i++)
    result[ i*n + i ] = 1

  return result
}

function frustum (dimensions) {
  const {near: n, far: f, left: l, right: r, top: t, bottom: b} = dimensions
  return [
    2*n / (r - l),    0,            0,              0,
    0,                2*n/(t-b),    0,              0,
    (r+l)/(r-l),      (t+b)/(t-b),  (n+f)/(n-f),    -1,
    0,                0,            2*n*f/(n-f),     0
  ]
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

//glMain(gl, { clearColor: [0.2, 0, 0.5, 1], gpuProduct: true })
//glMain(gl2, { clearColor: [0.3, 0, 0, 1], ownMath: true })
// honeycomb(gl, { clearColor: [0.1, 0.1, 0.25, 1], ab: 'A' })
// honeycomb(gl2)
flatPlane(gl, { clearColor: [0.51, 0.1, 0.25, 1], ab: 'A' })
// flatPlane(gl2)
