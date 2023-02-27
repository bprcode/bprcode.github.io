'use strict';

// function buildShaders () {
//   if (buildShaders.shaders) { return buildShaders.shaders }
const shaders = {}
shaders.blurKernelSize = 9

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

shaders.plainColorFrag =
/* glsl */`
precision mediump float;
varying vec4 vColor;

void main (void) {
  gl_FragColor = vColor;
}
`

shaders.greenFromWFrag =
/* glsl */`
precision mediump float;
varying float w;
#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 color =  mix(  vec4(0.9, 0.0, 0.4, a),
                      vec4(0.0, 1.0, 0.7, a),
                      clamp(t, 0., 1.));

  color.r *= 2.5;
  gl_FragColor = color;
}
`

shaders.wFrag_ALTERNATE =
/* glsl */`
precision mediump float;
varying float w;
#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 color =  mix(  vec4(0.05, 0.0, 0.5, a),
                      vec4(0.4, 0.5, 0.9, a),
                      clamp(t, 0., 1.));

  color.r *= 2.5;
  gl_FragColor = color;
}
`

shaders.glassGlitterFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 color =  mix(  vec4(0.9, 0.0, 0.4, a),
                      vec4(0.0, 1.0, 0.7, a),
                      clamp(t, 0., 1.));

  vec4 wLight1 = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLight2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLight3 = normalize(-vec4(0., 0., 0., 1.));
  vec4 wLight4 = normalize(-vec4(0., 0., 1., 0.));
  vec4 normal = normalize(vNormal);
  float s1 = dot(normal, wLight1);
  float s2 = dot(normal, wLight2);
  float s3 = dot(normal, wLight3);
  vec4 lightColor1 = vec4(0.333, 0., 0., 0.);
  vec4 lightColor2 = vec4(0., 0.25, 0.5, 0.);
  vec4 lightColor3 = vec4(0., 0.1, 0.4, 0.);
  vec4 lightColor4 = vec4(0.05, 0.0, 0.2, 0.);
  s1 = clamp(s1, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);
  color = s1 * lightColor1 + s2 * lightColor2 + s3 * lightColor3;
  color.a = a;

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
    pow(specular1, 26.) * (lightColor1 * 3. + vec4(0.3))
    + pow(specular2, 26.) * (lightColor2 * 3. + vec4(0.3))
    + pow(specular3, 26.) * (lightColor1 * 3. + vec4(0.3)) // using 1
    + pow(specular4, 80.) * (lightColor4 * 7. + vec4(0.3));
  gl_FragColor = shine + vec4(1., 0.3, 0., 0.) * pow(a, 4.)/10.;
}
`

shaders.glassDiffuseFrag =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying float w;

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 color;

  vec4 wLight = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLight2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLight3 = normalize(-vec4(0., 0., 0., 1.));
  float s = dot(normalize(vNormal), wLight);
  float s2 = dot(normalize(vNormal), wLight2);
  float s3 = dot(normalize(vNormal), wLight3);
  vec4 lightColor = vec4(0.333, 0., 0., 0.);
  vec4 lightColor2 = vec4(0., 0.25, 0.5, 0.);
  vec4 lightColor3 = vec4(0., 0.1, 0.4, 0.);
  s = clamp(s, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);
  color = s * lightColor + s2 * lightColor2 + s3 * lightColor3;
  color.a = a;

  gl_FragColor = color;
}

`
shaders.glassDiffuseFrag_withWorld =
/* glsl */`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;

#define wMid ${(shaders.wOffset).toFixed(6)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Encode normalized w-component into alpha channel:
  float a = clamp(w / wFar, 0., 1.);

  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 color;

  vec4 wLight = normalize(-vec4(1., 0., -1., 0.));
  vec4 wLight2 = normalize(-vec4(0., 1., 0., 1.));
  vec4 wLight3 = normalize(-vec4(0., 0., 0., 1.));
  float s = dot(normalize(vNormal), wLight);
  float s2 = dot(normalize(vNormal), wLight2);
  float s3 = dot(normalize(vNormal), wLight3);
  vec4 lightColor = vec4(0.333, 0., 0., 0.);
  vec4 lightColor2 = vec4(0., 0.25, 0.5, 0.);
  vec4 lightColor3 = vec4(0., 0.1, 0.2, 0.);
  s = clamp(s, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);
  color = s * lightColor + s2 * lightColor2 + s3 * lightColor3;
  color.a = a;

  gl_FragColor = color
    + vec4(-0.5, 0.1, 0.6, 0.) * 0.5
    // * pow(t,4.);
    * pow(a, 3.);
    // * step(-2., -distance(vec4(0., 0.,-22.,-3), vWorld4d));
//debug -- try this, w values
  // gl_FragColor = vec4(step(22., -vWorld4d.z), 0., 0., 1.);
}
`

