const shaders: { [k: string]: string } = {}
const geometry: { [k: string]: number[] } = {}
const shared = {
  gl: null as WebGLRenderingContext | null,
  tLast: 0,
  position: -1 as GLint,
  aspect: null as WebGLUniformLocation | null,
  transform: null as WebGLUniformLocation | null,
  matrix: [
    Math.cos(.785), Math.sin(.785), 0, 0,

    -Math.sin(.785), Math.cos(.785), 0, 0,

    0, 0, 1, 0,

    1, 0, 0, 1,
  ],
  elapsed: 0,
}

const foo: {
  name: 'bob' | 'fred'
} = {
  name: 'bob',
}

function init() {
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')
  if (!canvas) {
    throw Error('No bokeh canvas found')
  }

  shared.gl = canvas.getContext('webgl')
  const gl = shared.gl
  
  if (!gl) {
    throw Error('Unable to create bokeh rendering context')
  }

  function updateSize(e?: UIEvent) {
    const checker = document.getElementById('resize-check')
    if (checker) {
      checker.textContent = 'Resize ' + Math.random()
    }
    if (!canvas || !gl) {
      return
    }

    const h = Math.round(Math.min(600, canvas.clientHeight))
    const w = Math.round((h * canvas.clientWidth) / canvas.clientHeight)
    canvas.height = h
    canvas.width = w
    gl.viewport(0, 0, w, h)
    gl.uniform1f(shared.aspect, w / h)
    render()
  }

  window.addEventListener('resize', updateSize)

  const vertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.fragEx)
  const program = createProgram(gl, vertShader, fragShader)

  shared.position = gl.getAttribLocation(program, 'position')
  shared.aspect = gl.getUniformLocation(program, 'aspect')
  shared.transform = gl.getUniformLocation(program, 'transform')
  const positionBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.hexagon),
    gl.STATIC_DRAW
  )

  gl.clearColor(0, 0, 0.5, 0)

  gl.useProgram(program)

  gl.enableVertexAttribArray(shared.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(shared.position, 3, gl.FLOAT, false, 0, 0)

  updateSize()

  requestAnimationFrame(animate)
}

function animate(t: number) {
  shared.tLast ??= t
  // Skip large timesteps:
  if(t - shared.tLast > 100) {
    shared.tLast = t
  }

  const dt = (t - shared.tLast) / 1000
  shared.tLast = t

  shared.elapsed += dt
  shared.matrix[12] = Math.cos(Math.PI * 2 * shared.elapsed / 5)
  render()

  requestAnimationFrame(animate)
}

function render() {
  const gl = shared.gl
  if(!gl) {
    return
  }
  gl.clear(gl.COLOR_BUFFER_BIT)

  const x0 = shared.matrix[12]
  shared.matrix[12] -= 15*0.1

  for (let i = 0; i < 30; i++) {

  
  gl.uniformMatrix4fv(
      shared.transform,
      false,
      shared.matrix,
    )
  
    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.hexagon.length / 3)
    shared.matrix[12] += i*0.1
  }

  shared.matrix[12] =x0
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const ok = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (ok) {
    return program
  }

  const failure = gl.getProgramInfoLog(program)
  gl.deleteProgram(program)

  throw Error(failure || 'Program link failed; no log available')
}

function createShader(
  gl: WebGLRenderingContext,
  type:
    | WebGLRenderingContext['VERTEX_SHADER']
    | WebGLRenderingContext['FRAGMENT_SHADER'],
  source: string
) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw Error('Unable to create shader')
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (ok) {
    return shader
  }

  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)

  throw Error('Shader compilation failed')
}

geometry.hexagon = [
  -1,
  0,
  0,

  -1 / 2,
  Math.sqrt(3) / 2,
  0,

  1 / 2,
  Math.sqrt(3) / 2,
  0,

  1,
  0,
  0,

  1 / 2,
  -Math.sqrt(3) / 2,
  0,

  -1 / 2,
  -Math.sqrt(3) / 2,
  0,
]

shaders.vertEx = /* glsl */ `
uniform float aspect;
uniform mat4 transform;
attribute vec4 position;
varying vec3 rgb;

void main() {
  gl_Position = vec4(1.0/aspect, 1.0, 1.0, 1.0) * (transform * position);
  rgb = vec3(gl_Position.x, gl_Position.y, 0);
}
`

shaders.fragEx = /* glsl */ `
precision mediump float;
varying vec3 rgb;

void main() {
  gl_FragColor = vec4(rgb, 0.25);
}
`

init()
