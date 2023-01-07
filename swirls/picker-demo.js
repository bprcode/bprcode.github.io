const { mat4, vec3 } = glMatrix
const π = Math.PI;
const τ = Math.PI * 2.0;
const log = console.log.bind(console)
console.clear()

const canvas = document.getElementById('srgb-picker')
const state = {
  dx: 0,
  dy: 0,
  theta: 0,
  phi: 0,
  srgbBrightness: 0.5,
  srgbAnimator: null,
  labBrightness: 0.5,
  labAnimator: null
}

function resetCanvasDimensions () {
  for (const c of [document.getElementById('srgb-picker'),
                    document.getElementById('lab-picker')]) {
    c.setAttribute('width', c.getBoundingClientRect().width)
    c.setAttribute('height', c.getBoundingClientRect().height)
  }
}

document.addEventListener('DOMContentLoaded', initialize)

function initialize () {
  
  resetCanvasDimensions()
  addOtherEventListeners()
  
  const gl = canvas.getContext('webgl2')
  const gl2 = document.getElementById('lab-picker').getContext('webgl2')
  const versionElement = document.getElementById('version')

  if (versionElement) {
    versionElement.textContent =
      gl.getParameter(gl.VERSION)
      + ' / ' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
  }

  state.srgbBrightness = document.getElementById('srgb-brightness')
                          .value / 100
  state.labBrightness = document.getElementById('lab-brightness')
                          .value / 100

  state.srgbAnimator =
    glMain(gl, { clearColor: [0.51, 0.1, 0.25, 1], srgb: true })
  state.labAnimator =
    glMain(gl2)
}

function addOtherEventListeners () {

  document.getElementById('srgb-brightness')
  .addEventListener('input', event => {
    state.srgbBrightness = event.target.value / 100
    state.srgbAnimator?.()
  })

  document.getElementById('lab-brightness')
  .addEventListener('input', event => {
    state.labBrightness = event.target.value / 100
    state.labAnimator?.()
  })

  document.getElementById('srgb-picker')
    .addEventListener('mousedown', event => {
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.mousedown = true;
  })
  document.getElementById('srgb-picker')
    .addEventListener('mouseleave', event => {
      state.mousedown = false;
  })
  document.getElementById('srgb-picker')
    .addEventListener('mouseup', event => {
    state.mousedown = false;
  })
  document.getElementById('srgb-picker')
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
}

function glMain (gl, props = {}) {
  try {
  // Compile and link the shaders
  const vs = compileShader(gl, followVert, gl.VERTEX_SHADER)
  const fs = compileShader(gl, colorSpaceFrag, gl.FRAGMENT_SHADER)
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
  const osc = gl.getUniformLocation(program, 'osc')
  const mouse = gl.getUniformLocation(program, 'mouse')
  const resolution = gl.getUniformLocation(program, 'resolution')
  const brightness = gl.getUniformLocation(program, 'brightness')
  const srgbMode = gl.getUniformLocation(program, 'srgbMode')

  // Introduce vertex data
  gl.enableVertexAttribArray(pos)
  const stride = 2 * Float32Array.BYTES_PER_ELEMENT
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0)

  gl.enable(gl.CULL_FACE)
  gl.useProgram(program)
  const canvasRect = document.getElementById('srgb-picker')
                      .getBoundingClientRect()
  gl.uniform2fv(resolution, [canvasRect.width, canvasRect.height])
  const clearColor = props.clearColor || [0.1, 0.1, 0.1, 1]
  gl.clearColor(...clearColor)

  function drawFrame(t) {
    drawFrame.t0 ??= t
    const dt = t - drawFrame.t0

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(time, dt)
    gl.uniform1f(osc, Math.sin(dt / 1000.0))
    gl.uniform2fv(mouse, [state.nx, state.ny])
    gl.uniform1f(brightness, props.srgb
                              ? state.srgbBrightness
                              : state.labBrightness)
    gl.uniform1i(srgbMode, Boolean(props.srgb))

    gl.drawArrays(gl.TRIANGLE_FAN, 0, square2d.length / 2)

    // requestAnimationFrame(drawFrame)
  }
  
  requestAnimationFrame(drawFrame)
  return drawFrame

  } catch (e) {
    document.querySelector('.feedback').innerHTML = formatShaderError(e)

    document.querySelector('.feedback').style['color'] = '#abf'
    document.querySelector('.feedback').style['background-color'] = '#111'
    document.querySelector('.feedback').style['padding'] = '0.5rem'
  }
}