shaders.wToAlphaFrag =
/* glsl */`
precision mediump float;
varying float w;
#define wFar 4.0

void main (void) {
  gl_FragColor = vec4(0.,
    0.,
    1.,
    clamp(-w / wFar, 0., 1.)
  );
}
`

shaders.plainTextureFrag =
/* glsl */`
precision mediump float;
varying vec2 vTexel;
uniform sampler2D uTex;

void main (void) {
  gl_FragColor = texture2D(uTex, vTexel);
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

// This vertex shader assumes there are no nonuniform scaling factors
// which would need to be corrected with the inverse transpose.
shaders.redNormalVert =
/* glsl */`
precision mediump float;

attribute vec3 pos;
attribute vec3 normal;
uniform mat4 projection;
uniform mat4 model;
varying vec4 vColor;

void main (void) {
  vec3 cooked = mat3(model) * normal;
  float dp = -dot(normalize(cooked), normalize(vec3(0.5, 0., -1.)));
  dp = clamp(dp, 0., 1.);

  gl_Position = projection * model * vec4(pos, 1.);

  vColor = vec4(
            vec3(1., 0, .3) * dp + vec3(0., 0., .2),
            1.);
}
`

shaders.passNormalVert =
/* glsl */`
precision mediump float;

attribute vec3 pos;
attribute vec3 normal;
varying vec3 vWorld;
varying vec3 vNormal;
uniform mat4 projection;
uniform mat4 model;

void main (void) {
  vNormal = mat3(model) * normal;
  vec4 world = model * vec4(pos, 1.);

  vWorld = vec3(world);
  gl_Position = projection * world;
}
`

shaders.debugSpecularFrag =
/* glsl */`
precision mediump float;
varying vec3 vWorld;
varying vec3 vNormal;

#define pi 3.14159265358979

void main (void) {
  vec4 ambient = vec4(0.12, 0.12, 0.25, 1.);
  vec4 diffuse = vec4(1., 0., 0., 1.);
  vec4 specular = vec4(0., 0.7, 0.8, 1.);
  vec4 specular2 = vec4(0.5, 0., 0.9, 1.);

  vec3 lightDirection = normalize(-vec3(0.1, -0.5, -1.));
  vec3 lightDirection2 = normalize(-vec3(0.0, 0.0, 1.0));
  vec3 viewDirection = normalize(vWorld);
  vec3 normal = normalize(vNormal);

  float d = clamp(dot(normal, lightDirection), 0., 1.);
  float s = clamp(
      dot(
        reflect(viewDirection, normal),
        lightDirection
      ),
    0., 1.);
  float s2 = clamp(
      dot(
        reflect(viewDirection, normal),
        lightDirection2
      ),
    0., 1.);

  gl_FragColor =
    ambient
    + pow(s, 10.) * specular
    + pow(s2, 10.) * specular2;
}
`

shaders.blurCompositorFrag =
/* glsl */`
precision mediump float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform sampler2D depthTex;
varying vec2 vTexel;

uniform float zFocalDistance;
uniform float zFieldWidth;
uniform float wFocalDistance;
uniform float wFieldWidth;

uniform float zNear;
uniform float zFar;

// Diminishing returns function; starts linear,
// but asymptotically tends to 1 as x → ∞.
float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  // extract z-depth from depth buffer
  float originalDepth = texture2D(depthTex, vTexel).r;

  // retrieve z in NDC:
  float depth = originalDepth * 2. - 1.;
  // invert perspective projection (yields the negative of zEye):
  depth = 2. * zNear * zFar / (zNear + zFar - depth * (zFar - zNear));

  // obtain w-component from α channel, where it is intended to be stored:
  float w = clear.a;

  // Compromise between vertical and horizontal asymptotic behavior
  // of the circle-of-confusion diameter, so that the blurring effect
  // is suggestive of the physically correct functional dependence
  // despite the limited blur radius allowed by this rendering approach:
  float kz = (zFocalDistance + zFieldWidth) / zFieldWidth;
  float kw = (wFocalDistance + wFieldWidth) / wFieldWidth;

  float fz = diminish(kz * abs(depth - zFocalDistance) / depth);
  float fw = diminish(kw * abs(w - wFocalDistance) / w);

  // Treat depth = 1 as infinity, and always set it out of focus:
  fz = clamp(fz + step(1.0, originalDepth), 0., 1.);
  // Likewise, treat α = 1 as infinity, and always set it out of focus:
  fw = clamp(fw + step(1.0, clear.a), 0., 1.);

  // for general functional dependence, c.f.:
  // https://www.researchgate.net/publication/
  // 272483151_Depth_recovery_and_refinement_
  // from_a_single_image_using_defocus_cues
  vec4 color =
    mix(clear, blurry,
      clamp(
        // Combine the two blurring factors such that either one can
        // create crisp focus, yet they produce strong blur
        // when out-of-focus
        1. - pow(1. - fz * fw, 4.)
        // 
      , 0., 1.));

  gl_FragColor = color;
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

