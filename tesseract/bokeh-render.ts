console.log('hi bokeh gl')

const shaders: { [k: string]: string } = {}

function init() {
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')
  if (!canvas) {
    throw Error('No bokeh canvas found')
  }

  const boundingRect = canvas.getBoundingClientRect()
  const boundHeight = Math.min(600, boundingRect.height)
  canvas.height = boundHeight
  canvas.width = Math.floor(boundHeight * boundingRect.width / boundingRect.height)

  const gl = canvas.getContext('webgl')
  if (!gl) {
    throw Error('Unable to create bokeh rendering context')
  }

  const vertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.fragEx)
  const program = createProgram(gl, vertShader, fragShader)

  const positionLoc = gl.getAttribLocation(program, 'position')
  const positionBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  const triangleVerts = [
    0,0,
    0,0.5,
    0.7,0,
  ]

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVerts), gl.STATIC_DRAW)

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  gl.clearColor(0,0,0.5,0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(program)

  gl.enableVertexAttribArray(positionLoc)

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0,0)

  gl.drawArrays(gl.TRIANGLES, 0, 3)

}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const ok = gl.getProgramParameter(program, gl.LINK_STATUS)
  if(ok) {
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

shaders.vertEx = /* glsl */ `
attribute vec4 position;

void main() {
  gl_Position = position;
}
`
shaders.fragEx = /* glsl */ `
precision mediump float;

void main() {
  gl_FragColor = vec4(1, 0, 0.5, 0.25);
}
`

init()