function compileShader (context, source, type) {
  const shader = context.createShader(type)
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS))
    throw new Error(context.getShaderInfoLog(shader), { cause: source })
  return shader
}

function linkProgram (context, program) {
  context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS))
    throw new Error(context.getProgramInfoLog(program))
}

function formatShaderError (error) {
  const lines = error.cause?.split('\n') || ['~']
  const badLineNumber = parseInt(error.message.match(/\d:(\d+)/)?.[1])
  const badLine = lines[badLineNumber - 1]
  lines[badLineNumber - 1] = `<span style="color:#f44">${badLine}</span>`

  let html = `<span style="color:#efa">${error.message}</span>`
              +lines.filter((e, i) => Math.abs(badLineNumber - i) < 4)
                    .join('<br>')

  return html
}

// Compare different color spaces
const colorSpaceFrag =
/* glsl */`
#define pi 3.14159265359
#define tau 6.28318530718

precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float osc;
uniform float brightness;
uniform bool srgbMode;

float dirac (float t, float t0) {
  const float width = 0.02;
  return smoothstep(-width, 0.0, t - t0)
        -smoothstep(0.0, width, t - t0);
}

float diracWide (float t, float t0) {
  const float width = 0.1;
  return smoothstep(-width, 0.0, t - t0)
        -smoothstep(0.0, width, t - t0);
}

vec3 interpolate (vec3 c1, vec3 c2, float t) {
  return c1 * (1.0 - t) + c2 * t;
}

float hueFromRGB (float p, float q, float t) {
  float result;
  t += (1.0 - step(0.0, t));
  t -= step(1.0, t);

  result = p;
  result =  step(2.0/3.0, t) * result
            + (1.0 - step(2.0/3.0, t))
              * (p + (q - p) * (2.0/3.0 - t) * 6.0);
  
  result = step(1.0/2.0, t) * result
            + (1.0 - step(1.0/2.0, t))
              * q;

  result = step(1.0/6.0, t) * result
            + (1.0 - step(1.0/6.0, t))
              * (p + (q - p) * 6.0 * t);

  return result;
}

// Returns an sRGB value from H, S, and L in (0..1)
vec3 RGBfromHSL (vec3 hsl) {
  hsl.x = mod(hsl.x, 1.0);
  vec3 rgb;

  float b =
    (1.0 - step(0.5, hsl.z)) *
      hsl.z * (1.0 + hsl.y)
    + step(0.5, hsl.z)
      * (hsl.z + hsl.y - hsl.y * hsl.z);
  
  float a = 2.0 * hsl.z - b;

  rgb.r = hueFromRGB(a, b, hsl.x + 1.0/3.0);
  rgb.g = hueFromRGB(a, b, hsl.x);
  rgb.b = hueFromRGB(a, b, hsl.x - 1.0/3.0);

  return rgb;
}

// CIE function part involved in computing L*a*b* values
float cief (float t) {
  const float delta = 6.0/29.0;

  return
    (step(pow(delta, 3.0), t))
      * pow(t, 1.0/3.0)
    + (1.0 - step(pow(delta, 3.0), t))
      * (t / (3.0 * pow(delta, 2.0)) + 4.0/29.0);
}

// Inversion of CIE function part above
float ciefInverse (float t) {
  const float delta = 6.0/29.0;
  
  return
    (step(delta, t))
      * pow(t, 3.0)
    + (1.0 - step(delta, t))
      * 3.0 * pow(delta, 2.0) * (t - 4.0/29.0);
}

// Compute CIE L*a*b* values using a D65 reference illuminant
vec3 LabFromXYZ (vec3 xyz) {
  const vec3 d65 = vec3(0.950489, 1.000, 1.088840);
  vec3 n = xyz / d65; // Normalize the XYZ values to the reference

  float L = 116.0 * cief(n.y) - 16.0;
  float a = 500.0 * (cief(n.x) - cief(n.y));
  float b = 200.0 * (cief(n.y) - cief(n.z));

  return vec3(L, a, b);
}

// Compute tristimulus values from CIE L*a*b* values
vec3 XYZfromLab (vec3 Lab) {
  const vec3 d65 = vec3(0.950489, 1.000, 1.088840);

  vec3 xyz = vec3(
    ciefInverse((Lab[0] + 16.0)/116.0 + Lab[1]/500.0),
    ciefInverse((Lab[0] + 16.0)/116.0),
    ciefInverse((Lab[0] + 16.0)/116.0 - Lab[2]/200.0)
  )
    * d65;

  return xyz;
}

// Remove gamma compression from an sRGB value
vec3 linearFromSRGB (vec3 rgb) {
  vec3 linear;

  linear.r = rgb.r / 12.92
              * (1.0 - step(0.04045, rgb.r))
          + pow((rgb.r + 0.055)/1.055, 2.4)
              * step(0.04045, rgb.r);

  linear.g = rgb.g / 12.92
              * (1.0 - step(0.04045, rgb.g))
          + pow((rgb.g + 0.055)/1.055, 2.4)
              * step(0.04045, rgb.g);

  linear.b = rgb.b / 12.92
              * (1.0 - step(0.04045, rgb.b))
          + pow((rgb.b + 0.055)/1.055, 2.4)
              * step(0.04045, rgb.b);

  return linear;
}

// Apply gamma compression to a linear RGB value
vec3 sRGBfromLinear (vec3 linear) {
  vec3 srgb;

  srgb.r = 12.92 * linear.r
              * (1.0 - step(0.0031308, linear.r))
            + (1.055 * pow(linear.r, 1.0 / 2.4) - 0.055)
              * step(0.0031308, linear.r);
  
  srgb.g = 12.92 * linear.g
              * (1.0 - step(0.0031308, linear.g))
            + (1.055 * pow(linear.g, 1.0 / 2.4) - 0.055)
              * step(0.0031308, linear.g);

  srgb.b = 12.92 * linear.b
              * (1.0 - step(0.0031308, linear.b))
            + (1.055 * pow(linear.b, 1.0 / 2.4) - 0.055)
              * step(0.0031308, linear.b);

  return srgb;
}

// Compute tristimulus values from a decompressed RGB value
vec3 XYZfromLinear (vec3 linear) {
  mat3 M = mat3 (
    0.4124, 0.2126, 0.0193,
    0.3576, 0.7152, 0.1192,
    0.1805, 0.0722, 0.9505
  );
  return M * linear;
}

// Compute linear RGB from CIE tristimulus values
vec3 linearFromXYZ (vec3 xyz) {
  mat3 N = mat3 (
    3.2406, -0.9689, 0.0557,
    -1.5372, 1.8758, -0.2040,
    -0.4986, 0.0415, 1.0570
  );
  return N * xyz;
}

// Returns render-ready sRGB values from L*a*b* coordinates
vec3 sRGBfromLab (vec3 Lab) {
  return  sRGBfromLinear(
            linearFromXYZ(
              XYZfromLab(Lab)
            )
          );
}

// Returns L*a*b* coordinates from sRGB
vec3 LabFromSRGB (vec3 srgb) {
  return  LabFromXYZ(
            XYZfromLinear(
              linearFromSRGB(srgb)
            )
          );
}

// Returns 1 if all inputs are in (0..1), 0 otherwise.
float gamutCheck (vec3 srgb) {
  float pass = 1.0;

  pass *= step(0.0, srgb.r) * (1.0 - step(1.0, srgb.r));
  pass *= step(0.0, srgb.g) * (1.0 - step(1.0, srgb.g));
  pass *= step(0.0, srgb.b) * (1.0 - step(1.0, srgb.b));

  return pass;
}

void main (void) {
  vec2 st = gl_FragCoord.xy / resolution.xy;
  vec2 qp = 2.0 * st - vec2(1.0); // Scaled to four-quadrant, 0..1 coordinates

  const vec3 red = vec3(1.0, 0.0, 0.0);
  const vec3 blue = vec3(0.0, 0.0, 1.0);
  const vec3 yellow = vec3(1.0, 1.0, 0.0);
  const vec3 green = vec3(0.0, 1.0, 0.0);
  const vec3 black = vec3(0.0);
  const vec3 white = vec3(1.0);
  const vec3 gray = vec3(0.5);

  const float abMax = 120.0;
  
  vec3 color = vec3(0.0);

  if (srgbMode) {
    color = RGBfromHSL(
        vec3( atan(qp.y, qp.x) / tau,
              smoothstep(0.0, 0.75, length(qp)),
              brightness))
        * (1.0 - step(0.75, length(qp)));
  } else {
    color =
        sRGBfromLab(
          vec3(100.0 * brightness, qp.x * abMax, qp.y * abMax)
        );

    vec3 clampedColor = vec3(clamp(color.r, 0.0, 1.0), clamp(color.g, 0.0, 1.0), clamp(color.b, 0.0, 1.0));
    color =
          step(0.0001, gamutCheck(color)) * clampedColor
          + (1.0 - step(0.0001, gamutCheck(color)))
            * clampedColor * 0.2;
  }

  gl_FragColor = vec4(color, 1.0);
}
`