// Main projection pipeline from 4d space:
// 1. Apply 4d linear transforms (no affine)
// 2. Translate all w-coordinates
//   (2b. pass w-coordinates to the frag shader separately)
// 3. Perspective-project from 4d to 3d, set w to 1
// 4. Apply 3d affine transforms
// 5. Project from 3d to 2d NDC
// ~
shaders.projector4dVert = 
/* glsl */ `
precision mediump float;

attribute vec4 pos;
varying float w;

uniform mat4 M4;
uniform mat4 M3;
uniform mat4 projection;

void main (void) {
  const float wOffset = ${(shaders.wOffset).toFixed(6)};
  const float wNear = 1.0;
  vec4 v = pos;

  v = M4 * v;
  v.w += wOffset;
  w = v.w; // pass transformed w-value to fragment shader

  float s = wNear / (-v.w);
  mat4 P4to3 = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = P4to3 * v;
  v.w = 1.;

  gl_Position = projection * M3 * v;
}

`
shaders.quatProjectorVert = 
/* glsl */ `
precision mediump float;

attribute vec4 pos;
varying float w;

uniform mat4 M3;
uniform mat4 projection;

// Transform each vertex v by qvp (model) before 4D->3D projection,
// and qvp (view) after.
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

  v = qvp(qModelL, v, qModelR);
  v.w += wOffset;
  w = v.w; // pass transformed w-value to fragment shader

  float s = wNear / (-v.w);
  mat4 P4to3 = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = P4to3 * v;
  v.w = 1.;

  v = qvp(qViewL, v, qViewR);

  gl_Position = projection * M3 * v;
}
`

shaders.normals4dVert_ALTERNATE = 
/* glsl */ `
precision mediump float;

attribute vec4 pos;
attribute vec4 normal;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;

uniform mat4 M4;
uniform mat4 M3;
uniform mat4 projection;

void main (void) {
  const float wOffset = ${(shaders.wOffset).toFixed(6)};
  const float wNear = 1.0;
  vec4 p = pos;

  // To transform the normals (without using inverse transpose):
  // Apply M4 (assumed to contain just rotations or uniform scaling)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4 n = M4 * normal;
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = vec4(n3, n.w);

  p = M4 * p;
  p.w += wOffset;

  w = p.w; // pass transformed w-value to fragment shader

  vec3 unprojected = vec3(p); // Transformed x, y, z, sans projection.

  float s = wNear / (-p.w);
  mat4 P4to3 = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  p = P4to3 * p;
  p.w = 1.;

  vWorld4d = vec4(vec3(M3 * vec4(unprojected, 1.)), w);
  gl_Position = projection * M3 * p;
}
`

shaders.quatNormalsWorldVert = 
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

shaders.normals4dVert = 
/* glsl */ `
precision mediump float;

attribute vec4 pos;
attribute vec4 normal;
varying vec4 vNormal;
varying float w;

uniform mat4 M4;
uniform mat4 M3;
uniform mat4 projection;

void main (void) {
  const float wOffset = ${(shaders.wOffset).toFixed(6)};
  const float wNear = 1.0;
  vec4 v = pos;

  // To transform the normals (without using inverse transpose):
  // Apply M4 (assumed to contain just rotations or uniform scaling)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4 n = M4 * normal;
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = vec4(n3, n.w);

  v = M4 * v;
  v.w += wOffset;

  w = v.w; // pass transformed w-value to fragment shader

  float s = wNear / (-v.w);
  mat4 P4to3 = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = P4to3 * v;
  v.w = 1.;

  gl_Position = projection * M3 * v;
}
`

shaders.projector3dVert =
/* glsl */ `
precision mediump float;

attribute vec3 pos;
uniform mat4 projection;

void main (void) {
  gl_Position = projection * vec4(pos, 1.0);
}
`

//   return buildShaders.shaders = shaders
// }
