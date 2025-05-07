import { normalizedGaussianKernel } from './gleam-painters'
import {
  ident,
  mult4,
  rotateXY,
  scaleMatrix,
  translateMatrix,
} from './sundry-matrix'
import * as tesseract from './tesseract-controller'
import { bokehColorMap } from './bokeh-color-data'

const shaders: { [k: string]: string } = {}
const geometry: { [k: string]: number[] } = {}

const locations = {
  position: -1 as GLint,
  xy: -1 as GLint,
  uv: -1 as GLint,
  kernel: null as WebGLUniformLocation | null,
  readTexture: null as WebGLUniformLocation | null,
  blurStep: null as WebGLUniformLocation | null,
  texSampler: null as WebGLUniformLocation | null,
  blurSampler: null as WebGLUniformLocation | null,
  clearSampler: null as WebGLUniformLocation | null,
  hexAspect: null as WebGLUniformLocation | null,
  compositorAspect: null as WebGLUniformLocation | null,
  boost: null as WebGLUniformLocation | null,
  aberration: null as WebGLUniformLocation | null,
  pulseRadius: null as WebGLUniformLocation | null,
  positionMax: null as WebGLUniformLocation | null,
  transform: null as WebGLUniformLocation | null,
  project: null as WebGLUniformLocation | null,
  rgba: null as WebGLUniformLocation | null,
}

const matrices = {
  transform: rotateXY(0),
  project: [] as number[],
}

const shared = {
  gl: null as WebGL2RenderingContext | WebGLRenderingContext | null,
  readingMode: false,
  pulseTime: -3,
  zPulse: 0,
  resizeCount: 0,
  blurKernelSize: 10,
  canvasWidth: 0,
  canvasHeight: 0,
  textureWidth: 1,
  textureHeight: 1,
  tLast: 0,
  elapsed: 0,
  aspect: 1,
  sceneScale: 1,
  xMax: 0,
  yMax: 0,
  particleDensity: 14,
  maxParticles: 0,
  easedParticleMax: 0,
  hexagonProgram: null as WebGLProgram | null,
  flatProgram: null as WebGLProgram | null,
  blurProgram: null as WebGLProgram | null,
  compositorProgram: null as WebGLProgram | null,
  hexagonVertBuffer: null as WebGLBuffer | null,
  flatVertBuffer: null as WebGLBuffer | null,
  uvBuffer: null as WebGLBuffer | null,
  fboAA: null as WebGLFramebuffer | null,
  rbAA: null as WebGLRenderbuffer | null,
  fboList: [] as WebGLFramebuffer[],
  textureList: [] as WebGLTexture[],
  activeColorSet: [
    [0.3, 0.1, 0.15],
    [0.1, 0.25, 0.3],
  ] as RGBTriple[],
}

type Particle = {
  position: [number, number, number]
  lifetime: number
  age: number
  spawnDelay: number
  color: [number, number, number, number]
  colorIndex: number
  scale: number
}

type Light4D = {
  xyzw: [number, number, number, number]
  rgba: [number, number, number, number]
}

type RGBTriple = [number, number, number]

type TesseractAnimation = {
  title: string
  lighting: {
    diffuseLights: Light4D[]
    specularLights: Light4D[]
  }
}

const particles = [] as Particle[]

function getSceneScale() {
  const renderCanvas = document.querySelector('.render-canvas')
  if (!renderCanvas) {
    return 1
  }

  if (document.documentElement.clientHeight < 1) {
    return 1
  }

  return renderCanvas.clientHeight / document.documentElement.clientHeight
}

function handleTesseractCycle(animation: TesseractAnimation) {
  if (bokehColorMap.has(animation.title)) {
    shared.activeColorSet = bokehColorMap.get(animation.title) as RGBTriple[]
    return
  }

  const colorList: RGBTriple[] = []
  const excludeNegative = ({ rgba }) =>
    rgba[0] >= 0 && rgba[1] >= 0 && rgba[2] >= 0
  const excludeBlank = ({ rgba }) =>
    rgba[0] !== 0 || rgba[1] !== 0 || rgba[2] !== 0

  for (const { rgba } of animation.lighting.diffuseLights
    .filter(excludeNegative)
    .filter(excludeBlank)) {
    colorList.push([rgba[0], rgba[1], rgba[2]])
  }

  for (const { rgba } of animation.lighting.specularLights
    .filter(excludeNegative)
    .filter(excludeBlank)) {
    colorList.push([rgba[0], rgba[1], rgba[2]])
  }

  console.log(animation.title, 'applying colors:')
  for (const color of colorList) {
    console.log(color)
  }

  if (colorList.length) {
    shared.activeColorSet = colorList
  }
}