// Display interesting hyperbolic star pattern
const borkFrag =
/* glsl */`
#ifdef GL_ES
precision mediump float;
#endif

#define pi 3.14159265359
#define tau 6.28318530718

uniform float time;

vec3 grape = vec3(0.149,0.141,0.912);
vec3 banana = vec3(1.000,0.833,0.224);

float plot (vec2 st, float pct){
  return  smoothstep( pct-0.01, pct, st.y) -
          smoothstep( pct, pct+0.01, st.y);
}

float dirac (float t, float t0) {
	return 1.0 - smoothstep(0.0, 0.02, abs(t - t0));
}
float diracWide (float t, float t0) {
	return 1.0 - smoothstep(0.0, 0.3, abs(t - t0));
}

float sharpstep (float lo, float hi, float x) {
    return clamp( (x - lo)/(hi-lo), 0.0, 1.0);
}

vec3 hslsmooth (vec3 hsl) {
    vec3 color = vec3(1.0, 0.0, 0.0) *
        (smoothstep(2.0/6.0,1.0/6.0,hsl.x)
        + smoothstep(4.0/6.0,5.0/6.0,hsl.x))
        + vec3(0.0, 1.0, 0.0) *
        (smoothstep(0.0/6.0,1.0/6.0,hsl.x)
        *smoothstep(4.0/6.0,3.0/6.0,hsl.x))
        + vec3(0.0, 0.0, 1.0) *
        (smoothstep(2.0/6.0,3.0/6.0,hsl.x)
        *smoothstep(6.0/6.0,5.0/6.0,hsl.x));
    return mix(vec3(0.0),
               mix(vec3(0.5), color, hsl.y),
               hsl.z);
}

vec3 hslsharp (vec3 hsl) {
    vec3 color = vec3(1.0, 0.0, 0.0) *
        (sharpstep(2.0/6.0,1.0/6.0,hsl.x)
        + sharpstep(4.0/6.0,5.0/6.0,hsl.x))
        + vec3(0.0, 1.0, 0.0) *
        (sharpstep(0.0/6.0,1.0/6.0,hsl.x)
        *sharpstep(4.0/6.0,3.0/6.0,hsl.x))
        + vec3(0.0, 0.0, 1.0) *
        (sharpstep(2.0/6.0,3.0/6.0,hsl.x)
        *sharpstep(6.0/6.0,5.0/6.0,hsl.x));
    return mix(vec3(0.0),
               mix(vec3(0.5), color, hsl.y),
               hsl.z);
}

vec3 rainbowGrad (vec2 p) {
    return vec3(1.0, 0.0, 0.0) * (pow(sin(pi *p.x + pi/2.0), 2.0))
        +vec3(0.0, 1.0, 0.0) * (1.0-4.0*pow(p.x - 0.333, 2.0))
        +vec3(0.0, 0.0, 1.0) * (1.0-4.0*pow(p.x - 0.666, 2.0));
}
vec3 arc (vec2 p) {
    float r = distance(p, vec2(0.5, 0.0));
    vec3 color = rainbowGrad(vec2(1.0-2.0*r, 0.0)) * diracWide(r, 0.5);
    return color;
}

vec3 grid (vec2 p) {
    return (clamp(dirac(mod(p.x, 1.0/6.0), 0.0)
            +dirac(mod(p.y, 0.25), 0.0), 0.0, 1.0))
        * vec3(0.3);
}

vec3 colorSpinner (vec2 p) {
    vec2 dv = p - vec2(0.5);
	float r = length(dv);
    float theta = atan(dv.y, dv.x) ;//+ mod(0.5*tau*time,tau);
    theta += sin(mod(time, 15000.0) * theta);
    return hslsmooth( vec3( mod((theta + pi) / tau, 1.0), 1.0, 1.0) ) * 
        (smoothstep(0.001, 0.002, r) -
        smoothstep(0.5, 0.51, r));
}

void main() {
    vec2 st = gl_FragCoord.xy/400.0;
    vec3 color = vec3(0.0);

    vec3 pct = vec3(st.x);

    color = colorSpinner(st);
    // color = hslsmooth(vec3(st.x, st.y, st.y));
    // color += vec3(1.0, 0.0, 0.0) * dirac(st.y, hslsmooth(st.x).r)
    //     + vec3(0.0, 1.0, 0.0) * dirac(st.y, hslsmooth(st.x).g)
    //     + vec3(0.0, 0.0, 1.0) * dirac(st.y, hslsmooth(st.x).b);
    
	//color += grid(st);
    gl_FragColor = vec4(color,1.0);
}
`

