var Re=Object.defineProperty;var Ae=(e,t,i)=>t in e?Re(e,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):e[t]=i;var q=(e,t,i)=>Ae(e,typeof t!="symbol"?t+"":t,i);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))o(r);new MutationObserver(r=>{for(const a of r)if(a.type==="childList")for(const l of a.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&o(l)}).observe(document,{childList:!0,subtree:!0});function i(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?a.credentials="include":r.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(r){if(r.ep)return;r.ep=!0;const a=i(r);fetch(r.href,a)}})();const T={};T.blurKernelSize=8;const re=.5;T.wOffset=(re+1)/(re-1);Math.abs(T.wOffset+2)<.01&&console.warn("The specified projection is too close to the projection plane and may result in visual artifacts.");T.borderFrag=`
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

#define wMid ${T.wOffset.toFixed(9)}
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
`;T.glitterFrag=`
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

#define wMid ${T.wOffset.toFixed(9)}
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
`;T.diffuseFrag=`
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

#define wMid ${T.wOffset.toFixed(9)}
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
`;T.textureVert=`
precision mediump float;
attribute vec3 pos;
attribute vec2 aTexel;
varying vec2 vTexel;

void main (void) {
  gl_Position = vec4(pos, 1.);
  vTexel = vec2(aTexel);
}
`;T.alphaCompositorFrag=`
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
`;T.texturedCompositorFrag=`
precision highp float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform sampler2D lensTex;
uniform float clarityScale;
uniform vec2 cloudShiftSmall;
uniform vec2 cloudShiftMedium;
uniform vec2 cloudShiftLarge;
varying vec2 vTexel;

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

// Variable extra-smooth downward step:
// https://www.desmos.com/calculator/mxoykritdy
float smoothDrop (float bound, float exponent, float x) {
  float w = x / bound;
  float smoothed = clamp(w*w*w* (6.*w*w - 15.*w + 10.), 0., 1.);
  return clamp(
      1. - pow(smoothed, exponent),
    0., 1.);
}

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  vec4 lens =
    + 0.35*texture2D(lensTex, vTexel / 3. + cloudShiftSmall)
    + 0.9*texture2D(lensTex, -vTexel / 4. - cloudShiftMedium)
    + 2.05*texture2D(lensTex, vTexel / 7. + cloudShiftLarge)
    ;

  vec4 mixed = mix(blurry, clear, clear.a * clarityScale);
  float luminance =
      0.2126 * blurry.r
    + 0.7152 * blurry.g
    + 0.0722 * blurry.b;

  float signal = pow(smoothDrop(1., 1., luminance), 1.35);
  float boost = 5. * smoothDrop(1., 0.2, luminance);

  // Soft cloud effect:
  float soft = pow(1.5*diminish(lens.a), 3.);
  float cloud = pow(smoothDrop(1., 0.8, 1.-soft), 1.3);

  const mat4 colorTransform = mat4(
  //  Output
  //  R       G       B       α
      0.30,   0.15,   0.20,   0.00, // R  Input
      0.40,   0.05,   0.20,   0.00, // G
      0.10,   0.25,   0.30,   0.00, // B
      0.00,   0.00,   0.00,   0.00  // α
  );

  // Weight the cloud color components to favor red light:
  gl_FragColor =
    mixed
    + colorTransform * mixed * signal * boost * cloud;
}
`;T.blur1dFrag=`
precision mediump float;
varying vec2 vTexel;

uniform sampler2D uTex;
#define kernelSize ${T.blurKernelSize}
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
`;T.projectorVert=`
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
  const float wOffset = ${T.wOffset.toFixed(9)};
  const float wNear = 1.0;
  vec4 v = pos;

  // This projection pipeline for normals assumes no nonuniform scaling,
  // avoiding the inverse transpose:
  // Apply qvp (model)
  // Apply qvp (view)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4 n = qvp(qModelL, normal, qModelR);
  n = qvp(qViewL, n, qViewR);
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = normalize(vec4(n3, n.w));

  // Transform the position vector:
  v = qvp(qModelL, v, qModelR);
  v = qvp(qViewL, v, qViewR);
  v.w += wOffset;

  w = v.w; // pass transformed w-value to fragment shader

  vec3 unprojected = vec3(v); // Transformed x, y, z, sans projection.

  float s = wNear / (-v.w);
  mat4 Scale4Dto3D = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = Scale4Dto3D * v;
  v.w = 1.;

  // Normalizing vWorld4d in the vertex shader rather than fragment shader
  // is slightly inaccurate, but unnoticeably so.
  vWorld4d = normalize(vec4(
    vec3(M3 * vec4(unprojected, 1.)), w
  ));

  // Apply 3D model matrix, then 3D -> 2D perspective projection:
  gl_Position = projection * M3 * v;
}
`;const V=Math.PI;function ue(e,t,i){return typeof i>"u"&&(i=e),typeof t>"u"&&(t=e),[e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1]}function fe(e,t,i){return[1,0,0,0,0,1,0,0,0,0,1,0,e,t,i,1]}function G(e,t,i){e===i&&(i=[...i]),e===t&&(t=[...t]);for(let o=0;o<4;o++)e[o]=t[o]*i[0]+t[4+o]*i[1]+t[8+o]*i[2]+t[12+o]*i[3],e[4+o]=t[o]*i[4]+t[4+o]*i[5]+t[8+o]*i[6]+t[12+o]*i[7],e[8+o]=t[o]*i[8]+t[4+o]*i[9]+t[8+o]*i[10]+t[12+o]*i[11],e[12+o]=t[o]*i[12]+t[4+o]*i[13]+t[8+o]*i[14]+t[12+o]*i[15];return e}function H(e){e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1}function de(e){return[Math.cos(e),Math.sin(e),0,0,-Math.sin(e),Math.cos(e),0,0,0,0,1,0,0,0,0,1]}function Fe(e){let{near:t,far:i,left:o,right:r,top:a,bottom:l}=e;{const c=Math.tan(e.fov/2*Math.PI/180)*t,d=c/e.aspect;o=-c,r=c,a=d,l=-d}return[2*t/(r-o),0,0,0,0,2*t/(a-l),0,0,(r+o)/(r-o),(a+l)/(a-l),(t+i)/(t-i),-1,0,0,2*t*i/(t-i),0]}function Se(e,t){return[e[3]*t[0]+e[0]*t[3]+e[1]*t[2]-e[2]*t[1],e[3]*t[1]-e[0]*t[2]+e[1]*t[3]+e[2]*t[0],e[3]*t[2]+e[0]*t[1]-e[1]*t[0]+e[2]*t[3],e[3]*t[3]-e[0]*t[0]-e[1]*t[1]-e[2]*t[2]]}class b extends Array{static product(t,i){return b.from(Se(t,i))}static slerpUnit(t,i,o){let r=Math.acos(t.inner(i));if(Number.isNaN(r)||Math.abs(r)<1e-6)return i;const a=new b,l=Math.sin(r),c=Math.sin((1-o)*r)/l,d=Math.sin(o*r)/l;return a[0]=t[0]*c+i[0]*d,a[1]=t[1]*c+i[1]*d,a[2]=t[2]*c+i[2]*d,a[3]=t[3]*c+i[3]*d,a}static parse(t){try{t=t.replaceAll(" ","");const i=t.match(/(-?\d*\.?\d+)i/),o=t.match(/(-?\d*\.?\d+)j/),r=t.match(/(-?\d*\.?\d+)k/),a=t.match(/(-?\d*\.?\d+)(?![ijk\.])\b/);let l=0,c=0,d=0,u=0;return i?l=parseFloat(i[1]):t.match(/-i/)?l=-1:t.match(/i/)&&(l=1),o?c=parseFloat(o[1]):t.match(/-j/)?c=-1:t.match(/j/)&&(c=1),r?d=parseFloat(r[1]):t.match(/-k/)?d=-1:t.match(/k/)&&(d=1),a&&(u=parseFloat(a[1])),b.from([l,c,d,u])}catch{return b.from([0,0,0,0])}}constructor(){super(),this[0]=0,this[1]=0,this[2]=0,this[3]=1}toString(){return`${this[0].toFixed(16)}i + ${this[1].toFixed(16)}j + ${this[2].toFixed(16)}k + ${this[3].toFixed(16)}`}toFixedString(t=2){return`${this[0].toFixed(t).padStart(t+3)}i + ${this[1].toFixed(t).padStart(t+3)}j + ${this[2].toFixed(t).padStart(t+3)}k + ${this[3].toFixed(t).padStart(t+3)}`}log(t){const i="color:#fd0",o="color:#0a8";console.log(`${String(t||"").padEnd(10)}%c${r(this[0])}%ci + %c${r(this[1])}%cj + %c${r(this[2])}%ck + %c${r(this[3])}`,i,o,i,o,i,o,i);function r(a){return String(a.toFixed(2)).replace("0.00","0").replace("0.",".").replace("1.00","1").padStart(3)}}conjugate(){return b.from([-this[0],-this[1],-this[2],this[3]])}negative(){return b.from([-this[0],-this[1],-this[2],-this[3]])}inner(t){return this[0]*t[0]+this[1]*t[1]+this[2]*t[2]+this[3]*t[3]}geodesicDistance(t){return Math.acos(2*this.inner(t)**2-1)}magnitudeSquared(){return this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]}atAngle(t){const i=Math.sin(t),o=Math.cos(t);if(this[3]!==1||Math.abs(this[0])!==1&&Math.abs(this[1])!==1&&Math.abs(this[2])!==1)throw new Error("Quaternion not in correct format for atAngle (expecting 1 ± i, j, or k.)");return b.from([this[0]*i,this[1]*i,this[2]*i,this[3]*o])}invert(){const t=this.magnitudeSquared();return t<1e-6?this:(this[0]/=-t,this[1]/=-t,this[2]/=-t,this[3]/=t,this)}premultiply(t){const i=this[0],o=this[1],r=this[2],a=this[3];return this[0]=t[3]*i+t[0]*a+t[1]*r-t[2]*o,this[1]=t[3]*o-t[0]*r+t[1]*a+t[2]*i,this[2]=t[3]*r+t[0]*o-t[1]*i+t[2]*a,this[3]=t[3]*a-t[0]*i-t[1]*o-t[2]*r,this}postmultiply(t){const i=this[0],o=this[1],r=this[2],a=this[3];return this[0]=a*t[0]+i*t[3]+o*t[2]-r*t[1],this[1]=a*t[1]-i*t[2]+o*t[3]+r*t[0],this[2]=a*t[2]+i*t[1]-o*t[0]+r*t[3],this[3]=a*t[3]-i*t[0]-o*t[1]-r*t[2],this}apply(t,i){return this.premultiply(t),this.postmultiply(i),this}normalize(){const t=Math.sqrt(this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]);return t===0?this:(this[0]/=t,this[1]/=t,this[2]/=t,this[3]/=t,this)}}const E={};E.commonTesseractAnimation=function(){H(this.M3),H(this.M4),this.shared.animator&&this.shared.animator.call(this),G(this.M3,ue(2),this.M3),G(this.M3,fe(0,0,-20),this.M3)};E.initBlur=function(){const e=this.gl;this.uTex=e.getUniformLocation(this.program,"uTex"),this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.kernel=e.getUniformLocation(this.program,"kernel"),this.blurStep=e.getUniformLocation(this.program,"blurStep"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1fv(this.kernel,me(.1,T.blurKernelSize));const t=[e.createFramebuffer(),e.createFramebuffer()],i=[$(e,e.TEXTURE0+3,()=>Math.floor(e.canvas.clientWidth/2)),$(e,e.TEXTURE0+4,()=>Math.floor(e.canvas.clientWidth/2))];for(let o=0;o<t.length;o++)e.bindFramebuffer(e.FRAMEBUFFER,t[o]),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i[o],0),K(e);e.bindFramebuffer(e.FRAMEBUFFER,null),this.shared.blurRes||console.warn("Warning: initial blurRes unavailable."),this.shared.clearTexture||console.warn("Warning: initial clearTexture unavailable."),this.fboAlternates=t,this.texAlternates=i};E.drawBlur=function(){const e=this.gl;let t=1/this.shared.blurRes,i=0;e.viewport(0,0,this.shared.blurRes,this.shared.blurRes),e.disable(e.BLEND);const o=[!0,!0],r=n.blurPassCount;this.shared.readTexture=1,e.uniform1i(this.uTex,this.shared.readTexture);for(let a=0;a<r;a++)e.bindFramebuffer(e.FRAMEBUFFER,this.fboAlternates[a%2]),o[a%2]&&(e.clear(e.COLOR_BUFFER_BIT),o[a%2]=!1),e.uniform2fv(this.blurStep,[t,i]),[t,i]=[i,t],e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks),this.shared.readTexture=3+a%2,e.uniform1i(this.uTex,this.shared.readTexture);e.enable(e.BLEND)};E.prepareBlurSurfaces=function(){const e=this.gl,t=e.canvas.clientWidth;let i=null;if(e instanceof WebGLRenderingContext)z("✔ Bypassing MSAA.");else{let u=function(m,A){const y=e.canvas.clientWidth;if(i===y)return;const p=e.getParameter(e.RENDERBUFFER_BINDING);e.bindRenderbuffer(e.RENDERBUFFER,m),e.renderbufferStorageMultisample(e.RENDERBUFFER,c,A,y,y),e.bindFramebuffer(e.FRAMEBUFFER,d),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,l),e.bindRenderbuffer(e.RENDERBUFFER,p),i=y};var a=u;const l=e.createRenderbuffer(),c=Math.min(16,e.getParameter(e.MAX_SAMPLES)),d=e.createFramebuffer();ee("Applying "+c+"x MSAA"),z("Applying "+c+`x MSAA
`),u(l,e.RGBA8),window.addEventListener("resize",m=>{u(l,e.RGBA8)}),K(e),this.shared.fboAA=d}const o=$(e,e.TEXTURE0+1,()=>e.canvas.clientWidth,e.RGBA),r=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,r),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,o,0),K(e),this.shared.res=t,this.shared.blurRes=Math.floor(t/2),this.shared.fboClear=r,this.shared.clearTexture=o,window.addEventListener("resize",l=>{this.shared.res=e.canvas.clientWidth,this.shared.blurRes=Math.floor(e.canvas.clientWidth/2)})};E.initTesseractBorder=function(){const e=this.gl;this.M3=[],this.M4=[],this.uM3=e.getUniformLocation(this.program,"M3"),this.uM4=e.getUniformLocation(this.program,"M4"),this.qModelL=e.getUniformLocation(this.program,"qModelL"),this.qModelR=e.getUniformLocation(this.program,"qModelR"),this.qViewL=e.getUniformLocation(this.program,"qViewL"),this.qViewR=e.getUniformLocation(this.program,"qViewR"),this.nearFrameColor=e.getUniformLocation(this.program,"nearFrameColor"),this.farFrameColor=e.getUniformLocation(this.program,"farFrameColor"),this.mesh.stride===8&&(this.normal=e.getAttribLocation(this.program,"normal"),e.enableVertexAttribArray(this.normal),e.vertexAttribPointer(this.normal,this.components,e.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4),this.specularColor1=e.getUniformLocation(this.program,"specularColor1"),this.specularColor2=e.getUniformLocation(this.program,"specularColor2"),this.specularColor3=e.getUniformLocation(this.program,"specularColor3"),this.specularColor4=e.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=e.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=e.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=e.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=e.getUniformLocation(this.program,"specularDirection4"),this.frameSpecularWeight=e.getUniformLocation(this.program,"frameSpecularWeight"))};E.drawTesseractBorder=function(){const e=this.gl;E.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.nearFrameColor,n.lighting.nearFrameColor),e.uniform4fv(this.farFrameColor,n.lighting.farFrameColor),this.frameSpecularWeight&&e.uniform1f(this.frameSpecularWeight,n.lighting.borderSpecularity),this.mesh.stride===8&&(e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw)),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};E.initGlassTesseract=function(){var i;const e=this.gl;this.M3=[],this.M4=[],this.uM3=e.getUniformLocation(this.program,"M3"),this.uM4=e.getUniformLocation(this.program,"M4"),this.normal=e.getAttribLocation(this.program,"normal"),this.qModelL=e.getUniformLocation(this.program,"qModelL"),this.qModelR=e.getUniformLocation(this.program,"qModelR"),this.qViewL=e.getUniformLocation(this.program,"qViewL"),this.qViewR=e.getUniformLocation(this.program,"qViewR"),this.opacity=e.getUniformLocation(this.program,"opacity"),this.glowColor=e.getUniformLocation(this.program,"glowColor"),this.membraneColor=e.getUniformLocation(this.program,"membraneColor"),this.diffuseColor1=e.getUniformLocation(this.program,"diffuseColor1"),this.diffuseColor2=e.getUniformLocation(this.program,"diffuseColor2"),this.diffuseColor3=e.getUniformLocation(this.program,"diffuseColor3"),this.diffuseDirection1=e.getUniformLocation(this.program,"diffuseDirection1"),this.diffuseDirection2=e.getUniformLocation(this.program,"diffuseDirection2"),this.diffuseDirection3=e.getUniformLocation(this.program,"diffuseDirection3"),this.specularColor1=e.getUniformLocation(this.program,"specularColor1"),this.specularColor2=e.getUniformLocation(this.program,"specularColor2"),this.specularColor3=e.getUniformLocation(this.program,"specularColor3"),this.specularColor4=e.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=e.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=e.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=e.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=e.getUniformLocation(this.program,"specularDirection4"),e.enableVertexAttribArray(this.normal),e.vertexAttribPointer(this.normal,this.components,e.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4);const t=e.canvas.clientWidth;(i=this.shared).res??(i.res=t),window.addEventListener("resize",o=>{this.shared.res=e.canvas.clientWidth})};E.drawGlassTesseract=function(){const e=this.gl;if(this.opacityFunction){const t=this.opacityFunction.call(this);if(t<=.001)return;e.uniform1f(this.opacity,t)}E.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.glowColor,n.lighting.glow.rgba),e.uniform4fv(this.membraneColor,n.lighting.membrane.rgba),e.uniform4fv(this.diffuseColor1,n.lighting.diffuseLights[0].rgba),e.uniform4fv(this.diffuseColor2,n.lighting.diffuseLights[1].rgba),e.uniform4fv(this.diffuseColor3,n.lighting.diffuseLights[2].rgba),e.uniform4fv(this.diffuseDirection1,n.lighting.diffuseLights[0].xyzw),e.uniform4fv(this.diffuseDirection2,n.lighting.diffuseLights[1].xyzw),e.uniform4fv(this.diffuseDirection3,n.lighting.diffuseLights[2].xyzw),e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw),e.viewport(0,0,this.shared.res,this.shared.res),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};E.useClearTarget=function(){const e=this.gl;this.shared.fboAA?e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboClear),e.viewport(0,0,this.shared.res,this.shared.res),e.clear(e.COLOR_BUFFER_BIT)};E.resolveClearTarget=function(){const e=this.gl;this.shared.fboAA&&(e.bindFramebuffer(e.READ_FRAMEBUFFER,this.shared.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,this.shared.fboClear),e.blitFramebuffer(0,0,this.shared.res,this.shared.res,0,0,this.shared.res,this.shared.res,e.COLOR_BUFFER_BIT,e.NEAREST))};E.initTexturedCompositor=function(){const e=this.gl;this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.uBlurTex=e.getUniformLocation(this.program,"blurTex"),this.uClearTex=e.getUniformLocation(this.program,"clearTex"),this.uLensTex=e.getUniformLocation(this.program,"lensTex"),this.uClarityScale=e.getUniformLocation(this.program,"clarityScale"),this.uCloudShiftSmall=e.getUniformLocation(this.program,"cloudShiftSmall"),this.uCloudShiftMedium=e.getUniformLocation(this.program,"cloudShiftMedium"),this.uCloudShiftLarge=e.getUniformLocation(this.program,"cloudShiftLarge"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1i(this.uBlurTex,0),e.uniform1i(this.uClearTex,1),e.uniform1i(this.uLensTex,5),this.lensTexture=e.createTexture(),e.activeTexture(e.TEXTURE0+5),e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));const t=new Image;t.addEventListener("load",()=>{const i=e.getParameter(e.TEXTURE_BINDING_2D);e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.generateMipmap(e.TEXTURE_2D),e.bindTexture(e.TEXTURE_2D,i)}),t.src="/tesseract/cloud-1.png"};E.drawTexturedCompositor=function(){const e=this.gl;e.uniform2fv(this.uCloudShiftSmall,[this.dt/12e4%1,this.dt/-95e3%1]),e.uniform2fv(this.uCloudShiftMedium,[this.dt/-37e3%1,this.dt/12e4%1]),e.uniform2fv(this.uCloudShiftLarge,[this.dt/-6e5%1,this.dt/65e3%1]),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.shared.res,this.shared.res),e.uniform1i(this.uBlurTex,this.shared.readTexture),e.uniform1f(this.uClarityScale,n.clarityScale),e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks)};function $(e,t,i,o){const r=e,a=r.createTexture();let l=null,c=null;o??(o=r.RGBA),typeof i=="function"?(l=i(),c=l,window.addEventListener("resize",u=>{const m=r.getParameter(r.TEXTURE_BINDING_2D);l=i(),c!==l&&(r.bindTexture(r.TEXTURE_2D,a),d(),r.bindTexture(r.TEXTURE_2D,m),c=l)})):(l=i,c=l),r.activeTexture(t),r.bindTexture(r.TEXTURE_2D,a),o===r.DEPTH_COMPONENT16||o===r.DEPTH_COMPONENT?(r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.NEAREST)):(r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR)),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),d();function d(){if(o===r.RGBA)r.texImage2D(r.TEXTURE_2D,0,o,l,l,0,r.RGBA,r.UNSIGNED_BYTE,null);else if(o===r.DEPTH_COMPONENT)r.texImage2D(r.TEXTURE_2D,0,o,l,l,0,r.DEPTH_COMPONENT,r.UNSIGNED_SHORT,null);else if(o===r.DEPTH_COMPONENT16)r.texImage2D(r.TEXTURE_2D,0,o,l,l,0,r.DEPTH_COMPONENT,r.UNSIGNED_SHORT,null);else throw new Error("Unsupported texture format for blankTexture.")}return a}function K(e){const t=e.checkFramebufferStatus(e.FRAMEBUFFER);if(t!==e.FRAMEBUFFER_COMPLETE){ee("test:");const i=Object.keys(Object.getPrototypeOf(e)).filter(o=>o.startsWith("FRAMEBUFFER"));for(const o of i)e[o]===t&&z("Framebuffer incomplete: "+o)}}const D=class D{constructor(){this.specularLights=[new D.Light({xyzw:[-.707106781,0,.707106781,0]}),new D.Light({xyzw:[0,-.707106781,0,-.707106781]}),new D.Light({xyzw:[.577350269,.577350269,-.577350269,0]}),new D.Light({xyzw:[0,0,-1,0]})],this.diffuseLights=[new D.Light({xyzw:[-.707106781,0,.707106781,0]}),new D.Light({xyzw:[0,-.707106781,0,-.707106781]}),new D.Light({xyzw:[0,0,0,-1]})],this.glow=new D.Light,this.glow.rgba[3]=.05,this.membrane=new D.Light,this.nearFrameColor=[0,0,0,0],this.farFrameColor=[0,0,0,0],this.diffuseOpacity=1,this.specularOpacity=1,this.borderSpecularity=0}};q(D,"Light",class{constructor(t={}){q(this,"xyzw",[0,0,0,0]);q(this,"rgba",[0,0,0,0]);t.xyzw&&(this.xyzw=[...t.xyzw]),t.rgba&&(this.rgba=[...t.rgba])}});let N=D;function me(e,t){const r=Math.sqrt(-2*e**2*Math.log(.06*e*Math.sqrt(2*V)))/(t-1),a=[];let l=0,c=0;for(let u=0;u<t;u++){const m=d(l);a.push(m),c+=2*m,l+=r}return c-=d(0),a.forEach((u,m)=>a[m]=u/c),a;function d(u){return 1/(e*Math.sqrt(2*V))*Math.exp(-.5*(u/e)**2)}}class he extends Array{constructor(){super(...arguments);q(this,"stride",1)}static from(...i){let o=super.from(...i);return i[0].stride&&(o.stride=i[0].stride),o}get blocks(){return this.length/this.stride}get byteStride(){return this.stride*Float32Array.BYTES_PER_ELEMENT}log(i=""){console.log("  "+i+` ${this.length} elements / ${this.stride} stride = ${this.blocks} blocks`);for(let o=0;o<this.length;o+=this.stride){let r=`${o/this.stride})`.padEnd(5)+"<".padStart(5);for(let a=0;a<this.stride;a++)r+=this[o+a].toFixed(2).padStart(7)+(a<this.stride-1?",":"");r+="  >",console.log(r)}}replace(i,o=this.stride){const r=[];let a=0;for(let l=0;l<this.length;l+=o){const c=[];for(let u=0;u<o;u++)c.push(this[l+u]);const d=i(c);r.push(...d),a=d.length}return this.stride=a,this.length=0,this.push(...r),this}interleave(i,o=this.stride){const r=[];let a=0;for(let l=0;l<this.length;l+=o){const c=[];for(let u=0;u<o;u++)c.push(this[l+u]);const d=i(c);r.push(...c,...d),a=d.length}return this.stride+=a,this.length=0,this.push(...r),this}invertTriangles(){return this.replace(Me,9)}sproutNormals(){return this.replace(i=>{const o=triangleNormal3(i);return[i[0],i[1],i[2],...o,i[3],i[4],i[5],...o,i[6],i[7],i[8],...o]},9)}}const M={};M.square2d=[-1,-1,1,-1,1,1,-1,1];M.texSquare=he.from(M.square2d);M.texSquare.stride=2;M.texSquare.interleave(e=>[(e[0]+1)/2,(e[1]+1)/2]);M.texSquare.stride=4;M.tesseractOutline=pe(Ce,8);M.normalTesseract=pe(De,8);function Me(e){return[e[0],e[1],e[2],e[6],e[7],e[8],e[3],e[4],e[5]]}function pe(e,t){const i=new he,o=e.bind(i),r=[-1,1,1,1],a=[-1,-1,1,1],l=[1,-1,1,1],c=[1,1,1,1],d=[1,1,-1,1],u=[1,-1,-1,1],m=[-1,-1,-1,1],A=[-1,1,-1,1],y=[-1,1,1,-1],p=[-1,-1,1,-1],f=[1,-1,1,-1],h=[1,1,1,-1],x=[1,1,-1,-1],R=[1,-1,-1,-1],w=[-1,-1,-1,-1],F=[-1,1,-1,-1];return o(r,a,l,c),o(r,A,m,a),o(A,d,u,m),o(d,c,l,u),o(r,c,d,A),o(l,a,m,u),o(y,p,f,h),o(F,w,p,y),o(F,x,R,w),o(h,f,R,x),o(F,y,h,x),o(p,w,R,f),o(r,y,p,a),o(c,h,f,l),o(d,x,R,u),o(A,F,w,m),o(a,p,f,l),o(m,w,p,a),o(u,R,w,m),o(l,f,R,u),o(r,y,h,c),o(A,F,y,r),o(d,x,F,A),o(c,h,x,d),i.stride=t,i}function Ce(e,t,i,o){const a=[],[l,c,d,u]=[[],[],[],[]];for(let m=0;m<4;m++)l[m]=(e[m]+t[m])/2,c[m]=(t[m]+i[m])/2,d[m]=(i[m]+o[m])/2,u[m]=(o[m]+e[m])/2;for(let m=0;m<4;m++)a[m]=(e[m]+t[m]+i[m]+o[m])/4;for(const[m,A,y]of[[e,t,l],[t,i,c],[i,o,d],[o,e,u]]){const p=[],f=[];for(let h=0;h<4;h++)p[h]=m[h]*(1-.04)+a[h]*.04;for(let h=0;h<4;h++)f[h]=A[h]*(1-.04)+a[h]*.04;this.push(...[m,y,A,y,p,y,p,y,A,y,f,y].flat())}}function De(e,t,i,o){const r=[];for(let a=0;a<4;a++)r[a]=(e[a]+t[a]+i[a]+o[a])/4;this.push(...[e,r,t,r,i,r,e,r,i,r,o,r].flat())}const Ue='[{"name":"blossom","string":"{\\"Lstring\\":\\"0.3770087083426957i + -0.7913019518279542j + 0.4250500001960014k + -0.2259162503972059\\",\\"Rstring\\":\\"-0.5671411517174197i + -0.3997880634675983j + 0.0339703232464508k + -0.7192818887397743\\",\\"velocity\\":[0,0,0,0,0.0625,0,0,0,0,0,0,-0.0625],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.03536487511244542,0.13252253894422736,-0.9905488893941868,-8.673617379884035e-19],\\"rgba\\":[0.6862745098039216,0.4117647058823529,1.2352941176470589,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.34901960784313724,0,0.07058823529411765,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.32941176470588235,0.403921568627451,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.27450980392156865,0.17647058823529413,0.615686274509804,0.10980392156862745]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.058823529411764705,0.047058823529411764,0.07058823529411765,0.5686274509803921]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.35294117647058826,0.12156862745098039,0.23921568627450981,0.09019607843137255],\\"diffuseOpacity\\":1,\\"specularOpacity\\":2,\\"borderSpecularity\\":0.2}}"},{"name":"first light","string":"{\\"Lstring\\":\\"0.1071288310610887i + -0.5278657488370966j + -0.0673330530359743k + 0.8398496441248096\\",\\"Rstring\\":\\"-0.0459106443189584i + 0.9243623345765215j + 0.1179090293992739k + 0.3599221415085698\\",\\"velocity\\":[0,0.0375,0,0,-0.05625,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0.4549019607843137,0.9568627450980393,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-1,-1,-1,0.14901960784313725]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-0.9019607843137255,0.011764705882352941,0.21568627450980393,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[-0.8196078431372549,0.10196078431372549,1,0.1411764705882353]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[-0.0392156862745098,-0.0392156862745098,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.11764705882352941,0,-0.09803921568627451,0.058823529411764705]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.17647058823529413,0.12156862745098039,0.058823529411764705,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.29411764705882354,0.08235294117647059,0,0.12549019607843137]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.043137254901960784,0.03137254901960784,0.1568627450980392,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.7843137254901961,0.23529411764705882,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":3,\\"borderSpecularity\\":0.4}}"},{"name":"aquarius","string":"{\\"Lstring\\":\\"0.3606987087850542i + -0.6427843814039939j + -0.0347757345848848k + -0.6749187571787967\\",\\"Rstring\\":\\"0.2324618090832823i + 0.5393663467140035j + 0.7056944671560963k + 0.3962836993609121\\",\\"velocity\\":[0,0.037500000000000006,0,0,0.037500000000000006,0,0,0,0,0,0,0.11249999999999999],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.11764705882352941,0.5411764705882353,0.6352941176470588,0.12941176470588234]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[1.4470588235294117,2.458823529411765,3,0.12941176470588234]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0.11764705882352941,1.011764705882353,0.5176470588235293,0.12941176470588234]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.6039215686274509,1.2078431372549019,1.015686274509804,3.67843137254902]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.18823529411764706,-0.11372549019607843,-0.12941176470588237,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.17254901960784313,-0.11764705882352941,-0.35294117647058826,0.25882352941176473]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.00392156862745098,0.3058823529411765,0.6392156862745098,0.1450980392156863]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.34901960784313724,0.19215686274509805,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"wintersun","string":"{\\"Lstring\\":\\"0.3719736765396583i + 0.2101507393543021j + -0.0868600418969983k + -0.8999597678969921\\",\\"Rstring\\":\\"-0.5675448115073667i + 0.3688262435741262j + 0.3145224238654931k + 0.6655341718267085\\",\\"velocity\\":[0,0.046875,0,0,-0.046875,0,0,0,0,-0.032812499999999994,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[2.9058823529411764,0,0,0.7835294117647059]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,1.2470588235294118,1.2470588235294118,0.7835294117647059]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[2.8705882352941177,1.223529411764706,0,0.36000000000000004]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,1.1803921568627451,6.698039215686275,1.828235294117647]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7176470588235294,0.09019607843137255,0,0.5098039215686274]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3254901960784314,0.2784313725490196,0.8627450980392157,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"trance","string":"{\\"Lstring\\":\\"-0.7227606368739261i + 0.1427279015970619j + 0.5724411835866986k + -0.3599401328360199\\",\\"Rstring\\":\\"0.1062919047636684i + 0.3554399758333309j + 0.9158459902528523k + -0.1535922416657187\\",\\"velocity\\":[0,0,0,0,0,0,0,0,0,0,-0.0525,0.0875],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[1,0,0,3]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0.7529411764705882,1.5058823529411764,3]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-2.7294117647058824,0.6588235294117647,1.2000000000000002,2.776470588235294]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3568627450980392,-0.5490196078431373,-4.145098039215687,7]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.8745098039215686,0.10588235294117647,0.13333333333333333,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0.07450980392156863,0.12941176470588237,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9725490196078431,0.5098039215686274,0.3137254901960784,0]},\\"nearFrameColor\\":[0.49411764705882353,0.2092156862745098,0.226078431372549,0],\\"farFrameColor\\":[1,0.62,0.49,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"anemochore","string":"{\\"Lstring\\":\\"-0.0805261893707946i + 0.2743728554710255j + 0.7017029562350887k + 0.6525703258675746\\",\\"Rstring\\":\\"0.2435454850858778i + 0.1498350015448846j + 0.8141109929302610k + 0.5054288873636178\\",\\"velocity\\":[0.05,0,0,0,0,-0.0625,-0.03125,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.2627450980392157,0.19607843137254902,0.1450980392156863,0]},{\\"xyzw\\":[0.6600685039065106,-0.21578419676780547,0.7174669903527193,-0.05466139707421265],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.3176470588235294,0.09411764705882353,0,0.2]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.9019607843137255,0.6823529411764706,0.5490196078431373,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.666527037335581,-0.5579300285182619,0.03514599234409593,-0.4931739561254359],\\"rgba\\":[0.21568627450980393,0.07450980392156863,0.043137254901960784,0.054901960784313725]},{\\"xyzw\\":[0.6037489214813726,-0.3757445940833738,0.006975561737554433,-0.7030324184315015],\\"rgba\\":[0.45098039215686275,0.20392156862745098,0.14901960784313725,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.4627450980392157,0.28627450980392155,0.1803921568627451,0.047058823529411764]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.23529411764705882,0.06274509803921569,0.050980392156862744,0.06666666666666667]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.27450980392156865,0.1568627450980392,0.23529411764705882,0.21568627450980393]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"ember iris","string":"{\\"Lstring\\":\\"-0.5579837100826338i + 0.7786196862397065j + -0.2465777870033310k + -0.1469862525466535\\",\\"Rstring\\":\\"0.7850300329947077i + 0.5489283048032018j + -0.1441205277920669k + -0.2482636440357161\\",\\"velocity\\":[0.03125,0,0,0,0,-0.06875,0,-0.0125,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,0,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.7921568627450981,0.023529411764705882,0.12156862745098039,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.24313725490196078,0.3176470588235294,0,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.11764705882352941,0.35294117647058826,0.9019607843137255,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7843137254901961,0,-0.2901960784313726,0.20784313725490197]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.06666666666666668,0.00392156862745098,0.34509803921568627,0]},\\"nearFrameColor\\":[0.0392156862745098,0.011764705882352941,0.00392156862745098,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":0.7,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"captured light","string":"{\\"Lstring\\":\\"0.8480253023376401i + 0.2909808138529828j + -0.4380945786750333k + 0.0652410353674748\\",\\"Rstring\\":\\"-0.6875523541633705i + 0.3206171828092015j + 0.4168948500298034k + -0.5006746112846883\\",\\"velocity\\":[0,0,0.05,0.06875,0,0,0,0,0,-0.0375,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.20392156862745098,0.22745098039215686,0.396078431372549,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.707106781,0,-0.707106781,0],\\"rgba\\":[-0.16862745098039217,-0.23529411764705882,-0.19215686274509805,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0,0,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.24313725490196078,0.21568627450980393,0.1568627450980392,0.03137254901960784]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"chromophore","string":"{\\"Lstring\\":\\"0.2461767777234436i + -0.1454713892950948j + 0.4874959217027777k + 0.8249744210049221\\",\\"Rstring\\":\\"-0.2729822245975122i + -0.0851213019540162j + 0.2852539441146569k + 0.9148033976466068\\",\\"velocity\\":[0.05,0,0,0,0,-0.05,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.8901960784313725,0.5490196078431373,0.45098039215686275,0.19607843137254902]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.2901960784313726,0.1843137254901961,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.19607843137254902,-1,0.5176470588235295,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3764705882352941,0.11372549019607843,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.34111195854061166,-0.4786795739877712,2.949029909160572e-17,-0.8090169943749477],\\"rgba\\":[-0.15294117647058825,0.16862745098039217,0.10980392156862745,0.19607843137254902]},{\\"xyzw\\":[0.13048778609679595,-0.573118173234877,2.42861286636753e-17,-0.809016994374948],\\"rgba\\":[0.1843137254901961,-0.1607843137254902,0.16862745098039217,0.19607843137254902]},{\\"xyzw\\":[0,0.5877852522924736,0,-0.8090169943749472],\\"rgba\\":[0.27450980392156865,0.058823529411764705,-0.19607843137254902,0.19607843137254902]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.39215686274509803,0.22745098039215686,0.5294117647058824,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.0784313725490196,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.0392156862745098,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"}]';window.onerror=Pe;document.querySelector(".loading-notice").classList.add("hidden");const ee=console.log.bind(console),B=document.getElementById.bind(document),n={animationSpeeds:[],lighting:new N,viewL:new b,viewR:new b,releasedViewL:new b,releasedViewR:new b,viewSnapT:1,grabStyle:"3d",modelL:new b,modelR:new b,initialModelL:new b,initialModelR:new b,finalModelL:new b,finalModelR:new b,modelSnapT:1,blurPassCount:2,clarityScale:0,animation1:{keepAnimating:!0},animationSet:[],animationCycle:{},upcomingAnimations:[],currentAnimation:{},countdowns:[]},J=n.animationSet;function z(e){document.querySelector(".feedback").style.visibility="visible",document.querySelector(".feedback").textContent+=e+`
`}function Pe(e,t,i,o,r){z("⚠️ "+e),z(t),z("Line: "+i),z("Col: "+o),z(r)}_e();function _e(){try{let c=function(p){return p<.5?8*p**4:1-Math.pow(-2*p+2,4)/2},d=function(p){var h;if(!n.clarityTransition)return;(h=n.clarityTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.clarityTransition.tStart)/n.clarityTransition.duration);n.clarityScale=P(n.clarityTransition.initial,n.clarityTransition.final,f),f===1&&delete n.clarityTransition},u=function(p){var h;if(!n.lightTransition)return;(h=n.lightTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.lightTransition.tStart)/n.lightTransition.duration);n.lighting=je(n.lightTransition.initial,n.lightTransition.final,f),f===1&&delete n.lightTransition},m=function(p){var h;if(!n.velocityTransition)return;(h=n.velocityTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.velocityTransition.tStart)/n.velocityTransition.duration);n.animationSpeeds=Ve(n.velocityTransition.initial,n.velocityTransition.final,f),f===1&&delete n.velocityTransition},A=function(p,f){var R;if(!n.orientationTransition){oe(n.animationSpeeds,n.modelL,n.modelR,f);return}(R=n.orientationTransition).tStart??(R.tStart=p);const h=Math.min(1,(p-n.orientationTransition.tStart)/n.orientationTransition.duration),x=c(h);oe(n.orientationTransition.initial.animationSpeeds,n.orientationTransition.initial.modelL,n.orientationTransition.initial.modelR,f),n.modelL=b.slerpUnit(n.orientationTransition.initial.modelL,n.orientationTransition.final.modelL,x),n.modelR=b.slerpUnit(n.orientationTransition.initial.modelR,n.orientationTransition.final.modelR,x),h===1&&(n.animationSpeeds=[...n.orientationTransition.final.animationSpeeds],delete n.orientationTransition)},y=function(){if(this.t??(this.t=0),this.tLast??(this.tLast=this.dt),!n.pointerdown){const p=this.dt-this.tLast;if(this.t+=p,this.shared.animationState.needUpdate){d(this.t),u(this.t),m(this.t),A(this.t,p),n.modelSnapT<1&&(n.modelSnapT+=(this.dt-this.tLast)/2e3,n.modelSnapT=Math.min(n.modelSnapT,1),n.modelL=b.slerpUnit(n.initialModelL,n.finalModelL,c(n.modelSnapT)),n.modelR=b.slerpUnit(n.initialModelR,n.finalModelR,c(n.modelSnapT))),n.viewSnapT<1&&(n.viewSnapT+=(this.dt-this.tLast)/2e3,n.viewSnapT=Math.min(n.viewSnapT,1),n.viewL=b.slerpUnit(n.releasedViewL,b.from([0,0,0,1]),n.viewSnapT),n.viewR=b.slerpUnit(n.releasedViewR,b.from([0,0,0,1]),n.viewSnapT));const f=this.dt-this.tLast;let h=!1;for(const x of[...n.countdowns])x.remaining-=f,x.remaining<0&&(x.callback(),h=!0);h&&(n.countdowns=n.countdowns.filter(x=>x.remaining>0)),this.shared.animationState.needUpdate=!1}}this.tLast=this.dt,this.gl.uniform4fv(this.qViewL,n.viewL),this.gl.uniform4fv(this.qViewR,n.viewR),this.gl.uniform4fv(this.qModelL,n.modelL),this.gl.uniform4fv(this.qModelR,n.modelR)};var e=c,t=d,i=u,o=m,r=A,a=y;z("Script loaded."),Ge(),Xe(),We();for(const p of[B("main-canvas")])if(p){const f=p.getBoundingClientRect();p.setAttribute("width",f.width),p.setAttribute("height",f.height)}let l=B("main-canvas").getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1});l||(l=B("main-canvas").getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}));for(const[p,f]of[[l,B("first-title").querySelector(".view-label")]])p.canvas.width=p.canvas.clientWidth,p.canvas.height=p.canvas.clientHeight,f.innerHTML=p.getParameter(p.VERSION)+"<br>"+p.getParameter(p.SHADING_LANGUAGE_VERSION),p instanceof WebGLRenderingContext||(f.innerHTML+="<br>"+p.getParameter(p.MAX_SAMPLES)+"x MSAA support");n.animation1.context=l,n.animation1.showFPS=()=>{B("fps-1").textContent=n.animation1.lastFPS.toFixed(1)+" FPS"},n.animation1.draw=Be(l,{animationState:n.animation1,nearPlane:1,farPlane:100,animator:y},[{init:E.prepareBlurSurfaces,draw:E.useClearTarget},{vertexShader:T.projectorVert,fragmentShader:T.borderFrag,mesh:M.tesseractOutline,components:4,init:E.initTesseractBorder,draw:E.drawTesseractBorder},{vertexShader:T.projectorVert,fragmentShader:T.diffuseFrag,opacityFunction:()=>n.lighting.diffuseOpacity,mesh:M.normalTesseract,components:4,init:E.initGlassTesseract,draw:E.drawGlassTesseract},{vertexShader:T.projectorVert,fragmentShader:T.glitterFrag,opacityFunction:()=>n.lighting.specularOpacity,mesh:M.normalTesseract,components:4,init:E.initGlassTesseract,draw:E.drawGlassTesseract},{draw:E.resolveClearTarget},{vertexShader:T.textureVert,fragmentShader:T.blur1dFrag,mesh:M.texSquare,init:E.initBlur,draw:E.drawBlur},{vertexShader:T.textureVert,fragmentShader:T.texturedCompositorFrag,mesh:M.texSquare,init:E.initTexturedCompositor,draw:E.drawTexturedCompositor}])}catch(l){z(`
🚩 Initialization error: `+l.message+`
`+l.stack)}}function ze(e){if(!e.createVertexArray){const i=e.getExtension("OES_vertex_array_object");e.VERTEX_ARRAY_BINDING=i.VERTEX_ARRAY_BINDING_OES,e.createVertexArray=i.createVertexArrayOES.bind(i),e.deleteVertexArray=i.deleteVertexArrayOES.bind(i),e.isVertexArray=i.isVertexArrayOES.bind(i),e.bindVertexArray=i.bindVertexArrayOES.bind(i)}const t=e.getExtension("WEBGL_depth_texture");t?(e.appropriateDepthFormat=e.DEPTH_COMPONENT,e.depthTextureExt=t):e.appropriateDepthFormat=e.DEPTH_COMPONENT16}function Be(e,t,i=[]){try{let r=function(a){ke(a,t.animationState),r.pauseTime??(r.pauseTime=0),r.t0??(r.t0=a),r.pauseTime&&(r.t0+=a-r.pauseTime,r.pauseTime=0);const l=a-r.t0;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);for(const c of i)c.dt=l,c.program&&(e.bindVertexArray(c.vao),e.useProgram(c.program)),c.draw();t.animationState.keepAnimating?(t.animationState.needUpdate=!0,requestAnimationFrame(r)):r.pauseTime=a};var o=r;if(!i.length)throw new Error("No rendering phases specified.");if(!t.animationState)throw new Error("animationState needed.");ze(e),t.nearPlane??(t.nearPlane=.1),t.farPlane??(t.farPlane=1e3),t.projection=Fe({near:t.nearPlane,far:t.farPlane,fov:12,aspect:1});for(const a of i){if(a.gl=e,a.shared=t,a.components??(a.components=3),!a.draw)throw new Error("Draw method needed.");if(!a.vertexShader||!a.fragmentShader||!a.mesh){a.init&&a.init();continue}let l=ie(e,a.vertexShader,e.VERTEX_SHADER),c=ie(e,a.fragmentShader,e.FRAGMENT_SHADER);a.program=e.createProgram(),e.attachShader(a.program,l),e.attachShader(a.program,c),Ne(e,a.program),e.deleteShader(l),e.deleteShader(c),l=null,c=null,a.vao=e.createVertexArray(),e.bindVertexArray(a.vao),a.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,a.vbo),e.bufferData(e.ARRAY_BUFFER,new Float32Array(a.mesh),e.STATIC_DRAW),a.model=e.getUniformLocation(a.program,"model"),a.view=e.getUniformLocation(a.program,"view"),a.projection=e.getUniformLocation(a.program,"projection"),a.pos=e.getAttribLocation(a.program,"pos"),e.useProgram(a.program),e.uniformMatrix4fv(a.projection,!1,t.projection),e.enableVertexAttribArray(a.pos),e.vertexAttribPointer(a.pos,a.components,e.FLOAT,!1,a.mesh.byteStride,0),a.init&&a.init()}return e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),requestAnimationFrame(r),r}catch(r){document.querySelector(".feedback").style.visibility="visible",r.cause?document.querySelector(".feedback").innerHTML=Oe(r):document.querySelector(".feedback").textContent+="❌ "+r.message+`
`,ee(r)}}function ke(e,t){var o;t.intervalStart??(t.intervalStart=e),t.frameCount??(t.frameCount=0),t.frameCount++;const i=e-t.intervalStart;i>1e3&&(t.lastFPS=1e3*t.frameCount/i,t.intervalStart=e,t.frameCount=0,(o=t.showFPS)==null||o.call(t))}function ie(e,t,i){const o=e.createShader(i);if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(o),{cause:t});return o}function Ne(e,t){if(e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(t))}function Oe(e){var a,l;const t=((a=e.cause)==null?void 0:a.split(`
`))||["~"],i=parseInt((l=e.message.match(/\d:(\d+)/))==null?void 0:l[1]),o=t[i-1];return t[i-1]=`<span style="color:#f44">${o}</span>`,`<span style="color:#efa">${e.message}</span>`+t.filter((c,d)=>Math.abs(i-d)<4).join("<br>")}const j=[{L:b.from([0,0,1,1]),R:b.from([0,0,-1,1])},{L:b.from([0,1,0,1]),R:b.from([0,-1,0,1])},{L:b.from([1,0,0,1]),R:b.from([-1,0,0,1])},{L:b.from([1,0,0,1]),R:b.from([1,0,0,1])},{L:b.from([0,1,0,1]),R:b.from([0,1,0,1])},{L:b.from([0,0,1,1]),R:b.from([0,0,1,1])}];function oe(e,t,i,o){for(const[r,a]of e.entries()){if(Math.abs(a)<1e-6)continue;const l=o*a*V/1e3;r<6?(t.postmultiply(j[r].L.atAngle(l)),i.premultiply(j[r].R.atAngle(l))):(t.premultiply(j[r%6].L.atAngle(l)),i.postmultiply(j[r%6].R.atAngle(l)))}}function Z(e,t){delete n.clarityTransition,n.clarityTransition={initial:n.clarityScale,final:e,duration:t}}function ge(e,t,i){delete n.velocityTransition,n.velocityTransition={initial:e,final:t,duration:i}}function Ie(e,t=2e3){delete n.orientationTransition,n.orientationTransition={initial:{animationSpeeds:[...n.animationSpeeds],modelL:b.from(n.modelL),modelR:b.from(n.modelR)},final:e,duration:t}}function be(e,t,i=2e3){delete n.lightTransition,n.lightTransition={initial:e,final:t,duration:i}}function qe(e=3e3){Z(1,e/2),be(new N,n.currentAnimation.lighting,e),ge(Array(12).fill(0),n.animationSpeeds,e/4)}function Ve(e,t,i){return e.map((o,r)=>P(o,t[r],i))}function je(e,t,i){const o=new N;for(const r of["specularLights","diffuseLights"])for(const a in e[r])o[r][a]=Y(e[r][a],t[r][a],i);return o.glow=Y(e.glow,t.glow,i),o.membrane=Y(e.membrane,t.membrane,i),o.nearFrameColor=e.nearFrameColor.map((r,a)=>P(r,t.nearFrameColor[a],i)),o.farFrameColor=e.farFrameColor.map((r,a)=>P(r,t.farFrameColor[a],i)),o.diffuseOpacity=P(e.diffuseOpacity,t.diffuseOpacity,i),o.specularOpacity=P(e.specularOpacity,t.specularOpacity,i),o.borderSpecularity=P(e.borderSpecularity,t.borderSpecularity,i),o}function Y(e,t,i){const o=[e.rgba[0]>=0&&t.rgba[0]>=0,e.rgba[1]>=0&&t.rgba[1]>=0,e.rgba[2]>=0&&t.rgba[2]>=0];function r(u){return Math.abs(u)<.04045?u/12.92:Math.pow((u+.055)/1.055,2.4)}function a(u){return Math.abs(u)<.0031308?u*12.92:1.055*Math.pow(u,1/2.4)-.055}const l=[o[0]?r(e.rgba[0]):e.rgba[0],o[1]?r(e.rgba[1]):e.rgba[1],o[2]?r(e.rgba[2]):e.rgba[2],e.rgba[3]],c=[o[0]?r(t.rgba[0]):t.rgba[0],o[1]?r(t.rgba[1]):t.rgba[1],o[2]?r(t.rgba[2]):t.rgba[2],t.rgba[3]],d=[P(l[0],c[0],i),P(l[1],c[1],i),P(l[2],c[2],i),P(l[3],c[3],i)];return new N.Light({xyzw:e.xyzw.map((u,m)=>P(u,t.xyzw[m],i)),rgba:[o[0]?a(d[0]):d[0],o[1]?a(d[1]):d[1],o[2]?a(d[2]):d[2],d[3]]})}function P(e,t,i){return i*t+(1-i)*e}function Xe(){const e=JSON.parse(Ue);for(const{name:t,string:i}of e){const o=JSON.parse(i);o.lighting.glow.rgba[3]===0&&(o.lighting.glow.rgba[3]=.05),n.animationSet.push({title:t,modelL:b.parse(o.Lstring),modelR:b.parse(o.Rstring),animationSpeeds:o.velocity,lighting:o.lighting,active:!0})}}function Q(){const e=[];n.upcomingAnimations=[];const t=n.animationSet.filter(i=>i.active);for(let i=0;i<t.length;i++)e[i]=i;for(;e.length;){const i=Math.floor(Math.random()*e.length),o=e.splice(i,1)[0];n.upcomingAnimations.push(t[o])}n.currentAnimation===n.upcomingAnimations[0]&&n.upcomingAnimations.push(n.upcomingAnimations.shift())}function We(){const i=Array(12).fill(0);Q();const o=n.upcomingAnimations.shift();n.currentAnimation=o,n.modelL=b.from(o.modelL),n.modelR=b.from(o.modelR),n.animationSpeeds=[...o.animationSpeeds],n.lighting=new N,n.countdowns.push({remaining:2e4,callback:r}),window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation}));function r(){const a=n.upcomingAnimations.shift();n.currentAnimation=a,window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation})),n.upcomingAnimations.length||Q(),Ie(a,2e3),n.countdowns.push({callback:()=>{be(n.lighting,a.lighting,2e3*2)},remaining:2e3}),n.countdowns.push({callback:()=>{ge(i,a.animationSpeeds.map(l=>1.3*l),2e3/4)},remaining:2e3}),n.countdowns.push({callback:r,remaining:2e4})}}function ae(e){n.grabStyle=e}function Ge(){function e(){B("main-canvas").clientWidth>350?n.blurPassCount=4:n.blurPassCount=2}window.addEventListener("resize",a=>{for(const l of[n.animation1]){const c=l.context;c.canvas.width=c.canvas.clientWidth,c.canvas.height=c.canvas.clientHeight,c.viewport(0,0,c.canvas.width,c.canvas.height),l.keepAnimating||requestAnimationFrame(l.draw)}e()}),e();const t=a=>{n.lastX=a.clientX,n.lastY=a.clientY,n.pointerdown=!0};B("main-canvas").addEventListener("pointerdown",t);const i=a=>{n.pointerdown=!1,n.releasedViewL=n.viewL,n.releasedViewR=n.viewR,n.viewSnapT=0};B("main-canvas").addEventListener("pointerup",i);const o=a=>{i()};B("main-canvas").addEventListener("pointerleave",o);const r=a=>{if(n.pointerdown){const l=(a.clientX-n.lastX)/a.target.offsetWidth,c=(a.clientY-n.lastY)/a.target.offsetHeight,d=l*V,u=c*V;switch(n.grabStyle){case"3d":n.viewL.premultiply([0,Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewR.postmultiply([0,-Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewL.premultiply([Math.sin(u*.75),0,0,Math.cos(u*.75)]),n.viewR.postmultiply([-Math.sin(u*.75),0,0,Math.cos(u*.75)]);break;case"4d":n.viewL.premultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewR.postmultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewL.premultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]),n.viewR.postmultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]);break}n.viewL.normalize(),n.viewR.normalize()}n.lastX=a.clientX,n.lastY=a.clientY};B("main-canvas").addEventListener("pointermove",r)}const L=document.querySelector.bind(document),_=document.querySelectorAll.bind(document);He();function He(){const e=L(".underline");let t="left",i={left:0,right:0},o=L(".link-box"),r=!1;qe(3e3),Ye(),l();const a=_(".link-box a");e.style.right=i.right-a[a.length-1].getBoundingClientRect().right+"px",ae(L('input[name="grab-type"]:checked').value);for(const f of _(".line-link"))f.addEventListener("click",h=>{h.preventDefault()});L(".grab-style").addEventListener("input",f=>{ae(f.target.value)});for(const f of _(".link-box"))f.addEventListener("pointerenter",h=>{const x=f.querySelector(".line-link");o=f,e.classList.remove("no-delay"),x.getBoundingClientRect().left-i.left<parseFloat(getComputedStyle(e).left)?(e.classList.remove("delay-left"),e.classList.add("delay-right"),t="left"):(e.classList.remove("delay-right"),e.classList.add("delay-left"),t="right"),e.style.left=x.getBoundingClientRect().left-i.left+"px",e.style.right=i.right-x.getBoundingClientRect().right+"px"});L(".link-box-container").addEventListener("pointerleave",()=>{e.classList.remove("delay-left"),e.classList.remove("delay-right"),e.classList.add("no-delay"),t==="left"?e.style.right=i.right-o.querySelector("a").getBoundingClientRect().left+"px":e.style.left=o.querySelector("a").getBoundingClientRect().right-i.left+"px"});function l(){i=L(".link-box-container").getBoundingClientRect()}function c(){const f=_(".link-box a");e.classList.remove("delay-right"),e.classList.remove("delay-left"),e.classList.add("no-delay"),e.style.left="100%",e.style.right=i.right-f[f.length-1].getBoundingClientRect().right+"px"}window.addEventListener("resize",()=>{l(),c()}),document.getElementById("contact-box").addEventListener("click",()=>{const f=L(".contact-email");if(f.childElementCount>0)return;const R=F("<`hc\\TU,gRQa[.E^R","You look down and see a tortoise..."),w=document.createElement("a");w.href=`mailto:${R}`,w.textContent=R,f.append(w);function F(C,te){return[...C].map((we,Le)=>String.fromCharCode((we.charCodeAt(0)-32-(te.charCodeAt(Le%te.length)-32)+95)%95+32)).join("")}});for(const f of[L(".gear"),..._(".link-box")])f.addEventListener("click",h=>{const x=f.dataset.section,R=L("."+x);if(R.classList.contains("opaque"))return d();window.dispatchEvent(new CustomEvent("pane-open")),R.classList.remove("concealed"),R.classList.add("opaque"),R.scrollTop=0;const w=R.querySelector(".scroll-container");w&&(w.scrollTop=0);for(const F of _(".content"))F.classList.contains(x)||(F.classList.remove("opaque"),F.classList.add("concealed"));x!=="settings"&&u(R),Z(0,500)}),f.addEventListener("pointerenter",h=>{L(".underline").classList.add("bright-underline")}),f.addEventListener("pointerleave",h=>{L(".underline").classList.remove("bright-underline")});function d(){window.dispatchEvent(new CustomEvent("pane-close"));for(const f of _(".content"))f.classList.remove("opaque"),f.classList.add("concealed");Z(1,1500)}for(const f of _(".close"))f.addEventListener("click",d);document.body.addEventListener("click",f=>{}),window.addEventListener("click",f=>{for(const h of _(".content"))if(h.contains(f.target)||h===f.target)return;f.target.classList.contains("link-box")||f.target.classList.contains("line-link")||L(".gear").contains(f.target)||d()});function u(f){u.duration??(u.duration=1100),u.canvas??(u.canvas=document.querySelector(".glint-canvas")),u.ctx??(u.ctx=u.canvas.getContext("2d"));const h=f.getBoundingClientRect();u.canvas.style.width=h.width+"px",u.canvas.style.height=h.height+"px",u.canvas.style.top=h.top+"px",clearTimeout(u.tid),u.canvas.style.display="block",u.tid=setTimeout(()=>u.canvas.style.display="none",u.duration),delete m.t0,requestAnimationFrame(m)}function m(f){if(!u.ctx.createConicGradient)return;const h=80;m.t0??(m.t0=f);const x=Math.min((f-m.t0)/u.duration,1),R=1-(1-x)**2,w=1-x**3,F=-R*Math.PI*2-Math.PI/2,C=u.ctx.createConicGradient(F,-.4*h,1.5*h);C.addColorStop(0,`hsla(22, 100%, 59%, ${w*.02})`),C.addColorStop(.29,`hsla(22, 100%, 59%, ${w*.125})`),C.addColorStop(.34,`hsla(353, 88%, 63%, ${w*.314})`),C.addColorStop(.45,`hsla(8, 100%, 67%, ${w*.376})`),C.addColorStop(.48,`hsla(26, 100%, 65%, ${w*.439})`),C.addColorStop(.5,`hsla(26, 100%, 70%, ${w*.565})`),C.addColorStop(.72,`hsla(151, 51%, 51%, ${w*.376})`),C.addColorStop(.875,`hsla(198, 57%, 49%, ${w*.251})`),C.addColorStop(1,`hsla(198, 57%, 49%, ${w*.02})`),u.ctx.clearRect(0,0,h,h),u.ctx.fillStyle=C,u.ctx.fillRect(0,0,h,h),x<1&&requestAnimationFrame(m)}L(".fullscreen").addEventListener("click",f=>{r=!r,A(r),y(r)});function A(f){f?document.documentElement.requestFullscreen?document.documentElement.requestFullscreen():document.documentElement.webkitRequestFullscreen&&document.documentElement.webkitRequestFullscreen():document.exitFullscreen?document.exitFullscreen():document.webkitCancelFullScreen&&document.webkitCancelFullScreen()}function y(f){f?(L(".name-container").classList.add("fade-out"),L(".link-box-container").classList.add("fade-out"),L(".gear").classList.add("mostly-hidden"),L(".fullscreen").classList.add("mostly-hidden")):(L(".name-container").classList.remove("fade-out"),L(".link-box-container").classList.remove("fade-out"),L(".gear").classList.remove("mostly-hidden"),L(".fullscreen").classList.remove("mostly-hidden"))}function p(){document.fullscreenElement||document.webkitFullscreenElement?r=!0:r=!1,y(r)}document.addEventListener("fullscreenchange",p),document.addEventListener("webkitfullscreenchange",p)}function Ye(){if(!J.length){z("Animation data not yet available.");return}const e=L(".ul-animations");for(const t of J){const i=document.createElement("li"),o=document.createElement("label"),r=document.createElement("input");r.type="checkbox",r.checked=!0,r.dataset.title=t.title,r.addEventListener("input",$e),o.append(r),o.append(t.title),i.append(o),e.append(i)}}function $e(){const e=_('.ul-animations input[type="checkbox"]');let t=0;for(const i of e)i.checked&&t++;t===0&&(this.checked=!0);for(const i of e)J.find(o=>o.title===i.dataset.title).active=i.checked;Q()}Ke();function Ke(){for(const e of _(".carousel")){const t=document.createElement("div");t.classList.add("carousel-clipping"),e.append(t),e.dataset.current=0,e.addEventListener("rotate",Je);const i=e.dataset.src.split(", ");if(t.addEventListener("click",()=>{S.noClick||(location=e.closest("section").querySelector("a").href)}),i.length>1){const o=document.createElement("div");o.classList.add("pip-container"),e.append(o);for(const[r,a]of Object.entries(i)){32*i.length/-2;const l=document.createElement("div");l.classList.add("carousel-pip"),l.addEventListener("click",c=>{e.dispatchEvent(new CustomEvent("rotate",{detail:r})),c.stopPropagation()}),o.append(l)}e.querySelector(".carousel-pip").classList.add("current")}for(const o of e.dataset.src.split(", ")){const r=document.createElement("div");r.classList.add("carousel-slide"),r.classList.add("hide-slide"),r.style.backgroundImage=`url(${o})`,t.append(r)}if(ve(e),i.length>1){const o=document.createElement("button"),r=document.createElement("button");o.classList.add("spin-left-button"),r.classList.add("spin-right-button"),o.addEventListener("click",a=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),a.stopPropagation()}),r.addEventListener("click",a=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),a.stopPropagation()}),e.append(o),e.append(r),e.addEventListener("touchstart",S),e.addEventListener("touchmove",Ze),e.addEventListener("touchend",Qe)}}}function ve(e){const t=e.querySelectorAll(".carousel-slide"),i=e.dataset.current,o=t.length;for(const[r,a]of Object.entries(t)){if(a.classList.remove("skip-slide"),r===i){a.classList.remove("slide-left"),a.classList.remove("slide-right"),a.classList.remove("hide-slide");continue}const l=(i-r+o)%o,c=(r-i+o)%o;l===1||c===1?a.classList.remove("hide-slide"):a.classList.add("hide-slide"),l<c?(a.classList.contains("slide-right")&&(a.classList.remove("slide-right"),a.classList.add("skip-slide")),a.classList.add("slide-left")):(a.classList.contains("slide-left")&&(a.classList.remove("slide-left"),a.classList.add("skip-slide")),a.classList.add("slide-right"))}}function Je(e){const t=e.detail,i=e.currentTarget.dataset.src.split(", ").length,o=Number(e.currentTarget.dataset.current);let r;switch(t){case"next":r=(i+o+1)%i;break;case"previous":r=(i+o-1)%i;break;default:r=t}e.currentTarget.dataset.current=r,ve(e.currentTarget);const a=e.currentTarget.querySelectorAll(".carousel-pip");a[o].classList.remove("current"),a[r].classList.add("current")}function S(e){S.noClick=!1,S.contact={x0:e.changedTouches[0].screenX,y0:e.changedTouches[0].screenY}}function Ze(e){if(!S.contact)return;const t=Math.min(document.body.clientWidth,document.body.clientHeight),i=(e.changedTouches[0].screenX-S.contact.x0)/t,o=(e.changedTouches[0].screenY-S.contact.y0)/t;if(!(Math.abs(o/i)>.577)){if(e.preventDefault(),o>.03||o<-.03){S.noClick=!0,delete S.contact;return}i>.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),delete S.contact,S.noClick=!0),i<-.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),delete S.contact,S.noClick=!0)}}function Qe(){delete S.contact}const ne=new Map([["blossom",[[.1,.06,.3],[.07,.03,.21]]],["first light",[[.42,.15,.09],[.52,.05,.01]]],["aquarius",[[.04,.04,.31],[.04,.04,.51],[.01,.06,.12]]],["wintersun",[[.09,.07,.35],[.1,.04,.08],[.09,.07,.35],[.06,.03,.25],[.16,.05,.01]]],["trance",[[.75,.09,.01],[.35,.07,.04],[.31,.11,.01],[.31,.07,.04]]],["anemochore",[[.22,.09,.06],[.35,.16,.13],[.45,.15,.11]]],["ember iris",[[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.35,.07,.08],[.55,.09,0]]],["captured light",[[.19,.08,.1],[.12,.05,.06]]],["chromophore",[[.34,.19,.22],[.24,.09,.22],[.08,.12,.24],[.12,.04,.11],[.04,.06,.12],[.12,.04,.11],[.04,.06,.12]]]]),U={},O={},g={position:-1,xy:-1,uv:-1,kernel:null,readTexture:null,blurStep:null,texSampler:null,blurSampler:null,clearSampler:null,hexAspect:null,compositorAspect:null,boost:null,aberration:null,pulseRadius:null,positionMax:null,transform:null,project:null,rgba:null},k={transform:de(0),project:[]},s={gl:null,readingMode:!1,pulseTime:-3,zPulse:0,resizeCount:0,blurKernelSize:6,canvasWidth:0,canvasHeight:0,textureWidth:1,textureHeight:1,tLast:0,elapsed:0,aspect:1,sceneScale:1,xMax:0,yMax:0,particleDensity:14,maxParticles:0,hexagonProgram:null,flatProgram:null,blurProgram:null,compositorProgram:null,hexagonVertBuffer:null,flatVertBuffer:null,uvBuffer:null,fboAA:null,rbAA:null,fboList:[],textureList:[],activeColorSet:[[.3,.1,.15],[.1,.25,.3]]},v=[];function et(){const e=document.querySelector(".render-canvas");return!e||document.documentElement.clientHeight<1?1:e.clientHeight/document.documentElement.clientHeight}function se(e){if(ne.has(e.title)){s.activeColorSet=ne.get(e.title);return}const t=[],i=({rgba:r})=>r[0]>=0&&r[1]>=0&&r[2]>=0,o=({rgba:r})=>r[0]!==0||r[1]!==0||r[2]!==0;for(const{rgba:r}of e.lighting.diffuseLights.filter(i).filter(o))t.push([r[0],r[1],r[2]]);for(const{rgba:r}of e.lighting.specularLights.filter(i).filter(o))t.push([r[0],r[1],r[2]]);console.log(e.title,"applying colors:");for(const r of t)console.log(r);t.length&&(s.activeColorSet=t)}function tt(){const e=document.querySelector(".bokeh-canvas");if(!e)throw Error("No bokeh canvas found");if(s.gl=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl&&(s.gl=e.getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl))throw Error("Unable to create bokeh rendering context");const t=s.gl;window.addEventListener("resize",ce),n.currentAnimation&&se(n.currentAnimation),window.addEventListener("tesseract-change",d=>{se(d.detail),le()}),window.addEventListener("pane-close",()=>{s.readingMode=!1}),window.addEventListener("pane-open",()=>{s.readingMode=!0}),t instanceof WebGL2RenderingContext&&(s.fboAA=t.createFramebuffer(),s.rbAA=t.createRenderbuffer());const i=I(t,t.VERTEX_SHADER,U.flatLensVert),o=I(t,t.FRAGMENT_SHADER,U.premultiplyAlpha);s.hexagonProgram=W(t,i,o);const r=I(t,t.VERTEX_SHADER,U.texVert),a=I(t,t.FRAGMENT_SHADER,U.texFrag);s.flatProgram=W(t,r,a);const l=I(t,t.FRAGMENT_SHADER,U.blur1d);s.blurProgram=W(t,r,l);const c=I(t,t.FRAGMENT_SHADER,U.compositor);s.compositorProgram=W(t,r,c),g.position=t.getAttribLocation(s.hexagonProgram,"position"),g.hexAspect=t.getUniformLocation(s.hexagonProgram,"aspect"),g.boost=t.getUniformLocation(s.hexagonProgram,"boost"),g.positionMax=t.getUniformLocation(s.hexagonProgram,"positionMax"),g.transform=t.getUniformLocation(s.hexagonProgram,"transform"),g.project=t.getUniformLocation(s.hexagonProgram,"project"),g.rgba=t.getUniformLocation(s.hexagonProgram,"rgba"),s.hexagonVertBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.hexagonVertBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.hexagon),t.STATIC_DRAW),t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE),t.clearColor(0,0,0,0),t.useProgram(s.blurProgram),g.blurStep=t.getUniformLocation(s.blurProgram,"blurStep"),g.kernel=t.getUniformLocation(s.blurProgram,"kernel"),t.uniform1fv(g.kernel,me(.1,s.blurKernelSize)),g.blurSampler=t.getUniformLocation(s.compositorProgram,"blurSampler"),g.clearSampler=t.getUniformLocation(s.compositorProgram,"clearSampler"),g.compositorAspect=t.getUniformLocation(s.compositorProgram,"compositorAspect"),g.aberration=t.getUniformLocation(s.compositorProgram,"aberration"),g.pulseRadius=t.getUniformLocation(s.compositorProgram,"pulseRadius"),g.xy=t.getAttribLocation(s.flatProgram,"xy"),g.uv=t.getAttribLocation(s.flatProgram,"uvA"),g.texSampler=t.getUniformLocation(s.flatProgram,"texSampler"),s.flatVertBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.flatVertBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.square),t.STATIC_DRAW),s.uvBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.uvBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array([0,1,1,1,1,0,0,0]),t.STATIC_DRAW),s.fboList=[t.createFramebuffer(),t.createFramebuffer(),t.createFramebuffer()];for(const d of s.fboList)t.bindFramebuffer(t.FRAMEBUFFER,d),s.textureList.push(t.createTexture()),t.bindTexture(t.TEXTURE_2D,s.textureList.at(-1)),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,s.textureList.at(-1),0);ce(),it(),le(),requestAnimationFrame(Ee)}function le(){setTimeout(()=>{s.readingMode||(s.pulseTime=0)},19500)}function ce(){const e=s.gl,t=document.querySelector(".bokeh-canvas");if(!t||!e)return;s.resizeCount++,s.canvasHeight=Math.max(1,Math.round(Math.min(600,t.clientHeight))),s.canvasWidth=Math.max(1,Math.round(s.canvasHeight*t.clientWidth/t.clientHeight)),s.textureWidth=Math.max(1,Math.min(1024,Math.floor(s.canvasWidth/2))),s.textureHeight=Math.max(1,Math.min(1024,Math.floor(s.canvasHeight/2))),t.height=s.canvasHeight,t.width=s.canvasWidth,s.aspect=s.canvasWidth/s.canvasHeight,s.sceneScale=et();const i=s.sceneScale*2;if(s.xMax=.5*i*s.aspect/s.sceneScale,s.yMax=.5*i/s.sceneScale,e.useProgram(s.hexagonProgram),e.uniform2fv(g.positionMax,[s.xMax,s.yMax]),e.useProgram(s.compositorProgram),e.uniform1f(g.compositorAspect,s.aspect),s.fboAA&&e instanceof WebGL2RenderingContext){const a=Math.min(16,e.getParameter(e.MAX_SAMPLES)),l=e.getParameter(e.RENDERBUFFER_BINDING);e.bindRenderbuffer(e.RENDERBUFFER,s.rbAA),e.renderbufferStorageMultisample(e.RENDERBUFFER,a,e.RGBA8,s.textureWidth,s.textureHeight),e.bindFramebuffer(e.FRAMEBUFFER,s.fboAA),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,s.rbAA),e.bindRenderbuffer(e.RENDERBUFFER,l)}const o=document.querySelector(".bokeh-canvas"),r=document.querySelector(".render-canvas");if(!o||!r)throw Error("DOM missing canvas nodes");s.maxParticles=Math.min(300,Math.round(s.particleDensity*(o.clientWidth*o.clientHeight)/(r.clientWidth*r.clientHeight)));for(const a of s.textureList)e.bindTexture(e.TEXTURE_2D,a),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,s.textureWidth,s.textureHeight,0,e.RGBA,e.UNSIGNED_BYTE,null);Te()}function rt(e){v[e]=v.at(-1),v.pop()}function xe(){const e=s.yMax*(2*(Math.random()-.5)),t=2*(Math.random()-.5),i=Math.floor(Math.random()*s.activeColorSet.length);v.push({position:[s.xMax*2*(Math.random()-.5),e,t],lifetime:5+Math.random()*5,spawnDelay:0,age:0,color:[...s.activeColorSet[i],1],colorIndex:i,scale:.85+.1*(1-(e+s.yMax)/s.yMax)+.2/(t+2.01)})}function it(){for(;v.length<s.maxParticles/2;){const e=6*v.length/s.maxParticles;xe(),v[v.length-1].lifetime=2+Math.random()*4,v[v.length-1].spawnDelay=e}}function ot(e){const i=-Math.log(.5)/1.125;for(;v.length<s.maxParticles;)xe(),v[v.length-1].spawnDelay=Math.random()*2;for(let r=0;r<v.length;r++){if(v[r].spawnDelay>0){v[r].spawnDelay-=e,v[r].color[3]=0;continue}if(v[r].age+=e,v[r].age>v[r].lifetime){rt(r),r--;continue}const a=s.activeColorSet[v[r].colorIndex%s.activeColorSet.length];v[r].color[0]=o(v[r].color[0],a[0],e),v[r].color[1]=o(v[r].color[1],a[1],e),v[r].color[2]=o(v[r].color[2],a[2],e),v[r].color[3]=Math.sin(Math.PI*v[r].age/v[r].lifetime)**4}function o(r,a,l){return a-(a-r)*Math.exp(-i*l)}}function Ee(e){s.tLast??(s.tLast=e),e-s.tLast>100&&(s.tLast=e);const t=(s.readingMode?.3:1)*(e-s.tLast)/1e3;s.tLast=e,s.elapsed+=t,s.elapsed%=86400,s.pulseTime+=t,s.zPulse=.6*s.pulseTime-2,ot(t),Te(),requestAnimationFrame(Ee)}function X(e,t,i,o,r=!0){const a=s.gl;a.bindFramebuffer(a.FRAMEBUFFER,o),r&&a.clear(a.COLOR_BUFFER_BIT),a.viewport(0,0,s.textureWidth,s.textureHeight),a.useProgram(s.blurProgram),a.enableVertexAttribArray(g.xy),a.enableVertexAttribArray(g.uv),a.bindBuffer(a.ARRAY_BUFFER,s.flatVertBuffer),a.vertexAttribPointer(g.xy,2,a.FLOAT,!1,0,0),a.bindBuffer(a.ARRAY_BUFFER,s.uvBuffer),a.vertexAttribPointer(g.uv,2,a.FLOAT,!1,0,0),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,i),a.uniform1i(g.readTexture,0),a.uniform2f(g.blurStep,e,t),a.drawArrays(a.TRIANGLE_FAN,0,O.square.length/2),a.disableVertexAttribArray(g.xy),a.disableVertexAttribArray(g.uv)}function at(){const e=s.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,s.canvasWidth,s.canvasHeight),e.useProgram(s.compositorProgram),e.enableVertexAttribArray(g.xy),e.enableVertexAttribArray(g.uv),e.bindBuffer(e.ARRAY_BUFFER,s.flatVertBuffer),e.vertexAttribPointer(g.xy,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,s.uvBuffer),e.vertexAttribPointer(g.uv,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,s.textureList[0]),e.uniform1i(g.clearSampler,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,s.textureList[2]),e.uniform1i(g.blurSampler,1),e.uniform1f(g.aberration,.005+.005*ye(Math.max(0,1-s.zPulse**2))),e.uniform1f(g.pulseRadius,Math.max(s.xMax,s.yMax)*(s.zPulse+1)),e.drawArrays(e.TRIANGLE_FAN,0,O.square.length/2),e.disableVertexAttribArray(g.xy),e.disableVertexAttribArray(g.uv)}function nt(){const e=s.gl;e.viewport(0,0,s.textureWidth,s.textureHeight),e.clear(e.COLOR_BUFFER_BIT),e.blendFunc(e.ONE,e.ONE),e.useProgram(s.hexagonProgram),e.enableVertexAttribArray(g.position),e.bindBuffer(e.ARRAY_BUFFER,s.hexagonVertBuffer),e.vertexAttribPointer(g.position,3,e.FLOAT,!1,0,0),H(k.project),k.project[0]=1/s.aspect,e.uniformMatrix4fv(g.project,!1,k.project);const t=Math.max(s.xMax,s.yMax)*(s.zPulse+1);for(const i of v){if(i.spawnDelay>0)continue;H(k.transform),G(k.transform,de(Math.PI/10),ue(i.scale*s.sceneScale/4)),G(k.transform,fe(i.position[0],i.position[1],i.position[2]),k.transform),e.uniform4fv(g.rgba,i.color),e.uniformMatrix4fv(g.transform,!1,k.transform);const o=Math.sqrt(i.position[0]**2+i.position[1]**2),r=Math.min(1,Math.max(0,ye(1-Math.abs(o-t))));e.uniform1f(g.boost,1+1.75*r),e.drawArrays(e.TRIANGLE_FAN,0,O.hexagon.length/3)}e.disableVertexAttribArray(g.position)}function Te(){const e=s.gl;e&&(e.bindFramebuffer(e.FRAMEBUFFER,null),e.clear(e.COLOR_BUFFER_BIT),e instanceof WebGL2RenderingContext?e.bindFramebuffer(e.FRAMEBUFFER,s.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,s.fboList[0]),nt(),st(),X(1/s.textureWidth,0,s.textureList[0],s.fboList[1],!0),X(0,1/s.textureHeight,s.textureList[1],s.fboList[2],!0),X(1/s.textureWidth,0,s.textureList[2],s.fboList[1],!1),X(0,1/s.textureHeight,s.textureList[1],s.fboList[2],!1),at())}function st(){if(!(s.gl instanceof WebGL2RenderingContext)||!s.fboAA)return;const e=s.gl;e.bindFramebuffer(e.READ_FRAMEBUFFER,s.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.fboList[0]),e.blitFramebuffer(0,0,s.textureWidth,s.textureHeight,0,0,s.textureWidth,s.textureHeight,e.COLOR_BUFFER_BIT,e.NEAREST)}function W(e,t,i){const o=e.createProgram();if(e.attachShader(o,t),e.attachShader(o,i),e.linkProgram(o),e.getProgramParameter(o,e.LINK_STATUS))return o;const a=e.getProgramInfoLog(o);throw e.deleteProgram(o),Error(a||"Program link failed; no log available")}function I(e,t,i){const o=e.createShader(t);if(!o)throw Error("Unable to create shader");if(e.shaderSource(o,i),e.compileShader(o),e.getShaderParameter(o,e.COMPILE_STATUS))return o;throw console.error(e.getShaderInfoLog(o)),e.deleteShader(o),Error("Shader compilation failed")}function ye(e){return e<.5?4*e**3:1-(-2*e+2)**3/2}O.hexagon=[-1,0,0,-1/2,Math.sqrt(3)/2,0,1/2,Math.sqrt(3)/2,0,1,0,0,1/2,-Math.sqrt(3)/2,0,-1/2,-Math.sqrt(3)/2,0];O.square=[-1,1,1,1,1,-1,-1,-1];U.flatLensVert=`
uniform float aspect;
uniform vec2 positionMax;
uniform mat4 transform;
uniform mat4 project;
attribute vec4 position;

varying vec4 projected;

void main() {
  vec4 transformed = transform * position;

  float r = length(vec2(transformed)) / length(positionMax);
  transformed.x /= 0.9 + r * 0.1125;
  transformed.y /= 0.9 + r * 0.1125;

  projected = project * transformed;

  gl_Position = projected;
}
`;U.premultiplyAlpha=`
precision mediump float;
uniform float boost;
uniform vec4 rgba;

varying vec4 projected;

void main() {
  vec4 multiplied = rgba * rgba.a * boost;
  multiplied.a = rgba.a;

  gl_FragColor = multiplied;
}
`;U.texVert=`
attribute vec2 xy;
attribute vec2 uvA;
varying mediump vec2 uv;

void main() {
  gl_Position = vec4(xy, 0, 1);
  uv = uvA;
}
`;U.texFrag=`
precision mediump float;
uniform sampler2D texSampler;
varying mediump vec2 uv;

void main() {
  gl_FragColor = texture2D(texSampler, uv);
}
`;U.compositor=`
precision mediump float;
uniform sampler2D blurSampler;
uniform sampler2D clearSampler;
uniform float compositorAspect;
uniform float aberration;
uniform float pulseRadius;
varying mediump vec2 uv;

float ease(float x) {
  float lo = 0.5 * pow(2., 20. * x - 10.);
  float hi = 1.0 - 0.5 * pow(2., -20. * x + 10.);
  float s = step(0.5, x);
  return max(0., min(1., (1. - s) * lo + s * hi));
}

void main() {
  vec2 deltaCenter = vec2(uv.x, uv.y) - vec2(0.5, 0.55);
  deltaCenter.x *= compositorAspect;

  float boundedDistance = min(pow(length(deltaCenter) + 0.001, 0.25), 1.0);
  vec2 radialOffset = normalize(deltaCenter) * boundedDistance * aberration;
  float uvRadius = length(deltaCenter);
  float radialDifference = uvRadius - pulseRadius;
  float leadingEase = step(0., radialDifference)
                        * ease(abs(uvRadius-pulseRadius));
  float trailingEase = (1. - step(0., radialDifference))
                        * min(1., 1. - exp(uvRadius - pulseRadius));
  float pulseDelta = leadingEase + trailingEase;
  float r = min(1.0, 2.0 * length(deltaCenter) / 2.5);
  float t = pow(1.0  - pow(1.0 - r, 0.55), 1.4);

  vec4 near = texture2D(clearSampler, uv + radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + radialOffset) * t;
  vec4 seminear = texture2D(clearSampler, uv + 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + 0.5 * radialOffset) * t;
  vec4 middle = texture2D(clearSampler, uv) * (1.0 - t)
    + texture2D(blurSampler, uv) * t;
  vec4 semifar = texture2D(clearSampler, uv - 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - 0.5 * radialOffset) * t;
  vec4 far = texture2D(clearSampler, uv - radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - radialOffset) * t;

  float v = cos(2.7 * abs(uv.y - 0.475));

  far *=      vec4(0.,   0.,   0.6,   0.2);
  semifar *=  vec4(0.,   0.3,  0.3,   0.2);
  middle *=   vec4(0.1,  0.4,  0.1,   0.2);
  seminear *= vec4(0.3,  0.3,  0.,    0.2);
  near *=     vec4(0.6,  0.,   0.,    0.2);
  
  float smoothR = smoothstep(0., 1., 7.0 * smoothstep(0., 1., pow(0.45 * r, 1.1)))
    * smoothstep(0., 1., 1. - r);
  float centralR = pow(0.85*r, 1.9);
  float outerR = smoothstep(0., 1., 1. - r);

  vec4 aberrantColor = far + semifar + middle + seminear + near;

  float curtainFactor = smoothstep(0.0, 0.2, (1. - 2. * abs(uv.x - 0.5)));

  
  float overallFade = (1. - v * curtainFactor) * (pulseDelta);

  gl_FragColor = aberrantColor * (1. - overallFade) * centralR;
}
`;U.blur1d=`
precision mediump float;
varying vec2 uv;

uniform sampler2D readTexture;
#define kernelSize ${s.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(readTexture, uv) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(readTexture, uv - float(i)*dv) * kernel[i]
            + texture2D(readTexture, uv + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`;tt();
