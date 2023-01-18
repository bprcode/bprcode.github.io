const shaders = {}

function buildShaders () {
  shaders.vertsWithNormals =
  /* glsl */`
  precision highp float;

  attribute vec3 pos;
  attribute vec3 normal;
  uniform mat4 projection;
  uniform mat4 modelview;
  varying vec3 testV;

  void main (void) {
    vec3 cooked = mat3(modelview) * normal;
    float dp = -dot(normalize(cooked), normalize(vec3(0.5, 0., -1.)));
    dp = clamp(dp, 0., 1.);

    // vec4 projected = projection * modelview * vec4(pos, 1.);
    gl_Position = projection * modelview * vec4(pos, 1.);

    testV = vec3(1., 0, .3) * dp;
  }
  `

  shaders.debugVert =
  /* glsl */`
  precision highp float;

  attribute vec3 pos;
  attribute vec3 normal;
  uniform mat4 projection;
  uniform mat4 modelview;
  varying vec3 testV;

  void main (void) {
    vec3 cooked = mat3(modelview) * normal;
    float dp = -dot(normalize(cooked), normalize(vec3(0.5, 0., -1.)));
    dp = clamp(dp, 0., 1.);

    vec4 projected = projection * modelview * vec4(pos, 1.);
    gl_Position = projection * modelview * vec4(pos.x, pos.y - 1., pos.z, 1.);

    testV = vec3(1., 0, .3) * dp;
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

  shaders.vertexProjector =
  /* glsl */ `
  precision highp float;

  attribute vec3 pos;
  uniform mat4 projection;

  void main (void) {
    gl_Position = projection * vec4(pos, 1.0);
  }
  `

  shaders.redShader =
  /* glsl */`
  precision highp float;
  varying vec3 testV;

  void main (void) {
    gl_FragColor = vec4(testV, 1.);
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
}