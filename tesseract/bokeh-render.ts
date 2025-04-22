const shaders: { [k: string]: string } = {}
const geometry: { [k: string]: number[] } = {}

function init() {
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')
  if (!canvas) {
    throw Error('No bokeh canvas found')
  }

  const gl = canvas.getContext('webgl')
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
    const w = Math.round(
      (h * canvas.clientWidth) / canvas.clientHeight
    )
    canvas.height = h
    canvas.width = w
    gl.viewport(0, 0, w, h)
    gl.uniform1f(aspectLoc, w / h)
    render(gl)
  }

  window.addEventListener('resize', updateSize)

  const vertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.fragEx)
  const program = createProgram(gl, vertShader, fragShader)

  const positionLoc = gl.getAttribLocation(program, 'position')
  const aspectLoc = gl.getUniformLocation(program, 'aspect')
  const positionBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.hexagon),
    gl.STATIC_DRAW
  )

  gl.clearColor(0, 0, 0.5, 0)

  gl.useProgram(program)

  gl.enableVertexAttribArray(positionLoc)

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0)
  

  updateSize()
}

function render(gl: WebGLRenderingContext) {
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.hexagon.length / 3)
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

geometry.triangleCross = [0, 0, 0, 1, 1, 0, 0, 0, -1, 0, 0, -1]

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
attribute vec4 position;

void main() {
  gl_Position = vec4(position.x / aspect, position.y, position.z, 1);
}
`

shaders.fragEx = /* glsl */ `
precision mediump float;

void main() {
  gl_FragColor = vec4(1, 0, 0.5, 0.25);
}
`

init()