function init() {
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')
  if (!canvas) {
    throw Error('No bokeh canvas found')
  }

  shared.gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  })
  if (!shared.gl) {
    shared.gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })

    if (!shared.gl) {
      throw Error('Unable to create bokeh rendering context')
    }
  }

  const gl = shared.gl
  window.addEventListener('resize', updateSize)

  if (tesseract.state.currentAnimation) {
    handleTesseractCycle(tesseract.state.currentAnimation as TesseractAnimation)
  }

  window.addEventListener('tesseract-change', ((
    e: CustomEvent<TesseractAnimation>
  ) => {
    handleTesseractCycle(e.detail)
    queueCycleResponse()
  }) as EventListener)

  window.addEventListener('pane-close', () => {
    shared.readingMode = false
  })
  window.addEventListener('pane-open', () => {
    shared.readingMode = true
  })

  // Create antialiasing buffer objects, if possible:
  if (gl instanceof WebGL2RenderingContext) {
    shared.fboAA = gl.createFramebuffer()
    shared.rbAA = gl.createRenderbuffer()
  }

  // Particle pass initialization
  const hexVertShader = createShader(gl, gl.VERTEX_SHADER, shaders.flatLensVert)
  const hexFragShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    shaders.premultiplyAlpha
  )
  shared.hexagonProgram = createProgram(gl, hexVertShader, hexFragShader)

  const texVertShader = createShader(gl, gl.VERTEX_SHADER, shaders.texVert)
  const texFragShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.texFrag)
  shared.flatProgram = createProgram(gl, texVertShader, texFragShader)

  const blurShader = createShader(gl, gl.FRAGMENT_SHADER, shaders.blur1d)
  shared.blurProgram = createProgram(gl, texVertShader, blurShader)

  const compositorShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    shaders.compositor
  )
  shared.compositorProgram = createProgram(gl, texVertShader, compositorShader)

  locations.position = gl.getAttribLocation(shared.hexagonProgram, 'position')
  locations.hexAspect = gl.getUniformLocation(shared.hexagonProgram, 'aspect')
  locations.boost = gl.getUniformLocation(shared.hexagonProgram, 'boost')
  locations.positionMax = gl.getUniformLocation(
    shared.hexagonProgram,
    'positionMax'
  )
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

  gl.useProgram(shared.blurProgram)
  locations.blurStep = gl.getUniformLocation(shared.blurProgram, 'blurStep')
  locations.kernel = gl.getUniformLocation(shared.blurProgram, 'kernel')
  gl.uniform1fv(
    locations.kernel,
    normalizedGaussianKernel(0.1, shared.blurKernelSize)
  )

  locations.blurSampler = gl.getUniformLocation(
    shared.compositorProgram,
    'blurSampler'
  )
  locations.clearSampler = gl.getUniformLocation(
    shared.compositorProgram,
    'clearSampler'
  )
  locations.compositorAspect = gl.getUniformLocation(
    shared.compositorProgram,
    'compositorAspect'
  )
  locations.aberration = gl.getUniformLocation(
    shared.compositorProgram,
    'aberration'
  )
  locations.pulseRadius = gl.getUniformLocation(
    shared.compositorProgram,
    'pulseRadius'
  )

  // Textured surface initialization
  locations.xy = gl.getAttribLocation(shared.flatProgram, 'xy')
  locations.uv = gl.getAttribLocation(shared.flatProgram, 'uvA')
  locations.texSampler = gl.getUniformLocation(shared.flatProgram, 'texSampler')
  shared.flatVertBuffer = gl.createBuffer()

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(geometry.square),
    gl.STATIC_DRAW
  )

  shared.uvBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    gl.STATIC_DRAW
  )

  // Rendering targets: Two ping-pong targets for Gaussian blur,
  // one pristine source for use in the compositor.
  shared.fboList = [
    gl.createFramebuffer(),
    gl.createFramebuffer(),
    gl.createFramebuffer(),
  ]

  for (const fbo of shared.fboList) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    shared.textureList.push(gl.createTexture())
    gl.bindTexture(gl.TEXTURE_2D, shared.textureList.at(-1)!)

    // Single pixel placeholder:
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    )

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      shared.textureList.at(-1)!,
      0
    )
  }

  updateSize()
  seedParticles()
  queueCycleResponse()

  requestAnimationFrame(animate)
}

