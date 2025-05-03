import { normalizedGaussianKernel } from './gleam-painters'
import {
  ident,
  mult4,
  rotateXY,
  scaleMatrix,
  translateMatrix,
} from './sundry-matrix'
import * as tesseract from './tesseract-controller'

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
  aspect: null as WebGLUniformLocation | null,
  positionMax: null as WebGLUniformLocation | null,
  transform: null as WebGLUniformLocation | null,
  project: null as WebGLUniformLocation | null,
  focus: null as WebGLUniformLocation | null,
  rgba: null as WebGLUniformLocation | null,
}

const matrices = {
  transform: rotateXY(0),
  project: [] as number[],
}

const shared = {
  gl: null as WebGL2RenderingContext | WebGLRenderingContext | null,
  resizeCount: 0,
  blurKernelSize: 8,
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
  particleDensity: 12,
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
  ] as [number, number, number][],
}

type Particle = {
  position: [number, number, number]
  lifetime: number
  age: number
  spawnDelay: number
  color: [number, number, number, number]
  scale: number
}

type Light4D = {
  xyzw: [number, number, number, number]
  rgba: [number, number, number, number]
}

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
  const colorList: [number, number, number][] = []
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
  }) as EventListener)

  // Create antialiasing buffer objects, if possible:
  if (gl instanceof WebGL2RenderingContext) {
    shared.fboAA = gl.createFramebuffer()
    shared.rbAA = gl.createRenderbuffer()
  }

  // Particle pass initialization
  const hexVertShader = createShader(gl, gl.VERTEX_SHADER, shaders.vertEx)
  const hexFragShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    shaders.alphaFromFocus
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
  locations.aspect = gl.getUniformLocation(shared.hexagonProgram, 'aspect')
  locations.positionMax = gl.getUniformLocation(
    shared.hexagonProgram,
    'positionMax'
  )
  locations.transform = gl.getUniformLocation(
    shared.hexagonProgram,
    'transform'
  )
  locations.focus = gl.getUniformLocation(shared.hexagonProgram, 'focus')
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

  // Textured surface initialization
  locations.xy = gl.getAttribLocation(shared.flatProgram, 'xy')
  locations.uv = gl.getAttribLocation(shared.flatProgram, 'uv')
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

  requestAnimationFrame(animate)
}

