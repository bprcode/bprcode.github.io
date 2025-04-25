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
  xy: -1 as GLint,
  uv: -1 as GLint,
  texSampler: null as WebGLUniformLocation | null,
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
  particleDensity: 12,
  maxParticles: 0,
  flatTexture: null as WebGLTexture | null,
  hexagonProgram: null as WebGLProgram | null,
  flatProgram: null as WebGLProgram | null,
  hexagonVertBuffer: null as WebGLBuffer | null,
  flatVertBuffer: null as WebGLBuffer | null,
  uvBuffer: null as WebGLBuffer | null,
}

type particle = {
  position: [number, number, number]
  lifetime: number
  age: number
  spawnDelay: number
  color: [number, number, number, number]
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

  // Particle pass initialization
  const flareVertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const flareFragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.fragEx)
  shared.hexagonProgram = createProgram(gl, flareVertShader, flareFragShader)

  const texVertShader = createShader(gl, gl.VERTEX_SHADER, shaders.texVert)
  const texFragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.texFrag)
  shared.flatProgram = createProgram(gl, texVertShader, texFragShader)

  locations.position = gl.getAttribLocation(shared.hexagonProgram, 'position')
  locations.aspect = gl.getUniformLocation(shared.hexagonProgram, 'aspect')
  locations.transform = gl.getUniformLocation(
    shared.hexagonProgram,
    'transform'
  )
  locations.project = gl.getUniformLocation(shared.hexagonProgram, 'project')
  locations.rgba = gl.getUniformLocation(shared.hexagonProgram, 'rgba')

  shared.hexagonVertBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.hexagonVertBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.hexagon),
    gl.STATIC_DRAW
  )

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.clearColor(0, 0, 0, 0)

  // Textured surface initialization
  gl.useProgram(shared.flatProgram)
  locations.xy = gl.getAttribLocation(shared.flatProgram, 'xy')
  locations.uv = gl.getAttribLocation(shared.flatProgram, 'uv')
  locations.texSampler = gl.getUniformLocation(shared.flatProgram, 'texSampler')
  shared.flatVertBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.square.map(x => x / 2)),
    gl.STATIC_DRAW
  )

  shared.uvBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    gl.STATIC_DRAW
  )

  shared.flatTexture = gl.createTexture()
  const pixels = new Uint8Array(256 * 256 * 4)
  for (let x = 0; x < 256; x++) {
    for (let y = 0; y < 256; y++) {
      pixels[x * 4 + y * 256 * 4] =
        255 *
        Math.cos((Math.PI * 2 * x) / 256) *
        Math.sin((Math.PI * 2 * y) / 256)
      pixels[x * 4 + y * 256 * 4 + 1] = 55
      pixels[x * 4 + y * 256 * 4 + 2] = 128
      pixels[x * 4 + y * 256 * 4 + 3] = 255
      // Math.cos((Math.PI * 2 * x) / 256) * Math.sin((Math.PI * 2 * y) / 256)
    }
  }

  gl.bindTexture(gl.TEXTURE_2D, shared.flatTexture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    256,
    256,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels
  )

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

  updateSize()

  requestAnimationFrame(animate)
}

function removeParticle(i: number) {
  particles[i] = particles.at(-1)!
  particles.pop()
}

function addParticle() {
  particles.push({
    position: [
      -shared.xMax + 2 * shared.xMax * Math.random(),
      -shared.yMax + 2 * shared.yMax * Math.random(),
      0,
    ],
    lifetime: 2,
    spawnDelay: 0,
    age: 0,
    color: [0, 1, 1, 1],
  })
}

function updateParticles(dt: number) {
  while (particles.length < shared.maxParticles) {
    addParticle()
    particles[particles.length - 1].spawnDelay = Math.random() * 8
  }

  for (let i = 0; i < particles.length; i++) {
    if (particles[i].spawnDelay > 0) {
      particles[i].spawnDelay -= dt
      particles[i].color[3] = 0
      continue
    }

    particles[i].age += dt
    if (particles[i].age > particles[i].lifetime) {
      removeParticle(i)
      i--
      continue
    }

    particles[i].color[3] = Math.sin(
      (Math.PI * particles[i].age) / particles[i].lifetime
    )
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

  updateParticles(dt)
  render()

  requestAnimationFrame(animate)
}

function renderFlatTexture() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.useProgram(shared.flatProgram)
  gl.enableVertexAttribArray(locations.xy)
  gl.enableVertexAttribArray(locations.uv)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.vertexAttribPointer(locations.xy, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, shared.flatTexture)
  gl.uniform1i(locations.texSampler, 0)

  gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 2)
  gl.disableVertexAttribArray(locations.xy)
  gl.disableVertexAttribArray(locations.uv)
}

function renderHexagons() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.useProgram(shared.hexagonProgram)
  gl.enableVertexAttribArray(locations.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.hexagonVertBuffer)
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)

  gl.uniformMatrix4fv(locations.project, false, matrices.project)

  for (const p of particles) {
    ident(matrices.project)
    ident(matrices.transform)

    matrices.project[0] = 1 / shared.aspect
    mult4(
      matrices.transform,
      rotateXY(Math.PI / 10),
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
    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.hexagon.length / 3)
  }

  gl.disableVertexAttribArray(locations.position)
}

function render() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.clear(gl.COLOR_BUFFER_BIT)

  // flat texture section
  renderFlatTexture()

  // hexagon section
  renderHexagons()
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

geometry.square = [-1, 1, 1, 1, 1, -1, -1, -1]

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

shaders.texVert = /* glsl */ `
attribute vec2 xy;
attribute vec2 uv;
varying mediump vec2 vuv;

void main() {
  gl_Position = vec4(xy[0],xy[1], 0, 1);
  vuv = uv;
}

`

shaders.texFrag = /* glsl */ `
precision mediump float;
uniform sampler2D texSampler;
varying mediump vec2 vuv;

void main() {
  // gl_FragColor = vec4(vuv.x, vuv.y, 0.5, 1.0);
  gl_FragColor = texture2D(texSampler, vuv);
}
`

init()