const morpherFrag =
/* glsl */`
precision highp float;
#define pi 3.1415926538
#define tau 6.2831853076

uniform float time;
uniform float osc;
uniform vec2 mouse;

float fuzzyEquals(float a, float b) {
  return smoothstep(0.1, 0.0, abs(a - b));
}

float fuzzyInequal(float a, float b) {
  return smoothstep(0.0, -2.0, a - b);
}

// float f (vec2 p) {
//   float r = distance(p, vec2(0.0, 0.0));
//   float theta = atan(p.y, p.x);
//   float theta2 = theta + tau;

//   return fuzzyEquals((5.0+20.0*osc)*r, theta)
//          +fuzzyEquals((5.0+20.0*osc)*r, theta2);
// }

// Polar-form equation, to be summed over many angles
float q (float r, float theta) {
  const float j = 1.5;
  const float k = 6.0;
  const float c = -6.5;
  float b = osc * 10.0;

  return fuzzyInequal(r,
    2.0 + sin(
    j * sin(
    (sin(k *theta) + b)
    ) + c
    )
  );
}

float polarPlane (vec2 p) {
  const int revolutions = 3;

  float r = distance(p, vec2(0.0, 0.0));
  float theta0 = atan(p.y, p.x);

  float sum = 0.0;
  for (float i = 0.0; i < 2.0 * float(revolutions); i += 1.0) {
    sum += q(r, theta0 + tau * i);
  }

  return sum;
}

void main(void) {
  const float size = 400.0;
  vec2 nPos = 8.0 * (gl_FragCoord.xy / size - vec2(0.5, 0.5));

  float a = polarPlane(nPos);

  gl_FragColor = vec4(
          a * vec3(0.0, 0.2, 1.0),
          1.0);
}
`

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
  vec2 v = (p - vec2(0.5, 0.5) ) / 0.25;
  float r = distance(v, vec2(0.0, 0.0));
  float theta = atan(v.y, v.x);
  float osc = sin(time / 3000.0);
  const float range = 10.0;

  float sum = 0.0;

  for (float i = -range; i <= range; i += 2.0) {
    sum += fuzzyEquals(
      r, cos(
        (0.5 + osc * 0.1)
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
