'use strict';
// Copyright © 2023 Bryan Rauen.
// All rights reserved. https://bprcode.github.io/

export const shaders = {}
shaders.blurKernelSize = 8

// The desired projection ratio for a cube with side length 2 is used
// to determine where to center an object, by default, in w-space:
const wRatio = 0.5
shaders.wOffset = (wRatio + 1) / (wRatio - 1)

if (Math.abs(shaders.wOffset + 2) < 0.01) {
  console.warn('The specified projection is too close'
    + ' to the projection plane and may result in visual artifacts.')
}

// Combines specular and base frame color:
shaders.borderFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;
uniform float frameSpecularWeight;

uniform vec4 specularColor1;
uniform vec4 specularColor2;
uniform vec4 specularColor3;
uniform vec4 specularColor4;
uniform vec4 specularDirection1;
uniform vec4 specularDirection2;
uniform vec4 specularDirection3;
uniform vec4 specularDirection4;

#define wMid ${(shaders.wOffset).toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

uniform vec4 nearFrameColor;
uniform vec4 farFrameColor;

void main (void) {
  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 reflected = reflect(vWorld4d, vNormal);
  float specular1 = clamp(
    dot(reflected, specularDirection1),
    0., 1.);
  float specular2 = clamp(
    dot(reflected, specularDirection2),
    0., 1.);
  float specular3 = clamp(
    dot(reflected, specularDirection3),
    0., 1.);
  float specular4 = clamp(
    dot(reflected, specularDirection4),
    0., 1.);

  // This part is specific to the border rendering:
  vec4 frameColor =  mix(nearFrameColor, farFrameColor,
    clamp(t, 0., 1.));

  vec4 shine =
      pow(specular1, 26.) * specularColor1
    + pow(specular2, 26.) * specularColor2
    + pow(specular3, 26.) * specularColor3
    + pow(specular4, 80.) * specularColor4;
  gl_FragColor = shine * frameSpecularWeight + frameColor;
}
`

// Shade specular planes:
shaders.glitterFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
uniform float opacity;

uniform vec4 specularColor1;
uniform vec4 specularColor2;
uniform vec4 specularColor3;
uniform vec4 specularColor4;
uniform vec4 specularDirection1;
uniform vec4 specularDirection2;
uniform vec4 specularDirection3;
uniform vec4 specularDirection4;

#define wMid ${(shaders.wOffset).toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Use world position vector as the view direction:
  vec4 reflected = reflect(vWorld4d, vNormal);

  float specular1 = clamp(
    dot(reflected, specularDirection1),
    0., 1.);
  float specular2 = clamp(
    dot(reflected, specularDirection2),
    0., 1.);
  float specular3 = clamp(
    dot(reflected, specularDirection3),
    0., 1.);
  float specular4 = clamp(
    dot(reflected, specularDirection4),
    0., 1.);

  vec4 shine =
      pow(specular1, 26.) * specularColor1
    + pow(specular2, 26.) * specularColor2
    + pow(specular3, 26.) * specularColor3
    + pow(specular4, 80.) * specularColor4;
  gl_FragColor = shine * opacity;
}
`

// Shade diffuse planes (and a fourth-dimensional depth-based glow effect):
shaders.diffuseFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;
uniform float opacity;

uniform vec4 glowColor;
uniform vec4 membraneColor;
uniform vec4 diffuseColor1;
uniform vec4 diffuseColor2;
uniform vec4 diffuseColor3;
uniform vec4 diffuseDirection1;
uniform vec4 diffuseDirection2;
uniform vec4 diffuseDirection3;

#define wMid ${(shaders.wOffset).toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

void main (void) {
  // Use w-depth to compute a "glow fog" effect:
  float a = clamp(w / wFar, 0., 1.);

  // Calculate a color contribution based on path length
  // through a supposed pane of semitranslucent material
  float dp = dot(vWorld4d, vNormal);
  dp = abs(dp);
  dp = clamp(dp, 0.000001, 1.);

  float thickness = pow((diminish(0.8 / dp) - 0.444)*1.79856, 2.);

  vec4 membranePart = membraneColor * thickness;

  // Diffuse light pane contributions:
  float s1 = dot(vNormal, diffuseDirection1);
  float s2 = dot(vNormal, diffuseDirection2);
  float s3 = dot(vNormal, diffuseDirection3);
  s1 = clamp(s1, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);

  gl_FragColor = opacity * (
    s1 * diffuseColor1 + s2 * diffuseColor2 + s3 * diffuseColor3
    + glowColor * pow(a, 3.)
    + membranePart
  );
}
`

// Basic pass-through vertex shader with texture coordinates:
shaders.textureVert =
/* glsl */`
precision mediump float;
attribute vec3 pos;
attribute vec2 aTexel;
varying vec2 vTexel;