function queueCycleResponse() {
  setTimeout(() => {
    if (!shared.readingMode) {
      shared.pulseTime = 0
    }
  }, 19500)
}

function updateSize() {
  const gl = shared.gl
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')

  if (!canvas || !gl) {
    return
  }

  shared.resizeCount++

  shared.canvasHeight = Math.max(
    1,
    Math.round(Math.min(600, canvas.clientHeight))
  )
  shared.canvasWidth = Math.max(
    1,
    Math.round((shared.canvasHeight * canvas.clientWidth) / canvas.clientHeight)
  )

  shared.textureWidth = Math.max(
    1,
    Math.min(1024, Math.floor(shared.canvasWidth / 2))
  )
  shared.textureHeight = Math.max(
    1,
    Math.min(1024, Math.floor(shared.canvasHeight / 2))
  )

  canvas.height = shared.canvasHeight
  canvas.width = shared.canvasWidth
  shared.aspect = shared.canvasWidth / shared.canvasHeight
  shared.sceneScale = getSceneScale()

  const spacing = shared.sceneScale * 2
  shared.xMax = (0.5 * spacing * shared.aspect) / shared.sceneScale
  shared.yMax = (0.5 * spacing) / shared.sceneScale

  gl.useProgram(shared.hexagonProgram)
  gl.uniform2fv(locations.positionMax, [shared.xMax, shared.yMax])

  gl.useProgram(shared.compositorProgram)
  gl.uniform1f(locations.compositorAspect, shared.aspect)

  // Update renderbuffer storage for antialiasing, if supported:
  if (shared.fboAA && gl instanceof WebGL2RenderingContext) {
    const samples = Math.min(16, gl.getParameter(gl.MAX_SAMPLES))

    const restore = gl.getParameter(gl.RENDERBUFFER_BINDING)

    gl.bindRenderbuffer(gl.RENDERBUFFER, shared.rbAA)
    gl.renderbufferStorageMultisample(
      gl.RENDERBUFFER,
      samples,
      gl.RGBA8,
      shared.textureWidth,
      shared.textureHeight
    )

    gl.bindFramebuffer(gl.FRAMEBUFFER, shared.fboAA)
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.RENDERBUFFER,
      shared.rbAA
    )

    gl.bindRenderbuffer(gl.RENDERBUFFER, restore)
  }

  const bokehCanvas = document.querySelector('.bokeh-canvas')
  const renderCanvas = document.querySelector('.render-canvas')
  if (!bokehCanvas || !renderCanvas) {
    throw Error('DOM missing canvas nodes')
  }

  // Keep particle count proportional to canvas area:
  shared.maxParticles = Math.min(
    300,
    Math.round(
      (shared.particleDensity *
        (bokehCanvas.clientWidth * bokehCanvas.clientHeight)) /
        (renderCanvas.clientWidth * renderCanvas.clientHeight)
    )
  )

  for (const texAlt of shared.textureList) {
    gl.bindTexture(gl.TEXTURE_2D, texAlt)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      shared.textureWidth,
      shared.textureHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    )
  }

  render()
}

function removeParticle(i: number) {
  particles[i] = particles.at(-1)!
  particles.pop()
}