function updateSize() {
  const gl = shared.gl
  const canvas: HTMLCanvasElement | null =
    document.querySelector('.bokeh-canvas')
  const checker = document.getElementById('resize-check')

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

  if (checker) {
    checker.textContent =
      shared.resizeCount +
      ' resizes: window largest: ' +
      Math.max(
        document.documentElement.clientWidth,
        document.documentElement.clientHeight
      ) +
      ' tex size: ' +
      shared.textureWidth +
      ', ' +
      shared.textureHeight +
      ' # p: ' +
      shared.maxParticles
  }

  render()
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
    lifetime: 2 + Math.random() * 4,
    spawnDelay: 0,
    age: 0,
    color: [
      ...shared.activeColorSet[
        Math.floor(Math.random() * shared.activeColorSet.length)
      ],
      1,
    ],
    scale: 0.9 + 0.2 * Math.random(),
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

    particles[i].color[3] =
      Math.sin((Math.PI * particles[i].age) / particles[i].lifetime) ** 2
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

function renderBlur(
  blurX: number,
  blurY: number,
  fromTexture: WebGLTexture,
  toFbo: WebGLFramebuffer
) {
  const gl = shared.gl!

  gl.bindFramebuffer(gl.FRAMEBUFFER, toFbo)
  // debug -- can skip some of these clears:
  gl.clear(gl.COLOR_BUFFER_BIT)

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
  // debug -- is this what we want?
  gl.blendFunc(gl.ONE, gl.ONE)

  gl.useProgram(shared.hexagonProgram)
  gl.enableVertexAttribArray(locations.position)

  gl.bindBuffer(gl.ARRAY_BUFFER, shared.hexagonVertBuffer)
  gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0)

  ident(matrices.project)
  matrices.project[0] = 1 / shared.aspect
  gl.uniformMatrix4fv(locations.project, false, matrices.project)

  for (const p of particles) {
    if (p.spawnDelay > 0) {
      continue
    }

    gl.uniform1f(locations.focus, Math.sin((Math.PI * p.age) / p.lifetime))

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
    shared.fboList[1]
  )
  renderBlur(
    0,
    1 / shared.textureHeight,
    shared.textureList[1],
    shared.fboList[2]
  )
  renderBlur(
    1 / shared.textureWidth,
    0,
    shared.textureList[2],
    shared.fboList[1]
  )
  renderBlur(
    0,
    1 / shared.textureHeight,
    shared.textureList[1],
    shared.fboList[2]
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
uniform vec2 positionMax;
uniform mat4 transform;
uniform mat4 project;
attribute vec4 position;

varying vec4 projected;

void main() {
  vec4 transformed = transform * position;

  float r = length(vec2(transformed)) / length(positionMax);
  transformed.x /= 0.9 + r * 0.1;
  transformed.y /= 0.9 + r * 0.1;

  projected = project * transformed;

  gl_Position = projected;
}
`

shaders.alphaFromFocus = /* glsl */ `
precision mediump float;
uniform vec4 rgba;
uniform float focus;

varying vec4 projected;

void main() {
  vec4 multiplied = rgba * rgba.a;
  multiplied.a = 1. - focus;

  gl_FragColor = multiplied;
}
`

shaders.fragEx = /* glsl */ `
precision mediump float;
uniform vec4 rgba;

varying vec4 projected;

void main() {
  gl_FragColor = clamp(length(vec2(projected.x, projected.y)), 0., 1.) * rgba;
}
`

shaders.texVert = /* glsl */ `
attribute vec2 xy;
attribute vec2 uv;
varying mediump vec2 vuv;

void main() {
  gl_Position = vec4(xy, 0, 1);
  vuv = uv;
}
`

shaders.texFrag = /* glsl */ `
precision mediump float;
uniform sampler2D texSampler;
varying mediump vec2 vuv;

void main() {
  gl_FragColor = texture2D(texSampler, vuv);
}
`

shaders.compositor = /* glsl */ `
precision mediump float;
uniform sampler2D blurSampler;
uniform sampler2D clearSampler;
varying mediump vec2 vuv;

void main() {
  const float aberration = 0.008;
  vec2 deltaCenter = vuv - vec2(0.5, 0.5);
  float boundedDistance = min(pow(length(deltaCenter) + 0.001, 0.25), 1.0);
  vec2 radialOffset = normalize(deltaCenter) * boundedDistance * aberration;
  float r = min(1.0, 2.0 * length(deltaCenter));
  float t = 1.0  - pow(1.0 - r, 0.95);

  vec3 near = vec3(texture2D(clearSampler, vuv + radialOffset) * (1.0 - t)
    + texture2D(blurSampler, vuv + radialOffset) * t);
  vec3 seminear = vec3(texture2D(clearSampler, vuv + 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, vuv + 0.5 * radialOffset) * t);
  vec3 middle = vec3(texture2D(clearSampler, vuv) * (1.0 - t)
    + texture2D(blurSampler, vuv) * t);
  vec3 semifar = vec3(texture2D(clearSampler, vuv - 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, vuv - 0.5 * radialOffset) * t);
  vec3 far = vec3(texture2D(clearSampler, vuv - radialOffset) * (1.0 - t)
    + texture2D(blurSampler, vuv - radialOffset) * t);

  float v = cos(3.14159 * abs(vuv.y - 0.5));

  far *=      vec3(0.,   0.,   0.6);
  semifar *=  vec3(0.,   0.3,  0.3);
  middle *=   vec3(0.1,  0.4,  0.1);
  seminear *= vec3(0.3,  0.3,  0.);
  near *=     vec3(0.6,  0.,   0.);
  
  vec4 aberrantColor = vec4(far + semifar + middle + seminear + near, 1.0);

  gl_FragColor = aberrantColor * 0.75 * pow(r, 4.0) * v
    + vec4(0.0, 0.005, 0.02, 0.0);
}
`

shaders.blur1d = /* glsl */ `
precision mediump float;
varying vec2 vuv;

uniform sampler2D readTexture;
#define kernelSize ${shared.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(readTexture, vuv) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(readTexture, vuv - float(i)*dv) * kernel[i]
            + texture2D(readTexture, vuv + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`

init()
