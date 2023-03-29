'use strict';

// function buildShaders () {
//   if (buildShaders.shaders) { return buildShaders.shaders }
const shaders = {}
shaders.blurKernelSize = 32

// The desired projection ratio for a cube with side length 2 is used
// to determine where to center an object, by default, in w-space:
const wRatio = 0.5
shaders.wOffset = (wRatio + 1) / (wRatio - 1)
console.log('Using wOffset = ' + shaders.wOffset
  + ' for projection ratio ' + wRatio)
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

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

uniform vec4 nearFrameColor;
uniform vec4 farFrameColor;

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 wLight1 = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLight2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLight3 = normalize(-vec4(-1., -1., 1., 0.));
  vec4 wLight4 = normalize(-vec4(0., 0., 1., 0.));
  vec4 normal = normalize(vNormal);
  float s1 = dot(normal, wLight1);
  float s2 = dot(normal, wLight2);
  float s3 = dot(normal, wLight3);
  s1 = clamp(s1, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);

  // debug -- specular testing:
  vec4 viewDirection = normalize(vWorld4d);
  vec4 reflected = reflect(viewDirection, normal);
  float specular1 = clamp(
    abs(dot(reflected, wLight1)),
    0., 1.);
  float specular2 = clamp(
    abs(dot(reflected, wLight2)),
    0., 1.);
  float specular3 = clamp(
    abs(dot(reflected, wLight3)),
    0., 1.);
  float specular4 = clamp(
    abs(dot(reflected, wLight4)),
    0., 1.);

  // This part is specific to the border rendering:
  // (need to set a to zero to avoid disrupting the depth value)
  vec4 frameColor =  mix( nearFrameColor, farFrameColor,
    clamp(t, 0., 1.));

  vec4 shine =
    pow(specular1, 26.) * specularColor1 * 3.
    + pow(specular2, 26.) * specularColor2 * 3.
    + pow(specular3, 26.) * specularColor3 * 3.
    + pow(specular4, 80.) * specularColor4 * 7.;
  gl_FragColor = shine * frameSpecularWeight + frameColor;
}
`

shaders.glitterFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;
uniform float opacity;

uniform vec4 specularColor1;
uniform vec4 specularColor2;
uniform vec4 specularColor3;
uniform vec4 specularColor4;

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 wLight1 = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLight2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLight3 = normalize(-vec4(-1., -1., 1., 0.));
  vec4 wLight4 = normalize(-vec4(0., 0., 1., 0.));
  vec4 normal = normalize(vNormal);
  float s1 = dot(normal, wLight1);
  float s2 = dot(normal, wLight2);
  float s3 = dot(normal, wLight3);
  s1 = clamp(s1, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);
  vec4 color = vec4(
    s1 * specularColor1 + s2 * specularColor2 + s3 * specularColor3
  );

  // debug -- specular testing:
  vec4 viewDirection = normalize(vWorld4d);
  vec4 reflected = reflect(viewDirection, normal);
  float specular1 = clamp(
    abs(dot(reflected, wLight1)),
    0., 1.);
  float specular2 = clamp(
    abs(dot(reflected, wLight2)),
    0., 1.);
  float specular3 = clamp(
    abs(dot(reflected, wLight3)),
    0., 1.);
  float specular4 = clamp(
    abs(dot(reflected, wLight4)),
    0., 1.);

  vec4 shine =
      pow(specular1, 26.) * (specularColor1 * 3.)
    + pow(specular2, 26.) * (specularColor2 * 3.)
    + pow(specular3, 26.) * (specularColor3 * 3.)
    + pow(specular4, 80.) * (specularColor4 * 7.);
  gl_FragColor = shine * opacity;
}
`

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

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  // Calculate a color contribution based on path length
  // through a supposed pane of semitranslucent material
  float dp = dot(normalize(vWorld4d), normalize(vNormal));
  dp = abs(dp);
  dp = clamp(dp, 0.000001, 1.);
  // This is asymptotic, but the effect is nice:
  // float thickness = 0.05 / dp;
  // These are more numerically sensible:
  float thickness = pow((diminish(0.8 / dp) - 0.444)*1.79856, 2.);
  // float thickness = smoothstep(0., 2., 0.05 / dp);
  // float thickness = diminish(pow(0.05 / dp, 2.));

  vec4 membranePart = membraneColor * thickness;

  // Diffuse light pane contributions:
  vec4 wLightDir1 = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLightDir2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLightDir3 = normalize(-vec4(0., 0., 0., 1.));
  float s1 = dot(normalize(vNormal), wLightDir1);
  float s2 = dot(normalize(vNormal), wLightDir2);
  float s3 = dot(normalize(vNormal), wLightDir3);
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

shaders.alphaCompositorFrag =
/* glsl */`
precision mediump float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform sampler2D depthTex;
varying vec2 vTexel;

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  gl_FragColor = mix(blurry, clear, clear.a);
}
`

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
  const float wOffset = ${(shaders.wOffset).toFixed(6)};
  const float wNear = 1.0;
  vec4 v = pos;

  // To transform the normals (without using inverse transpose):
  // Apply qvp (model)
  // Apply qvp (view)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4  n = qvp(qModelL, normal, qModelR);
  n = qvp(qViewL, n, qViewR);
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = vec4(n3, n.w);

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

  // debug -- not sure if this is right. It's probably either 1 or 0.
  vWorld4d = vec4(vec3(M3 *
    qvp(qViewL, vec4(unprojected, 1.), qViewR)),
    w);

  v = qvp(qViewL, v, qViewR);
  gl_Position = projection * M3 * v;
}
`
//   return buildShaders.shaders = shaders
// }