function addParticle() {
  const y = shared.yMax * (2.0 * (Math.random() - 0.5))
  const z = 2 * (Math.random() - 0.5)
  const colorIndex = Math.floor(Math.random() * shared.activeColorSet.length)
  particles.push({
    position: [shared.xMax * 2 * (Math.random() - 0.5), y, z],
    lifetime: 5 + Math.random() * 5,
    spawnDelay: 0,
    age: 0,
    color: [...shared.activeColorSet[colorIndex], 1],
    colorIndex: colorIndex,
    scale:
      0.85 + 0.1 * (1 - (y + shared.yMax) / shared.yMax) + 0.2 / (z + 2.01),
  })
}

function seedParticles() {
  while (particles.length < shared.maxParticles / 2) {
    const t0 = (6 * particles.length) / shared.maxParticles
    addParticle()
    particles[particles.length - 1].lifetime = 2 + Math.random() * 4
    particles[particles.length - 1].spawnDelay = t0
  }
}

function updateParticles(dt: number) {
  const colorHalfLife = 1.125
  const k = -Math.log(0.5) / colorHalfLife

  while (particles.length < shared.maxParticles) {
    addParticle()
    particles[particles.length - 1].spawnDelay = Math.random() * 2
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

    const targetColor =
      shared.activeColorSet[
        particles[i].colorIndex % shared.activeColorSet.length
      ]
    particles[i].color[0] = ease(particles[i].color[0], targetColor[0], dt)
    particles[i].color[1] = ease(particles[i].color[1], targetColor[1], dt)
    particles[i].color[2] = ease(particles[i].color[2], targetColor[2], dt)

    particles[i].color[3] =
      Math.sin((Math.PI * particles[i].age) / particles[i].lifetime) ** 4
  }

  function ease(a: number, b: number, t: number) {
    return b - (b - a) * Math.exp(-k * t)
  }
}

function animate(t: number) {
  shared.tLast ??= t
  // Skip large timesteps:
  if (t - shared.tLast > 100) {
    shared.tLast = t
  }

  const dt = ((shared.readingMode ? 0.3 : 1) * (t - shared.tLast)) / 1000
  shared.tLast = t

  shared.elapsed += dt
  shared.elapsed %= 86400

  shared.pulseTime += dt
  shared.zPulse = 0.6 * shared.pulseTime - 2

  updateParticles(dt)
  render()

  requestAnimationFrame(animate)
}

function renderBlur(
  blurX: number,
  blurY: number,
  fromTexture: WebGLTexture,
  toFbo: WebGLFramebuffer,
  needClear = true
) {
  const gl = shared.gl!

  gl.bindFramebuffer(gl.FRAMEBUFFER, toFbo)
  if (needClear) {
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  gl.viewport(0, 0, shared.textureWidth, shared.textureHeight)
  gl.useProgram(shared.blurProgram)
  gl.enableVertexAttribArray(locations.xy)
  gl.enableVertexAttribArray(locations.uv)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.vertexAttribPointer(locations.xy, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, fromTexture)
  gl.uniform1i(locations.readTexture, 0)
  gl.uniform2f(locations.blurStep, blurX, blurY)

  gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 2)
  gl.disableVertexAttribArray(locations.xy)
  gl.disableVertexAttribArray(locations.uv)
}

function renderComposite() {
  const gl = shared.gl!

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.viewport(0, 0, shared.canvasWidth, shared.canvasHeight)
  gl.useProgram(shared.compositorProgram)
  gl.enableVertexAttribArray(locations.xy)
  gl.enableVertexAttribArray(locations.uv)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.vertexAttribPointer(locations.xy, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, shared.textureList[0])
  gl.uniform1i(locations.clearSampler, 0)

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, shared.textureList[2])
  gl.uniform1i(locations.blurSampler, 1)

  gl.uniform1f(
    locations.aberration,
    0.005 + 0.006 * easePass(1 - Math.abs(2 * shared.zPulse + 1))
  )

  gl.uniform1f(
    locations.pulseRadius,
    Math.max(shared.xMax, shared.yMax) * (shared.zPulse + 1)
  )

  gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 2)
  gl.disableVertexAttribArray(locations.xy)
  gl.disableVertexAttribArray(locations.uv)
}

