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

// Prior precision functions, buggy, gets optimized away by compiler:
// const precisionFunctions =
// /* glsl */`
// // Float-float operations adapted from:
// // Guillaume da Graçca, David Defour. Implementation of float-float operators
// // on graphics hardware. Real Numbers and Computers 7, Jul 2006, Nancy, France.
// // pp.23-32. ￿hal-00021443￿
// vec2 split (float original, float splitPoint) {
//   float c = (pow(2., splitPoint) + 1.) * original;
//   float big = c - original;
//   float hi = c - big;
//   float lo = original - hi;

//   return vec2 (hi, lo);
// }

// // singles -> paired result
// vec2 add12 (float x, float y) {
//   float sum = x + y;
//   float v = sum - x;
//   float rest = (x - (sum - v)) + (y - v);
//   return vec2(sum, rest);
// }

// // singles -> paired result
// vec2 mul12 (float a, float b) {
//   float product = a * b;
//   vec2 a2 = split(a, 16.);
//   vec2 b2 = split(b, 16.);

//   float e1 = product - (a2.x * b2.x);
//   float e2 = e1 - (a2.y * b2.x);
//   float e3 = e2 - (a2.x * b2.y);
//   float roundoff = (a2.y * b2.y) - e3;

//   return vec2(product, roundoff);
// }

// // two paired operands -> one paired result
// vec2 add22 (vec2 a, vec2 b) {
//   float r = a.x + b.x;
//   float comparison = step(abs(b.x), abs(a.x));
//   float s =
//     comparison * // If a hi >= b hi...
//       (((a.x - r) + b.x) + b.y) + a.y

//     + (1. - comparison) * // else...
//       (((b.x - r) + a.x) + a.y) + b.y;

//   return add12(r, s);
// }

// // two paired operands -> one paired result
// vec2 mul22 (vec2 a, vec2 b) {
//   vec2 t = mul12(a.x, b.x);

//   float t3 = ((a.x * b.y) + (a.y * b.x)) + t.y;
//   // N.B. this step is misprinted in Graçca and Defour:
//   return add12(t.x, t3);
// }

// float times_frc(float a, float b) {
//   return a * b;
//   //return mix(0.0, a * b, b != 0.0 ? 1.0 : 0.0);
// }

// float plus_frc(float a, float b) {
//   return a + b;
//   //return mix(a, a + b, b != 0.0 ? 1.0 : 0.0);
// }

// float minus_frc(float a, float b) {
//   // Here we multiply by 1, provided as a uniform, to block the compiler
//   // from performing an optimization which otherwise ruins the floating-
//   // point emulation entirely. Modify with care only:
//   return a - b * one;
//   //return mix(a, a - b, b != 0.0 ? 1.0 : 0.0);
// }
// `

const precisionFunctions =
/* glsl */`
// Float-float operations adapted from:
// Guillaume da Graçca, David Defour. Implementation of float-float operators
// on graphics hardware. Real Numbers and Computers 7, Jul 2006, Nancy, France.
// pp.23-32. ￿hal-00021443￿
vec2 split (float original, float splitPoint) {
  float c = (pow(2., splitPoint) + 1.) * original;
  float big = c - original;
  float hi = c - big;
  float lo = original - hi;

  return vec2 (hi, lo);
}

// singles -> paired result
vec2 add12 (float x, float y) {
  float sum = x + one * y;
  float v = sum - one * x;
  float rest = (x - one * (sum - one * v)) + one * (y - one *  v);
  return vec2(sum, rest);
}

// singles -> paired result
vec2 mul12 (float a, float b) {
  float product = a * b;
  // debug: this should be unnecessary? already in single-precision?
  // thus the product cannot be affected?
  vec2 a2 = split(a, 16.);
  vec2 b2 = split(b, 16.);
  // vec2 a2 = vec2(a, 0.);
  // vec2 b2 = vec2(b, 0.);

  float e1 = product - (a2.x * b2.x);
  float e2 = e1 - (a2.y * b2.x);
  float e3 = e2 - (a2.x * b2.y);
  float roundoff = (a2.y * b2.y) - e3;

  // return vec2(0.);
  return vec2(product, roundoff);
}

// debug -- Guessing this is needed?
// float compare22 (vec2 a, vec2 b) {
//   float bigResult = step(abs(b.x), abs(a.x));
//   float littleResult = step(abs(b.y), abs(a.y));
//   float same = step(abs(b.x), abs(a.x)) * step(abs(a.x), abs(b.x));

//   return same * littleResult + (1. - same) * bigResult;
// }

// two paired operands -> one paired result
vec2 add22 (vec2 a, vec2 b) {
  float r = a.x + one * b.x;
  float comparison = step(abs(b.x), abs(a.x));
  float s =
    comparison * // If a hi >= b hi...
      (((a.x - one * r) + one * b.x) + one * b.y) + one * a.y

    + (1. - one * comparison) * // else...
      // Warning: The "one *" is necessary to avoid a pathological
      // compiler optimization which otherwise ruins the double precision:
      (((b.x - one * r) + one * a.x) + one * a.y) + one * b.y;

  return add12(r, s);
}

// two paired operands -> one paired result
vec2 mul22 (vec2 a, vec2 b) {
  vec2 t = mul12(a.x, b.x);

  float t3 = ((a.x * b.y) + (a.y * b.x)) + t.y;
  // N.B. this step is misprinted in Graçca and Defour:
  return add12(t.x, t3);
}

float times_frc(float a, float b) {
  return a * b * oneE;
  // return mix(0.0, a * b, b != 0.0 ? 1.0 : 0.0);
}

float plus_frc(float a, float b) {
  return a * oneB + b * oneC;
  // return mix(a, a + b, b != 0.0 ? 1.0 : 0.0);
}

float minus_frc(float a, float b) {
  // Debug -- throwing a lot of stuff out here to see if anything
  // forces Safari/iDevices to work:
  return (a - b) * oneF;
  // return mix(a, a - b, b != 0.0 ? 1.0 : 0.0);
}
`

