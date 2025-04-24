import {
  frustum,
  ident,
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
  aspect: 1,
  sceneScale: 1,
  xMax: 0,
  yMax: 0,
}

const particles = {
  active: 0,
  max: 1,
  positions: [] as [number, number, number][],
  colors: [] as [number, number, number][],
}

function getSceneScale() {
  const renderCanvas = document.querySelector('.render-canvas')
  if(!renderCanvas) {
    return 1
  }
  
  return renderCanvas.clientHeight / document.documentElement.clientHeight
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
    shared.aspect = w / h
    gl.viewport(0, 0, w, h)
    matrices.project = frustum({
      near: 0.1,
      far: 1000,
      fov: 20,
      aspect: shared.aspect,
    })

    shared.sceneScale = getSceneScale()

    const spacing = shared.sceneScale*2
    shared.xMax = 0.5 * spacing * shared.aspect / shared.sceneScale
    shared.yMax = 0.5 * spacing / shared.sceneScale

    // Keep particle count proportional to canvas area:
    particles.max = Math.round(shared.xMax * shared.yMax * 4)
    initParticles()

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
    new Float32Array(geometry.square),
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
  // Debug: temporary approach
  particles.positions = Array(particles.max)

  // xCount * yCount = N
  // xCount = floor[aspect * yCount]
  // aspect * yCount^2 = N  give or take rounding
  const rows = Math.ceil(Math.sqrt(particles.max / shared.aspect))
  const columns = Math.ceil(particles.max / rows)

  console.log(particles.max, 'particle rows/cols',rows,columns)

  for(let i = 0; i < particles.max; i++) {
    particles.positions[i] = [-shared.xMax + 2*shared.xMax * (i % columns)/columns,
      -shared.yMax + 2*shared.yMax * Math.floor(i/columns)/rows
       ,0]
  }

  // console.log(particles.positions)
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

function render() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.uniformMatrix4fv(locations.project, false, matrices.project)

  checkerboard()

  for(const p of particles.positions) {
    ident(matrices.project)
    ident(matrices.transform)

    matrices.project[0] = 1/shared.aspect
    mult4(matrices.transform, rotateXY(Math.PI/4), scaleMatrix(shared.sceneScale/2))
    mult4(matrices.transform, translateMatrix(p[0], p[1], p[2]), matrices.transform)

    gl.uniform3f(locations.rgb, 0.5,0.25,0)
    gl.uniformMatrix4fv(locations.project, false, matrices.project)
    gl.uniformMatrix4fv(locations.transform, false, matrices.transform)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 3)
  }

  // const scale = scaleMatrix(0.1)
  // let t = 0
  // for (const p of particles.positions) {
  //   matrices.transform = translateMatrix(p[0], p[1], p[2])
  //   mult4(matrices.transform, matrices.transform, scale)
  //   gl.uniform3f(locations.rgb, 1 - t, t, 0)
  //   t += 1 / particles.count

  //   gl.uniformMatrix4fv(locations.transform, false, matrices.transform)

  //   gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 3)
  // }

  // const swapProjection = matrices.project
  // matrices.project = []
  // ident(matrices.transform)
  // ident(matrices.project)

  // matrices.project[0] = 1/shared.aspect
  // mult4(matrices.transform, scaleMatrix(shared.sceneScale), rotateXY(Math.PI/2))
  

  // // mult4(matrices.transform, scaleMatrix(1/shared.aspect,1,1), rotateXY(Math.PI/2))
  // gl.uniform3f(locations.rgb, 0.30,0,0.5)
  // gl.uniformMatrix4fv(locations.project, false, matrices.project)
  // gl.uniformMatrix4fv(locations.transform, false, matrices.transform)
  // gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 3)
  // matrices.project = swapProjection
}

function checkerboard() {
  if(!shared.gl) {
    return
  }
  const gl = shared.gl
  
  // console.log('x-copies req.', (shared.aspect * 1 / shared.sceneScale).toFixed(3),
  // 'y-copies:', (1/shared.sceneScale).toFixed(3))


  let index = 0

  for(let x = -shared.xMax; x <= shared.xMax; x += shared.xMax) {
    for(let y = -shared.yMax; y <= shared.yMax; y += shared.yMax) {
      ident(matrices.project)
      ident(matrices.transform)

      matrices.project[0] = 1/shared.aspect
      mult4(matrices.transform, rotateXY(0), matrices.transform)
      mult4(matrices.transform, scaleMatrix(shared.sceneScale/2), matrices.transform)
      mult4(matrices.transform, translateMatrix(x, y, 0), matrices.transform)

      if(index%2) {

        gl.uniform3f(locations.rgb, 0.2,0,0)
      }
      else {
        gl.uniform3f(locations.rgb, 0,0.1,0.3)

      }
      gl.uniformMatrix4fv(locations.project, false, matrices.project)
      gl.uniformMatrix4fv(locations.transform, false, matrices.transform)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 3)
      // return
      index++
    }
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

geometry.square = [
  -1, 1, 0,
  1, 1, 0,
  1, -1, 0,
  -1, -1, 0,
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