void main (void) {
  gl_Position = vec4(pos, 1.);
  vTexel = vec2(aTexel);
}
`

// Weighted mix of blurry and clear textures, based on alpha value:
shaders.alphaCompositorFrag =
/* glsl */`
precision mediump float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform float clarityScale;
varying vec2 vTexel;

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  gl_FragColor = mix(blurry, clear, clear.a * clarityScale);
}
`

// Final stage of rendering pipeline, producing a weighted mix of
// the blurry and clear textures, overlaid with a variable lens texture
shaders.lensCompositorFrag =
/* glsl */`
precision mediump float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform sampler2D lensTex;
uniform float clarityScale;
uniform float seconds;
varying vec2 vTexel;

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

// Variable extra-smooth downward step:
// https://www.desmos.com/calculator/mxoykritdy
float smoothDrop (float bound, float exponent, float x) {
  float w = x / bound;
  float smoothed = w*w*w* (6.*w*w - 15.*w + 10.);
  return clamp(
      1. - pow(w, exponent),
    0., 1.);
}

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);
  float rate = 40.;
  float clockFast = seconds / rate;
  float clockMed = seconds / (rate * 2.);
  float clockSlow = seconds / (rate * 4.);
  vec4 lens =
    0.15*texture2D(lensTex,
    // Invert x & y to vary texture:
    vec2( -vTexel.x / 1.5 - clockSlow,
          -vTexel.y / 1.5 + clockSlow))
    + 0.8*texture2D(lensTex,
    // Switch x & y to vary texture:
    vec2( vTexel.y / 3.,
          vTexel.x / 3. - clockMed))
    + 2.45*texture2D(lensTex,
      vec2( vTexel.x / 6.,
            vTexel.y / 6. + clockFast))
    ;

  vec4 mixed = mix(blurry, clear, clear.a * clarityScale);
  float luminance =
      0.2126 * blurry.r
    + 0.7152 * blurry.g
    + 0.0722 * blurry.b;

  float signal = smoothDrop(1., 1., luminance);

  // Soft cloud effect:
  float soft = pow(1.5*diminish(lens.a), 3.);

  float dropCloud = smoothDrop(1., 0.45, soft);
  float boost = 20. * smoothDrop(1., 0.2, luminance);

  // Weight the cloud color components to favor red light:
  gl_FragColor =
    mixed
    + vec4(mixed.r, mixed.g*0.5, mixed.b*0.8, mixed.a)
      * boost * pow(signal,1.) * pow(dropCloud,1.3);
}
`

// Compute a one-dimensional blur effect, based on a given kernel:
shaders.blur1dFrag =
/* glsl */`
precision mediump float;
varying vec2 vTexel;

uniform sampler2D uTex;
#define kernelSize ${shaders.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(uTex, vTexel) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(uTex, vTexel - float(i)*dv) * kernel[i]
            +texture2D(uTex, vTexel + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`

// Vertex project from fourth-dimensional space, applying quaternions:
shaders.projectorVert = 
/* glsl */ `
precision mediump float;

attribute vec4 pos;
attribute vec4 normal;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;

uniform mat4 M3;
uniform mat4 projection;
uniform vec4 qModelL;
uniform vec4 qModelR;
uniform vec4 qViewL;
uniform vec4 qViewR;

// Quaternion product q*p, in xi+yj+zk+w form
vec4 qmul (vec4 q, vec4 p) {
  return vec4(
    q[3]*p[0] + q[0]*p[3] + q[1]*p[2] - q[2]*p[1],
    q[3]*p[1] - q[0]*p[2] + q[1]*p[3] + q[2]*p[0],
    q[3]*p[2] + q[0]*p[1] - q[1]*p[0] + q[2]*p[3],
    q[3]*p[3] - q[0]*p[0] - q[1]*p[1] - q[2]*p[2]
  );
}

// Quaternion product q*v*p
vec4 qvp (vec4 q, vec4 v, vec4 p) {
  return qmul(q, qmul(v,p));
}

void main (void) {
  const float wOffset = ${(shaders.wOffset).toFixed(9)};
  const float wNear = 1.0;
  vec4 v = pos;

  // To transform the normals (without using inverse transpose):
  // Apply qvp (model)
  // Apply qvp (view)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4 n = qvp(qModelL, normal, qModelR);
  n = qvp(qViewL, n, qViewR);
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = normalize(vec4(n3, n.w));

  v = qvp(qModelL, v, qModelR);
  v.w += wOffset;

  w = v.w; // pass transformed w-value to fragment shader

  vec3 unprojected = vec3(v); // Transformed x, y, z, sans projection.

  float s = wNear / (-v.w);
  mat4 P4to3 = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = P4to3 * v;
  v.w = 1.;

  // Normalizing vWorld4d in the vertex shader rather than fragment shader
  // is slightly inaccurate, but unnoticeably so.
  vWorld4d = normalize(
    vec4(vec3(M3 *
    qvp(qViewL, vec4(unprojected, 1.), qViewR)),
    w)
  );

  v = qvp(qViewL, v, qViewR);
  gl_Position = projection * M3 * v;
}
`
