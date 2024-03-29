'use strict';

function buildShaders () {
  const shaders = {}
  shaders.blurKernelSize = 7

  shaders.passthroughFrag =
  /* glsl */`
  precision mediump float;
  varying vec4 vColor;

  void main (void) {
    gl_FragColor = vColor;
  }
  `

  shaders.focusVert =
  /* glsl */`
  precision mediump float;

  attribute vec3 pos;
  attribute vec3 normal;
  uniform mat4 projection;
  uniform mat4 modelview;
  varying vec4 vColor;

  void main (void) {
    const vec3 lightDirection = normalize(vec3(0.5, 0., -1.));

    vec3 cooked = mat3(modelview) * normal;
    float dp = -dot(normalize(cooked), lightDirection);
    dp = clamp(dp, 0., 1.);

    vec4 v = modelview * vec4(pos, 1.);
    gl_Position = projection * v;

    vColor = vec4(
              vec3(1., 0, .3) * dp + vec3(0., 0., .2),
              1.
              //clamp((v.x + 2.5) / 5., 0., 1.)
              // clamp(1. - abs(v.z + 30.0) / 8.0, 0., 1.)
              );
  }
  `

  shaders.experimentalBloom =
  /* glsl */`
  precision mediump float;
  varying vec2 vTexel;

  uniform sampler2D uTex;
  uniform float kernel[5];
  uniform vec2 blurStep;

  void main (void) {
    vec2 dv = blurStep;

    // double-weight on 0 element:
    vec4 blurColor = texture2D(uTex, vTexel) * kernel[0];
    blurColor += texture2D(uTex, vTexel - 1.*dv) * kernel[1]
                +texture2D(uTex, vTexel + 1.*dv) * kernel[1];
    blurColor += texture2D(uTex, vTexel - 2.*dv) * kernel[2]
                +texture2D(uTex, vTexel + 2.*dv) * kernel[2];
    blurColor += texture2D(uTex, vTexel - 3.*dv) * kernel[3]
                +texture2D(uTex, vTexel + 3.*dv) * kernel[3];
    blurColor += texture2D(uTex, vTexel - 4.*dv) * kernel[4]
                +texture2D(uTex, vTexel + 4.*dv) * kernel[4];

    gl_FragColor = mix(texture2D(uTex, vTexel), blurColor,
                    1. - gl_FragCoord.x / 128.);
  }
  `

  shaders.vertsWithNormals =
  /* glsl */`
  precision highp float;

  attribute vec3 pos;
  attribute vec3 normal;
  uniform mat4 projection;
  uniform mat4 modelview;
  varying vec4 vColor;

  void main (void) {
    vec3 cooked = mat3(modelview) * normal;
    float dp = -dot(normalize(cooked), normalize(vec3(0.5, 0., -1.)));
    dp = clamp(dp, 0., 1.);

    gl_Position = projection * modelview * vec4(pos, 1.);

    vColor = vec4(
              vec3(1., 0, .3) * dp + vec3(0., 0., .2),
              1.);
  }
  `

shaders.depthVertHack =
/* glsl */`
precision highp float;

attribute vec3 pos;
uniform mat4 projection;
uniform mat4 modelview;
varying vec4 vColor;

void main (void) {
  vec4 position = projection * modelview * vec4(pos, 1.);
  gl_Position = position;
  vColor = position;
}
`

shaders.depthFragHack =
/* glsl */`
precision highp float;

varying vec4 vColor;

void main(void) {
  gl_FragColor = vec4(vColor.z/40., vColor.z/40., vColor.z/40., 1.);
}
`

shaders.justDepthVert =
/* glsl */`
precision highp float;

attribute vec3 pos;
uniform mat4 projection;
uniform mat4 modelview;
varying vec4 vColor;

void main (void) {
  gl_Position = projection * modelview * vec4(pos, 1.);
  vColor = vec4(0., 0.5, 1., 1.);
}
`

  shaders.projectingTexturer =
  /* glsl */`
  precision mediump float;

  attribute vec3 pos;
  attribute vec2 aTexel;
  varying vec2 vTexel;
  uniform mat4 projection;
  uniform mat4 modelview;

  void main (void) {
    gl_Position = projection * modelview * vec4(pos, 1.);
    vTexel = vec2(aTexel);
  }
  `

  // Basic texture demo
  shaders.textureVert =
  /* glsl */`
  precision highp float;
  attribute vec3 pos;
  attribute vec2 aTexel;
  varying vec2 vTexel;

  void main (void) {
    gl_Position = vec4(pos, 1.);
    vTexel = vec2(aTexel);
  }
  `

  shaders.depthExperimentFrag =
  /* glsl */`
  precision highp float;
  varying vec2 vTexel;
  uniform sampler2D uTex;

  void main (void) {
    // float n = 0.451;
    // float f = 1000.0;
    // float z = texture2D(uTex, vTexel.st).x;
    // float grey = (2.0 * n) / (f + n - z*(f-n));
    // vec4 color = vec4(grey, grey, grey, 1.0);
    // gl_FragColor = color;
    float r = texture2D(uTex, vTexel).r;

    // exaggerate depth variation:
    vec4 color = vec4(pow(r, 4.),
                  0., 0., 1.);
    // color.r = step(1.0, color.r);
    gl_FragColor = color;
  }
  `

  shaders.debugTextureVert =
  /* glsl */`
  precision mediump float;
  attribute vec3 pos;
  varying vec2 vTexel;

  void main (void) {
    gl_Position = vec4(pos,1.);
    vTexel = pos.xy * .5 + .5;
  }
  `
  
  shaders.debugTextureFrag =
  /* glsl */`
  precision mediump float;
  varying vec2 vTexel;
  uniform sampler2D uTex;

  void main (void) {
    vec4 color = texture2D(uTex, vTexel);
    gl_FragColor = vec4(color.r, 0., 0., 1.);
  }
  `

  shaders.blurCompositorFrag =
  /* glsl */`
  precision mediump float;
  uniform sampler2D blurTex;
  uniform sampler2D clearTex;
  uniform sampler2D depthTex;
  varying vec2 vTexel;

  void main (void) {
    float depth = texture2D(depthTex, vTexel).r;
    float focalDistance = 0.984;
    float fieldWidth = 0.004;

    gl_FragColor =
      mix(
      texture2D(clearTex, vTexel),
      texture2D(blurTex, vTexel),
        clamp(
          abs(depth - focalDistance)/fieldWidth
        , 0., 1.));
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

  shaders.bloom1d =
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
    // color += texture2D(uTex, vTexel - 1.*dv) * kernel[1]
    //         +texture2D(uTex, vTexel + 1.*dv) * kernel[1];
    // color += texture2D(uTex, vTexel - 2.*dv) * kernel[2]
    //         +texture2D(uTex, vTexel + 2.*dv) * kernel[2];
    // color += texture2D(uTex, vTexel - 3.*dv) * kernel[3]
    //         +texture2D(uTex, vTexel + 3.*dv) * kernel[3];
    // color += texture2D(uTex, vTexel - 4.*dv) * kernel[4]
    //         +texture2D(uTex, vTexel + 4.*dv) * kernel[4];

    gl_FragColor = color;
  }
  `

  shaders.textureFrag =
  /* glsl */`
  precision mediump float;
  #define tau 6.283185307
  varying vec2 vTexel;
  uniform sampler2D uTex;
  uniform float uSize;
  uniform float osc;
  uniform float time;
  uniform float kernel[9];

  // float warp () {
  //   return pow(cos(tau*mod(time, 10000.)/10000.), 2.);
  // }

  void main (void) {
    // gl_FragColor = vec4(abs(vTexel.x), (vTexel.y+1.)/2., 0.0, 1.0);
    // gl_FragColor = mix(texture2D(uTex, vTexel), vec4(1.,0.,0.,1.), vTexel.x);
    // vec4 color = texture2D(uTex, vTexel);
    float dx = 1. / uSize;
    float dy = 1. / uSize;
    vec4 color;
    color =
        texture2D(uTex, vec2(vTexel.x - dx, vTexel.y + dy)) * kernel[0]
      + texture2D(uTex, vec2(vTexel.x,      vTexel.y + dy)) * kernel[1]
      + texture2D(uTex, vec2(vTexel.x + dx, vTexel.y + dy)) * kernel[2]
      + texture2D(uTex, vec2(vTexel.x - dx,      vTexel.y)) * kernel[3]
      + texture2D(uTex, vec2(vTexel.x,           vTexel.y)) * kernel[4]
      + texture2D(uTex, vec2(vTexel.x + dx,      vTexel.y)) * kernel[5]
      + texture2D(uTex, vec2(vTexel.x - dx, vTexel.y - dy)) * kernel[6]
      + texture2D(uTex, vec2(vTexel.x,      vTexel.y - dy)) * kernel[7]
      + texture2D(uTex, vec2(vTexel.x + dx, vTexel.y - dy)) * kernel[8];

    // dx *= cos(osc * tau);
    // dy *= sin(osc * tau);
    // dx *= warp();
    // dy *= warp();
    // color = 
    //         + 0.5 * texture2D(uTex, vec2(vTexel.x - dx, vTexel.y - dy))
    //         + 0.5 * texture2D(uTex, vec2(vTexel.x + dx, vTexel.y + dy));
    gl_FragColor = color;
  }
  `

  // Example oblique projection shader
  shaders.oblique3d =
  /* glsl */`
  precision highp float;
  #define k 0.1
  attribute vec3 pos;
  const mat4 P = mat4(
    0.25,  0.,   0.,     0.,
    0.,   0.25,  0.,     0.,
    k,    k,    -0.002,  0.,
    0.,   0.,   -0.5,    1.
  );

  void main (void) {
    gl_Position = P * vec4(pos, 1.0);
  }
  `

  // For testing purposes, draw a double-oblique projection from 4-space.
  shaders.oblique4d =
  /* glsl */`
  precision highp float;
  attribute vec4 pos;
  #define k 0.1
  #define q 1.2

  void main (void) {
    const mat4 Q = mat4(
      1.,   0.,   0.,   0.,
      0.,   1.,   0.,   0.,
      0.,   0.,   1.,   0.,
      -q,   q,   0.,   0.
    );

    const mat4 P = mat4(
      0.25,  0.,   0.,     0.,
      0.,   0.25,  0.,     0.,
      k,    k,    -0.002,  0.,
      0.,   0.,   -0.5,    1.
    );

    vec4 v = Q * pos + vec4(0., 0., 0., 1.);
    gl_Position = P * v;
  }
  `

  // WIP projector from 4d to 3d, then to NDC
  shaders.scaleThenOblique4d =
  /* glsl */ `
  precision highp float;
  #define k 0.1
  attribute vec4 pos;
  varying vec4 vColor;
  const float nearW = 0.9;
  const mat4 P = mat4(
      0.25,  0.,   0.,     0.,
      0.,   0.25,  0.,     0.,
      k,    k,    -0.002,  0.,
      0.,   0.,   -0.5,    1.
    );

  void main (void) {
    vec4 u = pos;
    u.w -= 2.;
    float s = -nearW / u.w;

    mat4 Q = mat4(
      s,   0.,  0., 0.,
      0.,  s,   0., 0.,
      0.,  0.,  s,  0.,
      0.,  0.,  0., 0.
    );

    vec4 v = Q * u + vec4(0., 0., 0., 1.);

    vColor = vec4(0., -u.w/4., 0., 0.);
    gl_Position = P * v;
  }
  `

  // Main projection pipeline from 4d space:
  // 1. Apply 4d linear transforms (no affine)
  // 2. Translate all w-coordinates
  // 3. Perspective-project from 4d to 3d, set w to 1
  // 4. Apply 3d affine transforms
  // 5. Project from 3d to 2d NDC
  // ~
  shaders.vertexProjector4d = 
  /* glsl */ `
  precision highp float;

  attribute vec4 pos;
  varying vec4 vColor;

  uniform mat4 MV4;
  uniform mat4 MV3;
  uniform mat4 projection;

  void main (void) {
    const float wOffset = -2.0;
    const float wNear = 1.0;
    vec4 v = pos;
    v = MV4 * v;
    vColor = mix( vec4(0.9, 0.0, 0.4, 1.),
                  vec4(0.0, 1.0, 0.7, 1.),
                  clamp((-v.w+1.)/2., 0., 1.));

    v.w += wOffset;

    float s = -wNear / (-wNear + v.w);
    mat4 P4to3 = mat4(
      s,  0., 0., 0.,
      0., s,  0., 0.,
      0., 0., s,  0.,
      0., 0., 0., 0.
    );

    v = P4to3 * v;
    v.w = 1.;

    gl_Position = projection * MV3 * v;
  }
  `

  // Double-oblique projection from 4d space, applying modelview matrices
  // at each step.
  shaders.oblique4dMV = 
  /* glsl */ `
  precision highp float;

  attribute vec4 pos;
  varying vec4 vColor;

  uniform mat4 MV4;
  uniform mat4 MV3;

  #define k 0.1
  #define q 1.2

  void main (void) {
    const mat4 Q = mat4(
      1.,   0.,   0.,   0.,
      0.,   1.,   0.,   0.,
      0.,   0.,   1.,   0.,
      q,   -q,   0.,   0.
    );

    const mat4 P = mat4(
      0.25,  0.,   0.,     0.,
      0.,   0.25,  0.,     0.,
      k,    k,    -0.002,  0.,
      0.,   0.,   -0.5,    1.
    );

    vec4 v = pos;
    v = MV4 * v;

    vColor = mix( vec4(0.9, 0.0, 0.4, 1.),
                  vec4(0.0, 1.0, 0.7, 1.),
                  clamp((-v.w+1.)/2., 0., 1.));

    v = Q * v;
    v.w = 1.;
    // v = MV3 * v; Not for oblique.
    v = P * v;

    gl_Position = v;
  }
  `

  shaders.vertexProjector =
  /* glsl */ `
  precision highp float;

  attribute vec3 pos;
  uniform mat4 projection;

  void main (void) {
    gl_Position = projection * vec4(pos, 1.0);
  }
  `

  shaders.blueShader =
  /* glsl */`
  precision highp float;

  void main (void) {
    gl_FragColor = vec4(0., 0.3, 1., 1.);
  }
  `

  shaders.wShader =
  /* glsl */`
  precision highp float;
  varying vec4 vColor;

  void main (void) {
    gl_FragColor = vColor;
  }
  `

  shaders.basicFragmentShader = 
  /* glsl */`#version 300 es
  precision highp float;

  in vec3 fragColor;
  out vec4 resultColor;

  void main(void){
    resultColor = vec4(fragColor, 1.0);
  }
  `

  return shaders
}