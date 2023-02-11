'use strict';

function buildShaders () {
  const shaders = {}
  shaders.blurKernelSize = 9

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
  #define wFar 4.1

  void main (void) {
    // Encode normalized w-component into alpha channel:
    float a = clamp(-w / wFar, 0., 1.);

    vec4 color =  mix(  vec4(0.9, 0.0, 0.4, a),
                          vec4(0.0, 1.0, 0.7, a),
                    clamp((-w-1.)/2., 0., 1.));
    color.r *= 2.5;
    gl_FragColor = color;
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

  shaders.redNormalVert =
  /* glsl */`
  precision mediump float;

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
    // test before branch

    vec4 color =
      mix(clear, blurry,
        clamp(
  // for general functional dependence, c.f.:
  // https://www.researchgate.net/publication/
  // 272483151_Depth_recovery_and_refinement_
  // from_a_single_image_using_defocus_cues
          // debug: w-focus disabled to test z-behavior
          // fz
          fw
        , 0., 1.));

    gl_FragColor = color;
  }
  `

  shaders.blurCompositorFrag_ALTERNATE =
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

  uniform mat4 MV4;
  uniform mat4 MV3;
  uniform mat4 projection;

  void main (void) {
    const float wOffset = -2.1; // slightly more than cube diagonal
    const float wNear = 0.75;
    vec4 v = pos;

    v = MV4 * v;
    v.w += wOffset;
    w = v.w; // pass transformed w-value to fragment shader

    float s = wNear / (wNear - v.w);
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

  shaders.projector3dVert =
  /* glsl */ `
  precision mediump float;

  attribute vec3 pos;
  uniform mat4 projection;

  void main (void) {
    gl_Position = projection * vec4(pos, 1.0);
  }
  `

  return shaders
}