shaders.passthrough2dVert =
/* glsl */`#version 300 es
precision highp float;
in vec2 pos;

void main (void) {
  gl_Position = vec4(pos.x, pos.y, 0., 1.);
}
`

shaders.singleDoubleMandelbrot =
/* glsl */`#version 300 es
precision highp float;
uniform vec2 offsetX;
uniform vec2 offsetY;
uniform vec2 viewportResolution;
uniform vec2 zoomedReciprocal;
uniform float one;
uniform float oneA;
uniform float oneB;
uniform float oneC;
uniform float oneD;
uniform float oneE;
uniform float oneF;
uniform float oneG;
uniform float oneH;
uniform float overOne;
uniform float underOne;
uniform float osc;
uniform float iterations;
uniform bool useDoublePrecision;
uniform bool AB;

out vec4 fragColor;

${colorFunctions}

${precisionFunctions}

// Emulate double precision using single-precision floats
vec2 addDouble (vec2 a, vec2 b) {
  vec2 result;
  float major, minor, t, e;

  major = a.x + b.x;
  minor = a.y + b.y;
  // Warning: Each use of "one *" in the following section is necessary
  // to prevent a compiler optimization which would ruin the algorithm:
  e = major - one * a.x;
  t = b.x - e + (a.x - (major - e)) + minor;
  result.x = major + t;
  result.y = t - (result.x - one * major);
  return result;
}

// *** REFACTOR THIS OUT:
// testing borrowed code from Shadertoy:
vec2 add (vec2 dsa, vec2 dsb) {
  vec2 dsc;
  float t1, t2, e;

  t1 = plus_frc(dsa.x, dsb.x);
  e = minus_frc(t1, dsa.x);
  t2 = plus_frc(
    plus_frc(
      plus_frc(minus_frc(dsb.x, e), minus_frc(dsa.x, minus_frc(t1, e))),
      dsa.y),
    dsb.y);
  dsc.x = plus_frc(t1, t2);
  dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));
  return dsc;
}

// Substract: res = ds_sub(a, b) => res = a - b
vec2 sub (vec2 dsa, vec2 dsb) {
  vec2 dsc;
  float e, t1, t2;

  t1 = minus_frc(dsa.x, dsb.x);
  e = minus_frc(t1, dsa.x);
  t2 = minus_frc(plus_frc(plus_frc(minus_frc(minus_frc(0.0, dsb.x), e), minus_frc(dsa.x, minus_frc(t1, e))), dsa.y), dsb.y);

  dsc.x = plus_frc(t1, t2);
  dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));
  return dsc;
}

// Multiply: res = ds_mul(a, b) => res = a * b
vec2 mul (vec2 dsa, vec2 dsb) {
  vec2 dsc;
  float c11, c21, c2, e, t1, t2;
  float a1, a2, b1, b2, cona, conb, split = 8193.;

  cona = times_frc(dsa.x, split);
  conb = times_frc(dsb.x, split);
  a1 = minus_frc(cona, minus_frc(cona, dsa.x));
  b1 = minus_frc(conb, minus_frc(conb, dsb.x));
  a2 = minus_frc(dsa.x, a1);
  b2 = minus_frc(dsb.x, b1);

  c11 = times_frc(dsa.x, dsb.x);
  c21 = plus_frc(times_frc(a2, b2), plus_frc(times_frc(a2, b1), plus_frc(times_frc(a1, b2), minus_frc(times_frc(a1, b1), c11))));

  c2 = plus_frc(times_frc(dsa.x, dsb.y), times_frc(dsa.y, dsb.x));

  t1 = plus_frc(c11, c2);
  e = minus_frc(t1, c11);
  t2 = plus_frc(plus_frc(times_frc(dsa.y, dsb.y), plus_frc(minus_frc(c2, e), minus_frc(c11, minus_frc(t1, e)))), c21);

  dsc.x = plus_frc(t1, t2);
  dsc.y = minus_frc(t2, minus_frc(dsc.x, t1));

  return dsc;
}

vec2 set(float a) {
  return vec2(a, 0.0);
}

vec4 dcAdd(vec4 a, vec4 b) {
  return vec4(add(a.xy,b.xy),add(a.zw,b.zw));
}

vec4 dcSub(vec4 a, vec4 b) {
  return vec4(sub(a.xy,b.xy),sub(a.zw,b.zw));
}
// *** REFACTOR THE PRECEDING SECTION OUT

float singlePrecisionMandelbrot (vec2 c) {
  vec2 w;
  float result = 0.;

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

float doublePrecisionMandelbrot (vec2 real, vec2 imaginary) {
  float result = 0.;

  vec2 xx = vec2(0.);
  vec2 yy = vec2(0.);
  vec2 product = vec2(0.);
  vec2 sum = vec2(0.);

  vec2 re;
  vec2 im;

  for (float n = 1.; n <= iterations; n++) {
    im = add(add(add(product, -xx), -yy), imaginary);
    // w.y = product - xx - yy + c.y;
    re = add(add(xx, -yy), real);
    // w.x = xx - yy + c.x;

    xx = mul(re, re);
    // xx = w.x * w.x;
    yy = mul(im, im);
    // yy = w.y * w.y;

    sum = add(re, im);
    // sum = w.x + w.y;
    product = mul(sum, sum);
    // product = sum * sum;

    result += step(result, 0.) * step(4., add(xx, yy)[0]) * n;
    // result += step(result, 0.) * step(4., xx[0] + yy[0]) * n;
  }

  return result;
}

float doublePrecisionMandelbrotB (vec2 real, vec2 imaginary) {
  float result = 0.;

  vec2 xx;
  vec2 yy;
  vec2 product;
  vec2 sum;

  vec2 re;
  vec2 im;

  for (float n = 1.; n <= iterations; n++) {
    im = addDouble(addDouble(addDouble(product, -xx), -yy), imaginary);
    // w.y = product - xx - yy + c.y;
    re = addDouble(addDouble(xx, -yy), real);
    // w.x = xx - yy + c.x;

    xx = mul(re, re);
    // xx = w.x * w.x;
    yy = mul(im, im);
    // yy = w.y * w.y;

    sum = addDouble(re, im);
    // sum = w.x + w.y;
    product = mul(sum, sum);
    // product = sum * sum;

    result += step(result, 0.) * step(4., addDouble(xx, yy)[0]) * n;
    // result += step(result, 0.) * step(4., xx[0] + yy[0]) * n;
  }

  return result;
}

void main (void) {
  bool flag;
  vec2 centeredCoords = vec2(gl_FragCoord) - viewportResolution / 2.;
  vec2 x = vec2(centeredCoords.x, 0.);
  vec2 y = vec2(centeredCoords.y, 0.);

  vec2 real;
  vec2 imaginary;
  float n;
  
  // debug: mul22 behavior slightly different, add22 behavior pathological:
  if (AB) {
    real = mul22(x, zoomedReciprocal);
    imaginary = mul22(y, zoomedReciprocal);

    real = add22(real, offsetX);
    imaginary = add22(imaginary, offsetY);

    if (useDoublePrecision) {
      n = doublePrecisionMandelbrotB(real, imaginary);
  
    } else {
      n = singlePrecisionMandelbrot(vec2(real.x, imaginary.x));
    }

  } else {
    // Normalize the pixel coordinates to the range (-.5, -.5) to (.5, .5):
    real = mul(x, zoomedReciprocal);
    imaginary = mul(y, zoomedReciprocal);

    real = add(real, offsetX);
    imaginary = add(imaginary, offsetY);

    if (useDoublePrecision) {
      n = doublePrecisionMandelbrot(real, imaginary);
  
    } else {
      n = singlePrecisionMandelbrot(vec2(real.x, imaginary.x));
    }
  }

  vec3 lch1 = LChFromSRGB(vec3(0.97, 0.3, 0.5));
  vec3 lch2 = LChFromSRGB(vec3(0.0, 0.2, 0.4));
  vec3 lch3 = LChFromSRGB(vec3(0.8, 0.8, 0.6));
  float t = mod(0.4 + osc + n / 60., 3.);
  vec3 lchMixed =
    (1. - step(1., t)) *
    LChShortestLerp(lch1, lch2, t)
    + (step(1., t)) * (1. - step(2., t)) *
    LChShortestLerp(lch2, lch3, t - 1.)
    + step(2., t) *
    LChShortestLerp(lch3, lch1, t - 2.);

  vec3 sRGB = sRGBfromLCh(lchMixed) * step(0.1, n);

  fragColor = vec4(sRGB, 1.);
}
`
