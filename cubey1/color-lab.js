// Color conversion functions -- can be prepended to GLSL source string
const colorShaderCommonHeader =
/* glsl */`
#define pi 3.14159265359
#define tau 6.28318530718

precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float osc;
uniform float brightness;
uniform vec3 firstColor;
uniform vec3 secondColor;`

const labLibraryFunctions =
/* glsl */`

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
    mix(LCh1[0], LCh2[0], t),
    mix(LCh1[1], LCh2[1], t),
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
    mix(LCh1[0], LCh2[0], t),
    mix(LCh1[1], LCh2[1], t),
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