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
  rgba: null as WebGLUniformLocation | null,
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
  particleDensity: 4,
  maxParticles: 1,
}

type particle = {
  position: [number,number,number],
  lifetime: number,
  color: [number,number,number,number]
}

const particles = [] as particle[]


function getSceneScale() {
  const renderCanvas = document.querySelector('.render-canvas')
  if (!renderCanvas) {
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

    const spacing = shared.sceneScale * 2
    shared.xMax = (0.5 * spacing * shared.aspect) / shared.sceneScale
    shared.yMax = (0.5 * spacing) / shared.sceneScale

    // Keep particle count proportional to canvas area:
    const bokehCanvas = document.querySelector('.bokeh-canvas')
    const renderCanvas = document.querySelector('.render-canvas')
    if (!bokehCanvas || !renderCanvas) {
      throw Error('DOM missing canvas nodes')
    }

    shared.maxParticles = Math.round(
      (shared.particleDensity *
        (bokehCanvas.clientWidth * bokehCanvas.clientHeight)) /
        (renderCanvas.clientWidth * renderCanvas.clientHeight)
    )

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
  locations.rgba = gl.getUniformLocation(program, 'rgba')
  const positionBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.square),
    gl.STATIC_DRAW
  )

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ZERO)
  gl.clearColor(0, 0, 0, 0)

  gl.useProgram(program)

  gl.enableVertexAttribArray(locations.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)

  updateSize()

  initParticles()
  requestAnimationFrame(animate)
}


function removeParticle(i: number) {
  particles[i] = particles.at(-1)!
  particles.pop()
}

function updateParticles(dt: number) {
  for (let i = 0; i < particles.length; i++) {
    particles[i].lifetime -= dt
    if(particles[i].lifetime < 0) {
      removeParticle(i)
      i--
      continue
    }
    
    particles[i].color[3] = particles[i].lifetime / 2
  }

  while(particles.length < shared.maxParticles) {
    particles.push({
      position: [-shared.xMax + 2*shared.xMax * Math.random(), -shared.yMax + 2*shared.yMax * Math.random(), 0],
      lifetime: 2,
      color: [0,1,1,1],
    })
  }

}

function initParticles() {
  particles.length = 0

  for (let i = 0; i < shared.maxParticles; i++) {
    particles.push({
      position: [-shared.xMax + 2*shared.xMax * Math.random(), -shared.yMax + 2*shared.yMax * Math.random(), 0],
      lifetime: 2,
      color: [1,0,1,1],
    })
  }
}

// function initParticles() {
  // particles.positions = Array(shared.maxParticles)

  // const rows = Math.ceil(Math.sqrt(shared.maxParticles / shared.aspect))
  // const columns = Math.floor(shared.maxParticles / rows)

  // console.log(shared.maxParticles, 'particle rows/cols', rows, columns)

  // let x = -shared.xMax
  // let y = -shared.yMax

  // for (let i = 0; i < shared.maxParticles; i++) {
  //   particles.positions[i] = [x, y, 0]
  //   x += (2 * shared.xMax) / columns
  //   if (x >= shared.xMax) {
  //     x = -shared.xMax
  //     y += (2 * shared.yMax) / rows
  //   }
  // }

// }

function animate(t: number) {
  shared.tLast ??= t
  // Skip large timesteps:
  if (t - shared.tLast > 100) {
    shared.tLast = t
  }

  const dt = (t - shared.tLast) / 1000
  shared.tLast = t

  shared.elapsed += dt
  
  updateParticles(dt)
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

  for (const p of particles) {
    ident(matrices.project)
    ident(matrices.transform)

    matrices.project[0] = 1 / shared.aspect
    mult4(
      matrices.transform,
      rotateXY(Math.PI / 4),
      scaleMatrix(shared.sceneScale / 4)
    )
    mult4(
      matrices.transform,
      translateMatrix(p.position[0], p.position[1], p.position[2]),
      matrices.transform
    )

    gl.uniform4fv(locations.rgba, p.color)
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
  if (!shared.gl) {
    return
  }
  const gl = shared.gl

  // console.log('x-copies req.', (shared.aspect * 1 / shared.sceneScale).toFixed(3),
  // 'y-copies:', (1/shared.sceneScale).toFixed(3))

  let index = 0

  for (let x = -shared.xMax; x <= shared.xMax; x += shared.xMax) {
    for (let y = -shared.yMax; y <= shared.yMax; y += shared.yMax) {
      ident(matrices.project)
      ident(matrices.transform)

      matrices.project[0] = 1 / shared.aspect
      mult4(matrices.transform, rotateXY(0), matrices.transform)
      mult4(
        matrices.transform,
        scaleMatrix(shared.sceneScale / 2),
        matrices.transform
      )
      mult4(matrices.transform, translateMatrix(x, y, 0), matrices.transform)

      if (index % 2) {
        gl.uniform4f(locations.rgba, 0.2, 0, 0, 1)
      } else {
        gl.uniform4f(locations.rgba, 0, 0.1, 0.3, 1)
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

geometry.square = [-1, 1, 0, 1, 1, 0, 1, -1, 0, -1, -1, 0]

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
uniform vec4 rgba;

void main() {
  gl_FragColor = rgba;
}
`

init()