function renderFlatTexture(sourceTexture: WebGLTexture) {
  const gl = shared.gl!

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.viewport(0, 0, shared.canvasWidth, shared.canvasHeight)
  gl.useProgram(shared.flatProgram)
  gl.enableVertexAttribArray(locations.xy)
  gl.enableVertexAttribArray(locations.uv)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.flatVertBuffer)
  gl.vertexAttribPointer(locations.xy, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, shared.uvBuffer)
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
  gl.uniform1i(locations.texSampler, 0)

  gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.square.length / 2)
  gl.disableVertexAttribArray(locations.xy)
  gl.disableVertexAttribArray(locations.uv)
}

function renderHexagons() {
  const gl = shared.gl!

  gl.viewport(0, 0, shared.textureWidth, shared.textureHeight)

  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.blendFunc(gl.ONE, gl.ONE)

  gl.useProgram(shared.hexagonProgram)
  gl.enableVertexAttribArray(locations.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.hexagonVertBuffer)
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)

  ident(matrices.project)
  matrices.project[0] = 1 / shared.aspect
  gl.uniformMatrix4fv(locations.project, false, matrices.project)

  const rhoPulse = Math.max(shared.xMax, shared.yMax) * (shared.zPulse + 1)

  for (const p of particles) {
    if (p.spawnDelay > 0) {
      continue
    }

    ident(matrices.transform)

    mult4(
      matrices.transform,
      rotateXY(Math.PI / 10),
      scaleMatrix((p.scale * shared.sceneScale) / 4)
    )
    mult4(
      matrices.transform,
      translateMatrix(p.position[0], p.position[1], p.position[2]),
      matrices.transform
    )

    gl.uniform4fv(locations.rgba, p.color)
    gl.uniformMatrix4fv(locations.transform, false, matrices.transform)

    const rho = Math.sqrt(p.position[0] ** 2 + p.position[1] ** 2)

    const boost = Math.min(
      1,
      Math.max(0, easeInOut(1 - Math.abs(rho - rhoPulse)))
    )
    gl.uniform1f(locations.boost, 1.0 + 1.75 * boost)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.hexagon.length / 3)
  }

  gl.disableVertexAttribArray(locations.position)
}

function render() {
  const gl = shared.gl
  if (!gl) {
    return
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.clear(gl.COLOR_BUFFER_BIT)

  if (gl instanceof WebGL2RenderingContext) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shared.fboAA)
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shared.fboList[0])
  }

  renderHexagons()
  resolveAA()

  renderBlur(
    1 / shared.textureWidth,
    0,
    shared.textureList[0],
    shared.fboList[1],
    true
  )
  renderBlur(
    0,
    1 / shared.textureHeight,
    shared.textureList[1],
    shared.fboList[2],
    true
  )
  renderBlur(
    1 / shared.textureWidth,
    0,
    shared.textureList[2],
    shared.fboList[1],
    false
  )
  renderBlur(
    0,
    1 / shared.textureHeight,
    shared.textureList[1],
    shared.fboList[2],
    false
  )

  renderComposite()
}

// Blit from the antialiased frame buffer, if valid:
function resolveAA() {
  if (!(shared.gl instanceof WebGL2RenderingContext) || !shared.fboAA) {
    return
  }

  const gl = shared.gl
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, shared.fboAA)
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, shared.fboList[0])
  gl.blitFramebuffer(
    0,
    0,
    shared.textureWidth,
    shared.textureHeight,
    0,
    0,
    shared.textureWidth,
    shared.textureHeight,
    gl.COLOR_BUFFER_BIT,
    gl.NEAREST
  )
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

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

