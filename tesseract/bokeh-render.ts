import {
  frustum,
  mult4,
  rotateXY,
  scaleMatrix,
  translateMatrix,
} from './sundry-matrix'

const shaders: { [k: string]: string } = {}
const geometry: { [k: string]: number[] } = {}
const locations = {
  position: -1 as GLint,
  aspect: null as WebGLUniformLocation | null,
  transform: null as WebGLUniformLocation | null,
  project: null as WebGLUniformLocation | null,
  rgb: null as WebGLUniformLocation | null,
}

const matrices = {
  transform: rotateXY(Math.PI / 4),
  project: [] as number[],
}

const shared = {
  gl: null as WebGLRenderingContext | null,
  tLast: 0,
  elapsed: 0,
}

const particles = {
  count: 30,
  positions: [] as [number, number, number][],
  colors: [] as [number, number, number][],
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
    matrices.project = frustum({ near: 0.1, far: 1000, fov: 22, aspect: w / h })
    gl.uniformMatrix4fv(locations.project, false, matrices.project)
    render()
  }

  window.addEventListener('resize', updateSize)

  const vertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.fragEx)
  const program = createProgram(gl, vertShader, fragShader)

  locations.position = gl.getAttribLocation(program, 'position')
  locations.aspect = gl.getUniformLocation(program, 'aspect')
  locations.transform = gl.getUniformLocation(program, 'transform')
  locations.project = gl.getUniformLocation(program, 'project')
  locations.rgb = gl.getUniformLocation(program, 'rgb')
  const positionBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.hexagon),
    gl.STATIC_DRAW
  )

  gl.clearColor(0, 0, 0, 0)

  gl.useProgram(program)

  gl.enableVertexAttribArray(locations.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)

  updateSize()

  initParticles()
  requestAnimationFrame(animate)
}

function initParticles() {
  particles.positions = Array(particles.count)

  for (let i = 0; i < particles.count; i++) {
    const r = 1
    const theta = ((Math.PI * 2) / particles.count) * i
    particles.positions[i] = [r * Math.cos(theta), r * Math.sin(theta), -10]
  }
}

function animate(t: number) {
  shared.tLast ??= t
  // Skip large timesteps:
  if (t - shared.tLast > 100) {
    shared.tLast = t
  }

  const dt = (t - shared.tLast) / 1000
  shared.tLast = t

  shared.elapsed += dt
  matrices.transform[12] = Math.cos((Math.PI * 2 * shared.elapsed) / 5)
  render()

  requestAnimationFrame(animate)
}

function show(matrix: number[]) {
  for (let c = 0; c < 4; c++) {
    let str = ''
    for (let r = 0; r < 4; r++) {
      str += matrix[r + c * 4] + '\t'
    }
    console.log(str + '\n')
  }
}

function render() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.clear(gl.COLOR_BUFFER_BIT)

  const scale = scaleMatrix(0.1)
  let t = 0
  for (const p of particles.positions) {
    matrices.transform = translateMatrix(p[0], p[1], p[2])
    mult4(matrices.transform, matrices.transform, scale)
    gl.uniform3f(locations.rgb, 1 - t, t, 0)
    t += 1 / particles.count

    gl.uniformMatrix4fv(locations.transform, false, matrices.transform)

    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.hexagon.length / 3)
  }
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
uniform mat4 project;
attribute vec4 position;

void main() {
  gl_Position = project * (transform * position);
}
`

shaders.fragEx = /* glsl */ `
precision mediump float;
uniform vec3 rgb;

void main() {
  gl_FragColor = vec4(rgb, 0.25);
}
`

init()
