'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

export const shaders = {}

const colorFunctions =
/* glsl */`
#define pi 3.14159265359
#define tau 6.28318530718

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

// Returns L*C*h coordinates from sRGB, with h angle in (-π..+π)
vec3 LChFromSRGB (vec3 srgb) {
  vec3 Lab = LabFromXYZ(XYZfromLinear(linearFromSRGB(srgb)));
  return vec3(
    Lab[0],
    length(vec2(Lab[1], Lab[2])),
    atan(Lab[2], Lab[1])
  );
}

// Returns sRGB from LCh with h in the range (-π..+π)
vec3 sRGBfromLCh (vec3 LCh) {
  float a = LCh[1] * cos(LCh[2]);
  float b = LCh[1] * sin(LCh[2]);

  return sRGBfromLab(vec3(LCh[0], a, b));
}

// Interpolate between LCh1 and LCh2, taking the shortest path (radians)
vec3 LChShortestLerp (vec3 LCh1, vec3 LCh2, float t) {
  float dh = LCh2[2] - LCh1[2];
  dh = mod(dh + pi, tau) - pi;
  return vec3(
    LCh1[0] * (1. - t) + LCh2[0] * (t),
    LCh1[1] * (1. - t) + LCh2[1] * (t),
    LCh1[2] + dh * t
  );
}

// Interpolate between LCh1 and LCh2, taking the longest path (radians)
// https://www.desmos.com/calculator/7nspcm1oeg
vec3 LChLongestLerp (vec3 LCh1, vec3 LCh2, float t) {
  float dh = LCh2[2] - LCh1[2];
  float modulus = mod(dh, tau);
  dh = modulus - pi + pi * sign(modulus - pi);

  return vec3(
    LCh1[0] * (1. - t) + LCh2[0] * (t),
    LCh1[1] * (1. - t) + LCh2[1] * (t),
    LCh1[2] + dh * t
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
`

shaders.testVert =
/* glsl */`#version 300 es
precision highp float;
in vec2 pos;

void main (void) {
  gl_Position = vec4(pos.x, pos.y, 0., 1.);
}
`

shaders.testFrag =
/* glsl */`#version 300 es
precision highp float;
uniform float canvasReciprocal;
uniform vec2 offset;
uniform float zoom;
out vec4 fragColor;

${colorFunctions}

float mandelbrot (vec2 c) {
  vec2 w;
  float result = 0.;

  const float iterations = 200.;

  float xx = 0.;
  float yy = 0.;
  float product = 0.;
  float sum = 0.;

  for (float n = 1.; n <= iterations; n++) {
    // (x² + 2xy + y²) - x² - y² + c.y
    w.y = product - xx - yy + c.y;
    w.x = xx - yy + c.x;

    xx = w.x * w.x;
    yy = w.y * w.y;
    sum = w.x + w.y;
    product = sum * sum;
    // debug -- may be faster to re-write these expressions in terms of
    // the dot product, which is well optimized in hardware. Benchmark later.

    // Equivalently:
    // w = vec2(w.x * w.x - w.y * w.y,
    //          2. * w.x * w.y) + c;

    // Carry the loop to completion regardless of escape,
    // but assign the result only if not previously assigned,
    // and the escape condition |z| > 2 is met:
    result += step(result, 0.) * step(4., xx + yy) * n;
  }

  return result;
}

void main (void) {
  vec2 p = vec2(gl_FragCoord) * canvasReciprocal;
  // debug -- low priority but the zoom is no longer centered:
  float n = mandelbrot((p - vec2(0.5, 0.5)) * zoom + offset);

  vec3 lch1 = LChFromSRGB(vec3(0.97, 0.3, 0.5));
  vec3 lch2 = LChFromSRGB(vec3(0.0, 0.2, 0.4));
  vec3 lch3 = LChFromSRGB(vec3(0.8, 0.8, 0.6));
  float t = mod(0.4 + n / 60., 3.);
  vec3 lchMixed =
    (1. - step(1., t)) *
    LChShortestLerp(lch1, lch2, t)
    + (step(1., t)) * (1. - step(2., t)) *
    LChShortestLerp(lch2, lch3, t - 1.)
    + step(2., t) *
    LChShortestLerp(lch3, lch1, t - 2.);

  vec3 sRGB = sRGBfromLCh(lchMixed) * step(0.1, n);
  fragColor = vec4(sRGB, 1.);

  // fragColor = vec4(pow(n / 200., 1.4), 0.5 * pow(n / 200., 4.), pow(n / 110., 1.3), 1.);
}
`