function easePass(t: number): number {
  if (t <= 0) {
    return 0
  }
  if (t >= 1) {
    return 1
  }
  return 1 - 2 ** (-10 * t)
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

shaders.flatLensVert = /* glsl */ `
uniform float aspect;
uniform vec2 positionMax;
uniform mat4 transform;
uniform mat4 project;
attribute vec4 position;

varying vec4 projected;

void main() {
  vec4 transformed = transform * position;

  float r = length(vec2(transformed)) / length(positionMax);
  transformed.x /= 0.9 + r * 0.1125;
  transformed.y /= 0.9 + r * 0.1125;

  projected = project * transformed;

  gl_Position = projected;
}
`

shaders.premultiplyAlpha = /* glsl */ `
precision mediump float;
uniform float boost;
uniform vec4 rgba;

varying vec4 projected;

void main() {
  vec4 multiplied = rgba * rgba.a * boost;
  multiplied.a = rgba.a;

  gl_FragColor = multiplied;
}
`

shaders.texVert = /* glsl */ `
attribute vec2 xy;
attribute vec2 uvA;
varying mediump vec2 uv;

void main() {
  gl_Position = vec4(xy, 0, 1);
  uv = uvA;
}
`

shaders.texFrag = /* glsl */ `
precision mediump float;
uniform sampler2D texSampler;
varying mediump vec2 uv;

void main() {
  gl_FragColor = texture2D(texSampler, uv);
}
`

shaders.compositor = /* glsl */ `
precision mediump float;
uniform sampler2D blurSampler;
uniform sampler2D clearSampler;
uniform float compositorAspect;
uniform float aberration;
uniform float pulseRadius;
varying mediump vec2 uv;

float ease(float x) {
  float lo = 0.5 * pow(2., 20. * x - 10.);
  float hi = 1.0 - 0.5 * pow(2., -20. * x + 10.);
  float s = step(0.5, x);
  return max(0., min(1., (1. - s) * lo + s * hi));
}

void main() {
  const float yFocus = 0.55;
  vec2 deltaCenter = vec2(uv.x, uv.y) - vec2(0.5, yFocus);
  deltaCenter.x *= compositorAspect;

  float boundedDistance = min(pow(length(deltaCenter) + 0.001, 0.25), 1.0);
  vec2 radialOffset = normalize(deltaCenter) * boundedDistance * aberration;
  float uvRadius = length(deltaCenter);
  float radialDifference = uvRadius - pulseRadius;
  float leadingEase = step(0., radialDifference)
                        * ease(abs(uvRadius-pulseRadius));
  float trailingEase = (1. - step(0., radialDifference))
                        * min(1., 1. - exp(uvRadius - pulseRadius));
  float pulseDelta = leadingEase + trailingEase;
  float r = min(1.0, 2.0 * length(deltaCenter) / 2.5);

  // Lerp blur intensity based on vertical position:
  float t = min(1., pow(2. * (uv.y - yFocus), 2.));

  // Take five samples for chromatic aberration:
  vec4 near = texture2D(clearSampler, uv + radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + radialOffset) * t;
  vec4 seminear = texture2D(clearSampler, uv + 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + 0.5 * radialOffset) * t;
  vec4 middle = texture2D(clearSampler, uv) * (1.0 - t)
    + texture2D(blurSampler, uv) * t;
  vec4 semifar = texture2D(clearSampler, uv - 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - 0.5 * radialOffset) * t;
  vec4 far = texture2D(clearSampler, uv - radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - radialOffset) * t;

  float v = cos(2.7 * abs(uv.y - 0.475));

  far *=      vec4(0.,   0.,   0.6,   0.2);
  semifar *=  vec4(0.,   0.3,  0.3,   0.2);
  middle *=   vec4(0.1,  0.4,  0.1,   0.2);
  seminear *= vec4(0.3,  0.3,  0.,    0.2);
  near *=     vec4(0.6,  0.,   0.,    0.2);
  
  float smoothR = smoothstep(0., 1., 7.0 * smoothstep(0., 1., pow(0.45 * r, 1.1)))
    * smoothstep(0., 1., 1. - r);
  float centralR = pow(0.85*r, 1.9);
  float outerR = smoothstep(0., 1., 1. - r);

  vec4 aberrantColor = far + semifar + middle + seminear + near;

  float curtainFactor = smoothstep(0.0, 0.2, (1. - 2. * abs(uv.x - 0.5)));

  
  float overallFade = (1. - v * curtainFactor) * (pulseDelta);

  gl_FragColor = aberrantColor * (1. - overallFade) * centralR;
}
`

shaders.blur1d = /* glsl */ `
precision mediump float;
varying vec2 uv;

uniform sampler2D readTexture;
#define kernelSize ${shared.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(readTexture, uv) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(readTexture, uv - float(i)*dv) * kernel[i]
            + texture2D(readTexture, uv + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`

init()
