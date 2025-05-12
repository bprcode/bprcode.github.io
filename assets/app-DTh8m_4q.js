var we=Object.defineProperty;var Le=(e,t,r)=>t in e?we(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var I=(e,t,r)=>Le(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const a of o)if(a.type==="childList")for(const l of a.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&i(l)}).observe(document,{childList:!0,subtree:!0});function r(o){const a={};return o.integrity&&(a.integrity=o.integrity),o.referrerPolicy&&(a.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?a.credentials="include":o.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(o){if(o.ep)return;o.ep=!0;const a=r(o);fetch(o.href,a)}})();const y={};y.blurKernelSize=8;const te=.5;y.wOffset=(te+1)/(te-1);Math.abs(y.wOffset+2)<.01&&console.warn("The specified projection is too close to the projection plane and may result in visual artifacts.");y.borderFrag=`
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

#define wMid ${y.wOffset.toFixed(9)}
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
`;y.glitterFrag=`
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

#define wMid ${y.wOffset.toFixed(9)}
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
`;y.diffuseFrag=`
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

#define wMid ${y.wOffset.toFixed(9)}
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
`;y.textureVert=`
precision mediump float;
attribute vec3 pos;
attribute vec2 aTexel;
varying vec2 vTexel;

void main (void) {
  gl_Position = vec4(pos, 1.);
  vTexel = vec2(aTexel);
}
`;y.alphaCompositorFrag=`
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
`;y.texturedCompositorFrag=`
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
`;y.blur1dFrag=`
precision mediump float;
varying vec2 vTexel;

uniform sampler2D uTex;
#define kernelSize ${y.blurKernelSize}
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
`;y.projectorVert=`
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
  const float wOffset = ${y.wOffset.toFixed(9)};
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
`;const V=Math.PI;function ce(e,t,r){return typeof r>"u"&&(r=e),typeof t>"u"&&(t=e),[e,0,0,0,0,t,0,0,0,0,r,0,0,0,0,1]}function ue(e,t,r){return[1,0,0,0,0,1,0,0,0,0,1,0,e,t,r,1]}function X(e,t,r){e===r&&(r=[...r]),e===t&&(t=[...t]);for(let i=0;i<4;i++)e[i]=t[i]*r[0]+t[4+i]*r[1]+t[8+i]*r[2]+t[12+i]*r[3],e[4+i]=t[i]*r[4]+t[4+i]*r[5]+t[8+i]*r[6]+t[12+i]*r[7],e[8+i]=t[i]*r[8]+t[4+i]*r[9]+t[8+i]*r[10]+t[12+i]*r[11],e[12+i]=t[i]*r[12]+t[4+i]*r[13]+t[8+i]*r[14]+t[12+i]*r[15];return e}function j(e){e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1}function fe(e){return[Math.cos(e),Math.sin(e),0,0,-Math.sin(e),Math.cos(e),0,0,0,0,1,0,0,0,0,1]}function Re(e){let{near:t,far:r,left:i,right:o,top:a,bottom:l}=e;{const c=Math.tan(e.fov/2*Math.PI/180)*t,d=c/e.aspect;i=-c,o=c,a=d,l=-d}return[2*t/(o-i),0,0,0,0,2*t/(a-l),0,0,(o+i)/(o-i),(a+l)/(a-l),(t+r)/(t-r),-1,0,0,2*t*r/(t-r),0]}function Ae(e,t){return[e[3]*t[0]+e[0]*t[3]+e[1]*t[2]-e[2]*t[1],e[3]*t[1]-e[0]*t[2]+e[1]*t[3]+e[2]*t[0],e[3]*t[2]+e[0]*t[1]-e[1]*t[0]+e[2]*t[3],e[3]*t[3]-e[0]*t[0]-e[1]*t[1]-e[2]*t[2]]}class b extends Array{static product(t,r){return b.from(Ae(t,r))}static slerpUnit(t,r,i){let o=Math.acos(t.inner(r));if(Number.isNaN(o)||Math.abs(o)<1e-6)return r;const a=new b,l=Math.sin(o),c=Math.sin((1-i)*o)/l,d=Math.sin(i*o)/l;return a[0]=t[0]*c+r[0]*d,a[1]=t[1]*c+r[1]*d,a[2]=t[2]*c+r[2]*d,a[3]=t[3]*c+r[3]*d,a}static parse(t){try{t=t.replaceAll(" ","");const r=t.match(/(-?\d*\.?\d+)i/),i=t.match(/(-?\d*\.?\d+)j/),o=t.match(/(-?\d*\.?\d+)k/),a=t.match(/(-?\d*\.?\d+)(?![ijk\.])\b/);let l=0,c=0,d=0,u=0;return r?l=parseFloat(r[1]):t.match(/-i/)?l=-1:t.match(/i/)&&(l=1),i?c=parseFloat(i[1]):t.match(/-j/)?c=-1:t.match(/j/)&&(c=1),o?d=parseFloat(o[1]):t.match(/-k/)?d=-1:t.match(/k/)&&(d=1),a&&(u=parseFloat(a[1])),b.from([l,c,d,u])}catch{return b.from([0,0,0,0])}}constructor(){super(),this[0]=0,this[1]=0,this[2]=0,this[3]=1}toString(){return`${this[0].toFixed(16)}i + ${this[1].toFixed(16)}j + ${this[2].toFixed(16)}k + ${this[3].toFixed(16)}`}toFixedString(t=2){return`${this[0].toFixed(t).padStart(t+3)}i + ${this[1].toFixed(t).padStart(t+3)}j + ${this[2].toFixed(t).padStart(t+3)}k + ${this[3].toFixed(t).padStart(t+3)}`}log(t){const r="color:#fd0",i="color:#0a8";console.log(`${String(t||"").padEnd(10)}%c${o(this[0])}%ci + %c${o(this[1])}%cj + %c${o(this[2])}%ck + %c${o(this[3])}`,r,i,r,i,r,i,r);function o(a){return String(a.toFixed(2)).replace("0.00","0").replace("0.",".").replace("1.00","1").padStart(3)}}conjugate(){return b.from([-this[0],-this[1],-this[2],this[3]])}negative(){return b.from([-this[0],-this[1],-this[2],-this[3]])}inner(t){return this[0]*t[0]+this[1]*t[1]+this[2]*t[2]+this[3]*t[3]}geodesicDistance(t){return Math.acos(2*this.inner(t)**2-1)}magnitudeSquared(){return this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]}atAngle(t){const r=Math.sin(t),i=Math.cos(t);if(this[3]!==1||Math.abs(this[0])!==1&&Math.abs(this[1])!==1&&Math.abs(this[2])!==1)throw new Error("Quaternion not in correct format for atAngle (expecting 1 ± i, j, or k.)");return b.from([this[0]*r,this[1]*r,this[2]*r,this[3]*i])}invert(){const t=this.magnitudeSquared();return t<1e-6?this:(this[0]/=-t,this[1]/=-t,this[2]/=-t,this[3]/=t,this)}premultiply(t){const r=this[0],i=this[1],o=this[2],a=this[3];return this[0]=t[3]*r+t[0]*a+t[1]*o-t[2]*i,this[1]=t[3]*i-t[0]*o+t[1]*a+t[2]*r,this[2]=t[3]*o+t[0]*i-t[1]*r+t[2]*a,this[3]=t[3]*a-t[0]*r-t[1]*i-t[2]*o,this}postmultiply(t){const r=this[0],i=this[1],o=this[2],a=this[3];return this[0]=a*t[0]+r*t[3]+i*t[2]-o*t[1],this[1]=a*t[1]-r*t[2]+i*t[3]+o*t[0],this[2]=a*t[2]+r*t[1]-i*t[0]+o*t[3],this[3]=a*t[3]-r*t[0]-i*t[1]-o*t[2],this}apply(t,r){return this.premultiply(t),this.postmultiply(r),this}normalize(){const t=Math.sqrt(this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]);return t===0?this:(this[0]/=t,this[1]/=t,this[2]/=t,this[3]/=t,this)}}const E={};E.commonTesseractAnimation=function(){j(this.M3),j(this.M4),this.shared.animator&&this.shared.animator.call(this),X(this.M3,ce(2),this.M3),X(this.M3,ue(0,0,-20),this.M3)};E.initBlur=function(){const e=this.gl;this.uTex=e.getUniformLocation(this.program,"uTex"),this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.kernel=e.getUniformLocation(this.program,"kernel"),this.blurStep=e.getUniformLocation(this.program,"blurStep"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1fv(this.kernel,de(.1,y.blurKernelSize));const t=[e.createFramebuffer(),e.createFramebuffer()],r=[Y(e,e.TEXTURE0+3,()=>Math.floor(e.canvas.clientWidth/2)),Y(e,e.TEXTURE0+4,()=>Math.floor(e.canvas.clientWidth/2))];for(let i=0;i<t.length;i++)e.bindFramebuffer(e.FRAMEBUFFER,t[i]),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r[i],0),$(e);e.bindFramebuffer(e.FRAMEBUFFER,null),this.shared.blurRes||console.warn("Warning: initial blurRes unavailable."),this.shared.clearTexture||console.warn("Warning: initial clearTexture unavailable."),this.fboAlternates=t,this.texAlternates=r};E.drawBlur=function(){const e=this.gl;let t=1/this.shared.blurRes,r=0;e.viewport(0,0,this.shared.blurRes,this.shared.blurRes),e.disable(e.BLEND);const i=[!0,!0],o=n.blurPassCount;this.shared.readTexture=1,e.uniform1i(this.uTex,this.shared.readTexture);for(let a=0;a<o;a++)e.bindFramebuffer(e.FRAMEBUFFER,this.fboAlternates[a%2]),i[a%2]&&(e.clear(e.COLOR_BUFFER_BIT),i[a%2]=!1),e.uniform2fv(this.blurStep,[t,r]),[t,r]=[r,t],e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks),this.shared.readTexture=3+a%2,e.uniform1i(this.uTex,this.shared.readTexture);e.enable(e.BLEND)};E.prepareBlurSurfaces=function(){const e=this.gl,t=e.canvas.clientWidth;let r=null;if(e instanceof WebGLRenderingContext)_("✔ Bypassing MSAA.");else{let u=function(m,A){const T=e.canvas.clientWidth;if(r===T)return;const p=e.getParameter(e.RENDERBUFFER_BINDING);e.bindRenderbuffer(e.RENDERBUFFER,m),e.renderbufferStorageMultisample(e.RENDERBUFFER,c,A,T,T),e.bindFramebuffer(e.FRAMEBUFFER,d),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,l),e.bindRenderbuffer(e.RENDERBUFFER,p),r=T};var a=u;const l=e.createRenderbuffer(),c=Math.min(16,e.getParameter(e.MAX_SAMPLES)),d=e.createFramebuffer();Q("Applying "+c+"x MSAA"),_("Applying "+c+`x MSAA
`),u(l,e.RGBA8),window.addEventListener("resize",m=>{u(l,e.RGBA8)}),$(e),this.shared.fboAA=d}const i=Y(e,e.TEXTURE0+1,()=>e.canvas.clientWidth,e.RGBA),o=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,o),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),$(e),this.shared.res=t,this.shared.blurRes=Math.floor(t/2),this.shared.fboClear=o,this.shared.clearTexture=i,window.addEventListener("resize",l=>{this.shared.res=e.canvas.clientWidth,this.shared.blurRes=Math.floor(e.canvas.clientWidth/2)})};E.initTesseractBorder=function(){const e=this.gl;this.M3=[],this.M4=[],this.uM3=e.getUniformLocation(this.program,"M3"),this.uM4=e.getUniformLocation(this.program,"M4"),this.qModelL=e.getUniformLocation(this.program,"qModelL"),this.qModelR=e.getUniformLocation(this.program,"qModelR"),this.qViewL=e.getUniformLocation(this.program,"qViewL"),this.qViewR=e.getUniformLocation(this.program,"qViewR"),this.nearFrameColor=e.getUniformLocation(this.program,"nearFrameColor"),this.farFrameColor=e.getUniformLocation(this.program,"farFrameColor"),this.mesh.stride===8&&(this.normal=e.getAttribLocation(this.program,"normal"),e.enableVertexAttribArray(this.normal),e.vertexAttribPointer(this.normal,this.components,e.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4),this.specularColor1=e.getUniformLocation(this.program,"specularColor1"),this.specularColor2=e.getUniformLocation(this.program,"specularColor2"),this.specularColor3=e.getUniformLocation(this.program,"specularColor3"),this.specularColor4=e.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=e.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=e.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=e.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=e.getUniformLocation(this.program,"specularDirection4"),this.frameSpecularWeight=e.getUniformLocation(this.program,"frameSpecularWeight"))};E.drawTesseractBorder=function(){const e=this.gl;E.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.nearFrameColor,n.lighting.nearFrameColor),e.uniform4fv(this.farFrameColor,n.lighting.farFrameColor),this.frameSpecularWeight&&e.uniform1f(this.frameSpecularWeight,n.lighting.borderSpecularity),this.mesh.stride===8&&(e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw)),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};E.initGlassTesseract=function(){var r;const e=this.gl;this.M3=[],this.M4=[],this.uM3=e.getUniformLocation(this.program,"M3"),this.uM4=e.getUniformLocation(this.program,"M4"),this.normal=e.getAttribLocation(this.program,"normal"),this.qModelL=e.getUniformLocation(this.program,"qModelL"),this.qModelR=e.getUniformLocation(this.program,"qModelR"),this.qViewL=e.getUniformLocation(this.program,"qViewL"),this.qViewR=e.getUniformLocation(this.program,"qViewR"),this.opacity=e.getUniformLocation(this.program,"opacity"),this.glowColor=e.getUniformLocation(this.program,"glowColor"),this.membraneColor=e.getUniformLocation(this.program,"membraneColor"),this.diffuseColor1=e.getUniformLocation(this.program,"diffuseColor1"),this.diffuseColor2=e.getUniformLocation(this.program,"diffuseColor2"),this.diffuseColor3=e.getUniformLocation(this.program,"diffuseColor3"),this.diffuseDirection1=e.getUniformLocation(this.program,"diffuseDirection1"),this.diffuseDirection2=e.getUniformLocation(this.program,"diffuseDirection2"),this.diffuseDirection3=e.getUniformLocation(this.program,"diffuseDirection3"),this.specularColor1=e.getUniformLocation(this.program,"specularColor1"),this.specularColor2=e.getUniformLocation(this.program,"specularColor2"),this.specularColor3=e.getUniformLocation(this.program,"specularColor3"),this.specularColor4=e.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=e.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=e.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=e.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=e.getUniformLocation(this.program,"specularDirection4"),e.enableVertexAttribArray(this.normal),e.vertexAttribPointer(this.normal,this.components,e.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4);const t=e.canvas.clientWidth;(r=this.shared).res??(r.res=t),window.addEventListener("resize",i=>{this.shared.res=e.canvas.clientWidth})};E.drawGlassTesseract=function(){const e=this.gl;if(this.opacityFunction){const t=this.opacityFunction.call(this);if(t<=.001)return;e.uniform1f(this.opacity,t)}E.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.glowColor,n.lighting.glow.rgba),e.uniform4fv(this.membraneColor,n.lighting.membrane.rgba),e.uniform4fv(this.diffuseColor1,n.lighting.diffuseLights[0].rgba),e.uniform4fv(this.diffuseColor2,n.lighting.diffuseLights[1].rgba),e.uniform4fv(this.diffuseColor3,n.lighting.diffuseLights[2].rgba),e.uniform4fv(this.diffuseDirection1,n.lighting.diffuseLights[0].xyzw),e.uniform4fv(this.diffuseDirection2,n.lighting.diffuseLights[1].xyzw),e.uniform4fv(this.diffuseDirection3,n.lighting.diffuseLights[2].xyzw),e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw),e.viewport(0,0,this.shared.res,this.shared.res),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};E.useClearTarget=function(){const e=this.gl;this.shared.fboAA?e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboClear),e.viewport(0,0,this.shared.res,this.shared.res),e.clear(e.COLOR_BUFFER_BIT)};E.resolveClearTarget=function(){const e=this.gl;this.shared.fboAA&&(e.bindFramebuffer(e.READ_FRAMEBUFFER,this.shared.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,this.shared.fboClear),e.blitFramebuffer(0,0,this.shared.res,this.shared.res,0,0,this.shared.res,this.shared.res,e.COLOR_BUFFER_BIT,e.NEAREST))};E.initTexturedCompositor=function(){const e=this.gl;this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.uBlurTex=e.getUniformLocation(this.program,"blurTex"),this.uClearTex=e.getUniformLocation(this.program,"clearTex"),this.uLensTex=e.getUniformLocation(this.program,"lensTex"),this.uClarityScale=e.getUniformLocation(this.program,"clarityScale"),this.uCloudShiftSmall=e.getUniformLocation(this.program,"cloudShiftSmall"),this.uCloudShiftMedium=e.getUniformLocation(this.program,"cloudShiftMedium"),this.uCloudShiftLarge=e.getUniformLocation(this.program,"cloudShiftLarge"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1i(this.uBlurTex,0),e.uniform1i(this.uClearTex,1),e.uniform1i(this.uLensTex,5),this.lensTexture=e.createTexture(),e.activeTexture(e.TEXTURE0+5),e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));const t=new Image;t.addEventListener("load",()=>{const r=e.getParameter(e.TEXTURE_BINDING_2D);e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.generateMipmap(e.TEXTURE_2D),e.bindTexture(e.TEXTURE_2D,r)}),t.src="/tesseract/cloud-1.png"};E.drawTexturedCompositor=function(){const e=this.gl;e.uniform2fv(this.uCloudShiftSmall,[this.dt/12e4%1,this.dt/-95e3%1]),e.uniform2fv(this.uCloudShiftMedium,[this.dt/-37e3%1,this.dt/12e4%1]),e.uniform2fv(this.uCloudShiftLarge,[this.dt/-6e5%1,this.dt/65e3%1]),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.shared.res,this.shared.res),e.uniform1i(this.uBlurTex,this.shared.readTexture),e.uniform1f(this.uClarityScale,n.clarityScale),e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks)};function Y(e,t,r,i){const o=e,a=o.createTexture();let l=null,c=null;i??(i=o.RGBA),typeof r=="function"?(l=r(),c=l,window.addEventListener("resize",u=>{const m=o.getParameter(o.TEXTURE_BINDING_2D);l=r(),c!==l&&(o.bindTexture(o.TEXTURE_2D,a),d(),o.bindTexture(o.TEXTURE_2D,m),c=l)})):(l=r,c=l),o.activeTexture(t),o.bindTexture(o.TEXTURE_2D,a),i===o.DEPTH_COMPONENT16||i===o.DEPTH_COMPONENT?(o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.NEAREST),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.NEAREST)):(o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR)),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE),d();function d(){if(i===o.RGBA)o.texImage2D(o.TEXTURE_2D,0,i,l,l,0,o.RGBA,o.UNSIGNED_BYTE,null);else if(i===o.DEPTH_COMPONENT)o.texImage2D(o.TEXTURE_2D,0,i,l,l,0,o.DEPTH_COMPONENT,o.UNSIGNED_SHORT,null);else if(i===o.DEPTH_COMPONENT16)o.texImage2D(o.TEXTURE_2D,0,i,l,l,0,o.DEPTH_COMPONENT,o.UNSIGNED_SHORT,null);else throw new Error("Unsupported texture format for blankTexture.")}return a}function $(e){const t=e.checkFramebufferStatus(e.FRAMEBUFFER);if(t!==e.FRAMEBUFFER_COMPLETE){Q("test:");const r=Object.keys(Object.getPrototypeOf(e)).filter(i=>i.startsWith("FRAMEBUFFER"));for(const i of r)e[i]===t&&_("Framebuffer incomplete: "+i)}}const D=class D{constructor(){this.specularLights=[new D.Light({xyzw:[-.707106781,0,.707106781,0]}),new D.Light({xyzw:[0,-.707106781,0,-.707106781]}),new D.Light({xyzw:[.577350269,.577350269,-.577350269,0]}),new D.Light({xyzw:[0,0,-1,0]})],this.diffuseLights=[new D.Light({xyzw:[-.707106781,0,.707106781,0]}),new D.Light({xyzw:[0,-.707106781,0,-.707106781]}),new D.Light({xyzw:[0,0,0,-1]})],this.glow=new D.Light,this.glow.rgba[3]=.05,this.membrane=new D.Light,this.nearFrameColor=[0,0,0,0],this.farFrameColor=[0,0,0,0],this.diffuseOpacity=1,this.specularOpacity=1,this.borderSpecularity=0}};I(D,"Light",class{constructor(t={}){I(this,"xyzw",[0,0,0,0]);I(this,"rgba",[0,0,0,0]);t.xyzw&&(this.xyzw=[...t.xyzw]),t.rgba&&(this.rgba=[...t.rgba])}});let N=D;function de(e,t){const o=Math.sqrt(-2*e**2*Math.log(.06*e*Math.sqrt(2*V)))/(t-1),a=[];let l=0,c=0;for(let u=0;u<t;u++){const m=d(l);a.push(m),c+=2*m,l+=o}return c-=d(0),a.forEach((u,m)=>a[m]=u/c),a;function d(u){return 1/(e*Math.sqrt(2*V))*Math.exp(-.5*(u/e)**2)}}class me extends Array{constructor(){super(...arguments);I(this,"stride",1)}static from(...r){let i=super.from(...r);return r[0].stride&&(i.stride=r[0].stride),i}get blocks(){return this.length/this.stride}get byteStride(){return this.stride*Float32Array.BYTES_PER_ELEMENT}log(r=""){console.log("  "+r+` ${this.length} elements / ${this.stride} stride = ${this.blocks} blocks`);for(let i=0;i<this.length;i+=this.stride){let o=`${i/this.stride})`.padEnd(5)+"<".padStart(5);for(let a=0;a<this.stride;a++)o+=this[i+a].toFixed(2).padStart(7)+(a<this.stride-1?",":"");o+="  >",console.log(o)}}replace(r,i=this.stride){const o=[];let a=0;for(let l=0;l<this.length;l+=i){const c=[];for(let u=0;u<i;u++)c.push(this[l+u]);const d=r(c);o.push(...d),a=d.length}return this.stride=a,this.length=0,this.push(...o),this}interleave(r,i=this.stride){const o=[];let a=0;for(let l=0;l<this.length;l+=i){const c=[];for(let u=0;u<i;u++)c.push(this[l+u]);const d=r(c);o.push(...c,...d),a=d.length}return this.stride+=a,this.length=0,this.push(...o),this}invertTriangles(){return this.replace(Fe,9)}sproutNormals(){return this.replace(r=>{const i=triangleNormal3(r);return[r[0],r[1],r[2],...i,r[3],r[4],r[5],...i,r[6],r[7],r[8],...i]},9)}}const C={};C.square2d=[-1,-1,1,-1,1,1,-1,1];C.texSquare=me.from(C.square2d);C.texSquare.stride=2;C.texSquare.interleave(e=>[(e[0]+1)/2,(e[1]+1)/2]);C.texSquare.stride=4;C.tesseractOutline=he(Se,8);C.normalTesseract=he(Ce,8);function Fe(e){return[e[0],e[1],e[2],e[6],e[7],e[8],e[3],e[4],e[5]]}function he(e,t){const r=new me,i=e.bind(r),o=[-1,1,1,1],a=[-1,-1,1,1],l=[1,-1,1,1],c=[1,1,1,1],d=[1,1,-1,1],u=[1,-1,-1,1],m=[-1,-1,-1,1],A=[-1,1,-1,1],T=[-1,1,1,-1],p=[-1,-1,1,-1],f=[1,-1,1,-1],h=[1,1,1,-1],x=[1,1,-1,-1],R=[1,-1,-1,-1],w=[-1,-1,-1,-1],F=[-1,1,-1,-1];return i(o,a,l,c),i(o,A,m,a),i(A,d,u,m),i(d,c,l,u),i(o,c,d,A),i(l,a,m,u),i(T,p,f,h),i(F,w,p,T),i(F,x,R,w),i(h,f,R,x),i(F,T,h,x),i(p,w,R,f),i(o,T,p,a),i(c,h,f,l),i(d,x,R,u),i(A,F,w,m),i(a,p,f,l),i(m,w,p,a),i(u,R,w,m),i(l,f,R,u),i(o,T,h,c),i(A,F,T,o),i(d,x,F,A),i(c,h,x,d),r.stride=t,r}function Se(e,t,r,i){const a=[],[l,c,d,u]=[[],[],[],[]];for(let m=0;m<4;m++)l[m]=(e[m]+t[m])/2,c[m]=(t[m]+r[m])/2,d[m]=(r[m]+i[m])/2,u[m]=(i[m]+e[m])/2;for(let m=0;m<4;m++)a[m]=(e[m]+t[m]+r[m]+i[m])/4;for(const[m,A,T]of[[e,t,l],[t,r,c],[r,i,d],[i,e,u]]){const p=[],f=[];for(let h=0;h<4;h++)p[h]=m[h]*(1-.04)+a[h]*.04;for(let h=0;h<4;h++)f[h]=A[h]*(1-.04)+a[h]*.04;this.push(...[m,T,A,T,p,T,p,T,A,T,f,T].flat())}}function Ce(e,t,r,i){const o=[];for(let a=0;a<4;a++)o[a]=(e[a]+t[a]+r[a]+i[a])/4;this.push(...[e,o,t,o,r,o,e,o,r,o,i,o].flat())}const Me='[{"name":"blossom","string":"{\\"Lstring\\":\\"0.3770087083426957i + -0.7913019518279542j + 0.4250500001960014k + -0.2259162503972059\\",\\"Rstring\\":\\"-0.5671411517174197i + -0.3997880634675983j + 0.0339703232464508k + -0.7192818887397743\\",\\"velocity\\":[0,0,0,0,0.0625,0,0,0,0,0,0,-0.0625],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.03536487511244542,0.13252253894422736,-0.9905488893941868,-8.673617379884035e-19],\\"rgba\\":[0.6862745098039216,0.4117647058823529,1.2352941176470589,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.34901960784313724,0,0.07058823529411765,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.32941176470588235,0.403921568627451,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.27450980392156865,0.17647058823529413,0.615686274509804,0.10980392156862745]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.058823529411764705,0.047058823529411764,0.07058823529411765,0.5686274509803921]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.35294117647058826,0.12156862745098039,0.23921568627450981,0.09019607843137255],\\"diffuseOpacity\\":1,\\"specularOpacity\\":2,\\"borderSpecularity\\":0.2}}"},{"name":"first light","string":"{\\"Lstring\\":\\"0.1071288310610887i + -0.5278657488370966j + -0.0673330530359743k + 0.8398496441248096\\",\\"Rstring\\":\\"-0.0459106443189584i + 0.9243623345765215j + 0.1179090293992739k + 0.3599221415085698\\",\\"velocity\\":[0,0.0375,0,0,-0.05625,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0.4549019607843137,0.9568627450980393,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-1,-1,-1,0.14901960784313725]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-0.9019607843137255,0.011764705882352941,0.21568627450980393,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[-0.8196078431372549,0.10196078431372549,1,0.1411764705882353]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[-0.0392156862745098,-0.0392156862745098,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.11764705882352941,0,-0.09803921568627451,0.058823529411764705]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.17647058823529413,0.12156862745098039,0.058823529411764705,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.29411764705882354,0.08235294117647059,0,0.12549019607843137]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.043137254901960784,0.03137254901960784,0.1568627450980392,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.7843137254901961,0.23529411764705882,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":3,\\"borderSpecularity\\":0.4}}"},{"name":"aquarius","string":"{\\"Lstring\\":\\"0.3606987087850542i + -0.6427843814039939j + -0.0347757345848848k + -0.6749187571787967\\",\\"Rstring\\":\\"0.2324618090832823i + 0.5393663467140035j + 0.7056944671560963k + 0.3962836993609121\\",\\"velocity\\":[0,0.037500000000000006,0,0,0.037500000000000006,0,0,0,0,0,0,0.11249999999999999],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.11764705882352941,0.5411764705882353,0.6352941176470588,0.12941176470588234]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[1.4470588235294117,2.458823529411765,3,0.12941176470588234]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0.11764705882352941,1.011764705882353,0.5176470588235293,0.12941176470588234]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.6039215686274509,1.2078431372549019,1.015686274509804,3.67843137254902]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.18823529411764706,-0.11372549019607843,-0.12941176470588237,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.17254901960784313,-0.11764705882352941,-0.35294117647058826,0.25882352941176473]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.00392156862745098,0.3058823529411765,0.6392156862745098,0.1450980392156863]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.34901960784313724,0.19215686274509805,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"wintersun","string":"{\\"Lstring\\":\\"0.3719736765396583i + 0.2101507393543021j + -0.0868600418969983k + -0.8999597678969921\\",\\"Rstring\\":\\"-0.5675448115073667i + 0.3688262435741262j + 0.3145224238654931k + 0.6655341718267085\\",\\"velocity\\":[0,0.046875,0,0,-0.046875,0,0,0,0,-0.032812499999999994,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[2.9058823529411764,0,0,0.7835294117647059]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,1.2470588235294118,1.2470588235294118,0.7835294117647059]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[2.8705882352941177,1.223529411764706,0,0.36000000000000004]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,1.1803921568627451,6.698039215686275,1.828235294117647]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7176470588235294,0.09019607843137255,0,0.5098039215686274]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3254901960784314,0.2784313725490196,0.8627450980392157,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"trance","string":"{\\"Lstring\\":\\"-0.7227606368739261i + 0.1427279015970619j + 0.5724411835866986k + -0.3599401328360199\\",\\"Rstring\\":\\"0.1062919047636684i + 0.3554399758333309j + 0.9158459902528523k + -0.1535922416657187\\",\\"velocity\\":[0,0,0,0,0,0,0,0,0,0,-0.0525,0.0875],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[1,0,0,3]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0.7529411764705882,1.5058823529411764,3]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-2.7294117647058824,0.6588235294117647,1.2000000000000002,2.776470588235294]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3568627450980392,-0.5490196078431373,-4.145098039215687,7]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.8745098039215686,0.10588235294117647,0.13333333333333333,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0.07450980392156863,0.12941176470588237,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9725490196078431,0.5098039215686274,0.3137254901960784,0]},\\"nearFrameColor\\":[0.49411764705882353,0.2092156862745098,0.226078431372549,0],\\"farFrameColor\\":[1,0.62,0.49,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"anemochore","string":"{\\"Lstring\\":\\"-0.0805261893707946i + 0.2743728554710255j + 0.7017029562350887k + 0.6525703258675746\\",\\"Rstring\\":\\"0.2435454850858778i + 0.1498350015448846j + 0.8141109929302610k + 0.5054288873636178\\",\\"velocity\\":[0.05,0,0,0,0,-0.0625,-0.03125,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.2627450980392157,0.19607843137254902,0.1450980392156863,0]},{\\"xyzw\\":[0.6600685039065106,-0.21578419676780547,0.7174669903527193,-0.05466139707421265],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.3176470588235294,0.09411764705882353,0,0.2]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.9019607843137255,0.6823529411764706,0.5490196078431373,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.666527037335581,-0.5579300285182619,0.03514599234409593,-0.4931739561254359],\\"rgba\\":[0.21568627450980393,0.07450980392156863,0.043137254901960784,0.054901960784313725]},{\\"xyzw\\":[0.6037489214813726,-0.3757445940833738,0.006975561737554433,-0.7030324184315015],\\"rgba\\":[0.45098039215686275,0.20392156862745098,0.14901960784313725,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.4627450980392157,0.28627450980392155,0.1803921568627451,0.047058823529411764]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.23529411764705882,0.06274509803921569,0.050980392156862744,0.06666666666666667]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.27450980392156865,0.1568627450980392,0.23529411764705882,0.21568627450980393]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"ember iris","string":"{\\"Lstring\\":\\"-0.5579837100826338i + 0.7786196862397065j + -0.2465777870033310k + -0.1469862525466535\\",\\"Rstring\\":\\"0.7850300329947077i + 0.5489283048032018j + -0.1441205277920669k + -0.2482636440357161\\",\\"velocity\\":[0.03125,0,0,0,0,-0.06875,0,-0.0125,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,0,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.7921568627450981,0.023529411764705882,0.12156862745098039,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.24313725490196078,0.3176470588235294,0,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.11764705882352941,0.35294117647058826,0.9019607843137255,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7843137254901961,0,-0.2901960784313726,0.20784313725490197]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.06666666666666668,0.00392156862745098,0.34509803921568627,0]},\\"nearFrameColor\\":[0.0392156862745098,0.011764705882352941,0.00392156862745098,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":0.7,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"captured light","string":"{\\"Lstring\\":\\"0.8480253023376401i + 0.2909808138529828j + -0.4380945786750333k + 0.0652410353674748\\",\\"Rstring\\":\\"-0.6875523541633705i + 0.3206171828092015j + 0.4168948500298034k + -0.5006746112846883\\",\\"velocity\\":[0,0,0.05,0.06875,0,0,0,0,0,-0.0375,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.20392156862745098,0.22745098039215686,0.396078431372549,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.707106781,0,-0.707106781,0],\\"rgba\\":[-0.16862745098039217,-0.23529411764705882,-0.19215686274509805,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0,0,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.24313725490196078,0.21568627450980393,0.1568627450980392,0.03137254901960784]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"chromophore","string":"{\\"Lstring\\":\\"0.2461767777234436i + -0.1454713892950948j + 0.4874959217027777k + 0.8249744210049221\\",\\"Rstring\\":\\"-0.2729822245975122i + -0.0851213019540162j + 0.2852539441146569k + 0.9148033976466068\\",\\"velocity\\":[0.05,0,0,0,0,-0.05,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.8901960784313725,0.5490196078431373,0.45098039215686275,0.19607843137254902]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.2901960784313726,0.1843137254901961,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.19607843137254902,-1,0.5176470588235295,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3764705882352941,0.11372549019607843,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.34111195854061166,-0.4786795739877712,2.949029909160572e-17,-0.8090169943749477],\\"rgba\\":[-0.15294117647058825,0.16862745098039217,0.10980392156862745,0.19607843137254902]},{\\"xyzw\\":[0.13048778609679595,-0.573118173234877,2.42861286636753e-17,-0.809016994374948],\\"rgba\\":[0.1843137254901961,-0.1607843137254902,0.16862745098039217,0.19607843137254902]},{\\"xyzw\\":[0,0.5877852522924736,0,-0.8090169943749472],\\"rgba\\":[0.27450980392156865,0.058823529411764705,-0.19607843137254902,0.19607843137254902]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.39215686274509803,0.22745098039215686,0.5294117647058824,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.0784313725490196,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.0392156862745098,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"}]';window.onerror=De;document.querySelector(".loading-notice").classList.add("hidden");const Q=console.log.bind(console),B=document.getElementById.bind(document),n={animationSpeeds:[],lighting:new N,viewL:new b,viewR:new b,releasedViewL:new b,releasedViewR:new b,viewSnapT:1,grabStyle:"3d",modelL:new b,modelR:new b,initialModelL:new b,initialModelR:new b,finalModelL:new b,finalModelR:new b,modelSnapT:1,blurPassCount:2,clarityScale:0,animation1:{keepAnimating:!0},animationSet:[],animationCycle:{},upcomingAnimations:[],currentAnimation:{},countdowns:[]},K=n.animationSet;function _(e){document.querySelector(".feedback").style.visibility="visible",document.querySelector(".feedback").textContent+=e+`
`}function De(e,t,r,i,o){_("⚠️ "+e),_(t),_("Line: "+r),_("Col: "+i),_(o)}Ue();function Ue(){try{let c=function(p){return p<.5?8*p**4:1-Math.pow(-2*p+2,4)/2},d=function(p){var h;if(!n.clarityTransition)return;(h=n.clarityTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.clarityTransition.tStart)/n.clarityTransition.duration);n.clarityScale=U(n.clarityTransition.initial,n.clarityTransition.final,f),f===1&&delete n.clarityTransition},u=function(p){var h;if(!n.lightTransition)return;(h=n.lightTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.lightTransition.tStart)/n.lightTransition.duration);n.lighting=qe(n.lightTransition.initial,n.lightTransition.final,f),f===1&&delete n.lightTransition},m=function(p){var h;if(!n.velocityTransition)return;(h=n.velocityTransition).tStart??(h.tStart=p);const f=Math.min(1,(p-n.velocityTransition.tStart)/n.velocityTransition.duration);n.animationSpeeds=Ie(n.velocityTransition.initial,n.velocityTransition.final,f),f===1&&delete n.velocityTransition},A=function(p,f){var R;if(!n.orientationTransition){ie(n.animationSpeeds,n.modelL,n.modelR,f);return}(R=n.orientationTransition).tStart??(R.tStart=p);const h=Math.min(1,(p-n.orientationTransition.tStart)/n.orientationTransition.duration),x=c(h);ie(n.orientationTransition.initial.animationSpeeds,n.orientationTransition.initial.modelL,n.orientationTransition.initial.modelR,f),n.modelL=b.slerpUnit(n.orientationTransition.initial.modelL,n.orientationTransition.final.modelL,x),n.modelR=b.slerpUnit(n.orientationTransition.initial.modelR,n.orientationTransition.final.modelR,x),h===1&&(n.animationSpeeds=[...n.orientationTransition.final.animationSpeeds],delete n.orientationTransition)},T=function(){if(this.t??(this.t=0),this.tLast??(this.tLast=this.dt),!n.pointerdown){const p=this.dt-this.tLast;if(this.t+=p,this.shared.animationState.needUpdate){d(this.t),u(this.t),m(this.t),A(this.t,p),n.modelSnapT<1&&(n.modelSnapT+=(this.dt-this.tLast)/2e3,n.modelSnapT=Math.min(n.modelSnapT,1),n.modelL=b.slerpUnit(n.initialModelL,n.finalModelL,c(n.modelSnapT)),n.modelR=b.slerpUnit(n.initialModelR,n.finalModelR,c(n.modelSnapT))),n.viewSnapT<1&&(n.viewSnapT+=(this.dt-this.tLast)/2e3,n.viewSnapT=Math.min(n.viewSnapT,1),n.viewL=b.slerpUnit(n.releasedViewL,b.from([0,0,0,1]),n.viewSnapT),n.viewR=b.slerpUnit(n.releasedViewR,b.from([0,0,0,1]),n.viewSnapT));const f=this.dt-this.tLast;let h=!1;for(const x of[...n.countdowns])x.remaining-=f,x.remaining<0&&(x.callback(),h=!0);h&&(n.countdowns=n.countdowns.filter(x=>x.remaining>0)),this.shared.animationState.needUpdate=!1}}this.tLast=this.dt,this.gl.uniform4fv(this.qViewL,n.viewL),this.gl.uniform4fv(this.qViewR,n.viewR),this.gl.uniform4fv(this.qModelL,n.modelL),this.gl.uniform4fv(this.qModelR,n.modelR)};var e=c,t=d,r=u,i=m,o=A,a=T;_("Script loaded."),Xe(),Ve(),We();for(const p of[B("main-canvas")])if(p){const f=p.getBoundingClientRect();p.setAttribute("width",f.width),p.setAttribute("height",f.height)}let l=B("main-canvas").getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1});l||(l=B("main-canvas").getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}));for(const[p,f]of[[l,B("first-title").querySelector(".view-label")]])p.canvas.width=p.canvas.clientWidth,p.canvas.height=p.canvas.clientHeight,f.innerHTML=p.getParameter(p.VERSION)+"<br>"+p.getParameter(p.SHADING_LANGUAGE_VERSION),p instanceof WebGLRenderingContext||(f.innerHTML+="<br>"+p.getParameter(p.MAX_SAMPLES)+"x MSAA support");n.animation1.context=l,n.animation1.showFPS=()=>{B("fps-1").textContent=n.animation1.lastFPS.toFixed(1)+" FPS"},n.animation1.draw=_e(l,{animationState:n.animation1,nearPlane:1,farPlane:100,animator:T},[{init:E.prepareBlurSurfaces,draw:E.useClearTarget},{vertexShader:y.projectorVert,fragmentShader:y.borderFrag,mesh:C.tesseractOutline,components:4,init:E.initTesseractBorder,draw:E.drawTesseractBorder},{vertexShader:y.projectorVert,fragmentShader:y.diffuseFrag,opacityFunction:()=>n.lighting.diffuseOpacity,mesh:C.normalTesseract,components:4,init:E.initGlassTesseract,draw:E.drawGlassTesseract},{vertexShader:y.projectorVert,fragmentShader:y.glitterFrag,opacityFunction:()=>n.lighting.specularOpacity,mesh:C.normalTesseract,components:4,init:E.initGlassTesseract,draw:E.drawGlassTesseract},{draw:E.resolveClearTarget},{vertexShader:y.textureVert,fragmentShader:y.blur1dFrag,mesh:C.texSquare,init:E.initBlur,draw:E.drawBlur},{vertexShader:y.textureVert,fragmentShader:y.texturedCompositorFrag,mesh:C.texSquare,init:E.initTexturedCompositor,draw:E.drawTexturedCompositor}])}catch(l){_(`
🚩 Initialization error: `+l.message+`
`+l.stack)}}function Pe(e){if(!e.createVertexArray){const r=e.getExtension("OES_vertex_array_object");e.VERTEX_ARRAY_BINDING=r.VERTEX_ARRAY_BINDING_OES,e.createVertexArray=r.createVertexArrayOES.bind(r),e.deleteVertexArray=r.deleteVertexArrayOES.bind(r),e.isVertexArray=r.isVertexArrayOES.bind(r),e.bindVertexArray=r.bindVertexArrayOES.bind(r)}const t=e.getExtension("WEBGL_depth_texture");t?(e.appropriateDepthFormat=e.DEPTH_COMPONENT,e.depthTextureExt=t):e.appropriateDepthFormat=e.DEPTH_COMPONENT16}function _e(e,t,r=[]){try{let o=function(a){Be(a,t.animationState),o.pauseTime??(o.pauseTime=0),o.t0??(o.t0=a),o.pauseTime&&(o.t0+=a-o.pauseTime,o.pauseTime=0);const l=a-o.t0;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);for(const c of r)c.dt=l,c.program&&(e.bindVertexArray(c.vao),e.useProgram(c.program)),c.draw();t.animationState.keepAnimating?(t.animationState.needUpdate=!0,requestAnimationFrame(o)):o.pauseTime=a};var i=o;if(!r.length)throw new Error("No rendering phases specified.");if(!t.animationState)throw new Error("animationState needed.");Pe(e),t.nearPlane??(t.nearPlane=.1),t.farPlane??(t.farPlane=1e3),t.projection=Re({near:t.nearPlane,far:t.farPlane,fov:12,aspect:1});for(const a of r){if(a.gl=e,a.shared=t,a.components??(a.components=3),!a.draw)throw new Error("Draw method needed.");if(!a.vertexShader||!a.fragmentShader||!a.mesh){a.init&&a.init();continue}let l=re(e,a.vertexShader,e.VERTEX_SHADER),c=re(e,a.fragmentShader,e.FRAGMENT_SHADER);a.program=e.createProgram(),e.attachShader(a.program,l),e.attachShader(a.program,c),ze(e,a.program),e.deleteShader(l),e.deleteShader(c),l=null,c=null,a.vao=e.createVertexArray(),e.bindVertexArray(a.vao),a.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,a.vbo),e.bufferData(e.ARRAY_BUFFER,new Float32Array(a.mesh),e.STATIC_DRAW),a.model=e.getUniformLocation(a.program,"model"),a.view=e.getUniformLocation(a.program,"view"),a.projection=e.getUniformLocation(a.program,"projection"),a.pos=e.getAttribLocation(a.program,"pos"),e.useProgram(a.program),e.uniformMatrix4fv(a.projection,!1,t.projection),e.enableVertexAttribArray(a.pos),e.vertexAttribPointer(a.pos,a.components,e.FLOAT,!1,a.mesh.byteStride,0),a.init&&a.init()}return e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),requestAnimationFrame(o),o}catch(o){document.querySelector(".feedback").style.visibility="visible",o.cause?document.querySelector(".feedback").innerHTML=ke(o):document.querySelector(".feedback").textContent+="❌ "+o.message+`
`,Q(o)}}function Be(e,t){var i;t.intervalStart??(t.intervalStart=e),t.frameCount??(t.frameCount=0),t.frameCount++;const r=e-t.intervalStart;r>1e3&&(t.lastFPS=1e3*t.frameCount/r,t.intervalStart=e,t.frameCount=0,(i=t.showFPS)==null||i.call(t))}function re(e,t,r){const i=e.createShader(r);if(e.shaderSource(i,t),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(i),{cause:t});return i}function ze(e,t){if(e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(t))}function ke(e){var a,l;const t=((a=e.cause)==null?void 0:a.split(`
`))||["~"],r=parseInt((l=e.message.match(/\d:(\d+)/))==null?void 0:l[1]),i=t[r-1];return t[r-1]=`<span style="color:#f44">${i}</span>`,`<span style="color:#efa">${e.message}</span>`+t.filter((c,d)=>Math.abs(r-d)<4).join("<br>")}const W=[{L:b.from([0,0,1,1]),R:b.from([0,0,-1,1])},{L:b.from([0,1,0,1]),R:b.from([0,-1,0,1])},{L:b.from([1,0,0,1]),R:b.from([-1,0,0,1])},{L:b.from([1,0,0,1]),R:b.from([1,0,0,1])},{L:b.from([0,1,0,1]),R:b.from([0,1,0,1])},{L:b.from([0,0,1,1]),R:b.from([0,0,1,1])}];function ie(e,t,r,i){for(const[o,a]of e.entries()){if(Math.abs(a)<1e-6)continue;const l=i*a*V/1e3;o<6?(t.postmultiply(W[o].L.atAngle(l)),r.premultiply(W[o].R.atAngle(l))):(t.premultiply(W[o%6].L.atAngle(l)),r.postmultiply(W[o%6].R.atAngle(l)))}}function J(e,t){delete n.clarityTransition,n.clarityTransition={initial:n.clarityScale,final:e,duration:t}}function pe(e,t,r){delete n.velocityTransition,n.velocityTransition={initial:e,final:t,duration:r}}function Ne(e,t=2e3){delete n.orientationTransition,n.orientationTransition={initial:{animationSpeeds:[...n.animationSpeeds],modelL:b.from(n.modelL),modelR:b.from(n.modelR)},final:e,duration:t}}function ge(e,t,r=2e3){delete n.lightTransition,n.lightTransition={initial:e,final:t,duration:r}}function Oe(e=3e3){J(1,e/2),ge(new N,n.currentAnimation.lighting,e),pe(Array(12).fill(0),n.animationSpeeds,e/4)}function Ie(e,t,r){return e.map((i,o)=>U(i,t[o],r))}function qe(e,t,r){const i=new N;for(const o of["specularLights","diffuseLights"])for(const a in e[o])i[o][a]=G(e[o][a],t[o][a],r);return i.glow=G(e.glow,t.glow,r),i.membrane=G(e.membrane,t.membrane,r),i.nearFrameColor=e.nearFrameColor.map((o,a)=>U(o,t.nearFrameColor[a],r)),i.farFrameColor=e.farFrameColor.map((o,a)=>U(o,t.farFrameColor[a],r)),i.diffuseOpacity=U(e.diffuseOpacity,t.diffuseOpacity,r),i.specularOpacity=U(e.specularOpacity,t.specularOpacity,r),i.borderSpecularity=U(e.borderSpecularity,t.borderSpecularity,r),i}function G(e,t,r){const i=[e.rgba[0]>=0&&t.rgba[0]>=0,e.rgba[1]>=0&&t.rgba[1]>=0,e.rgba[2]>=0&&t.rgba[2]>=0];function o(u){return Math.abs(u)<.04045?u/12.92:Math.pow((u+.055)/1.055,2.4)}function a(u){return Math.abs(u)<.0031308?u*12.92:1.055*Math.pow(u,1/2.4)-.055}const l=[i[0]?o(e.rgba[0]):e.rgba[0],i[1]?o(e.rgba[1]):e.rgba[1],i[2]?o(e.rgba[2]):e.rgba[2],e.rgba[3]],c=[i[0]?o(t.rgba[0]):t.rgba[0],i[1]?o(t.rgba[1]):t.rgba[1],i[2]?o(t.rgba[2]):t.rgba[2],t.rgba[3]],d=[U(l[0],c[0],r),U(l[1],c[1],r),U(l[2],c[2],r),U(l[3],c[3],r)];return new N.Light({xyzw:e.xyzw.map((u,m)=>U(u,t.xyzw[m],r)),rgba:[i[0]?a(d[0]):d[0],i[1]?a(d[1]):d[1],i[2]?a(d[2]):d[2],d[3]]})}function U(e,t,r){return r*t+(1-r)*e}function Ve(){const e=JSON.parse(Me);for(const{name:t,string:r}of e){const i=JSON.parse(r);i.lighting.glow.rgba[3]===0&&(i.lighting.glow.rgba[3]=.05),n.animationSet.push({title:t,modelL:b.parse(i.Lstring),modelR:b.parse(i.Rstring),animationSpeeds:i.velocity,lighting:i.lighting,active:!0})}}function Z(){const e=[];n.upcomingAnimations=[];const t=n.animationSet.filter(r=>r.active);for(let r=0;r<t.length;r++)e[r]=r;for(;e.length;){const r=Math.floor(Math.random()*e.length),i=e.splice(r,1)[0];n.upcomingAnimations.push(t[i])}n.currentAnimation===n.upcomingAnimations[0]&&n.upcomingAnimations.push(n.upcomingAnimations.shift())}function We(){const r=Array(12).fill(0);Z();const i=n.upcomingAnimations.shift();n.currentAnimation=i,n.modelL=b.from(i.modelL),n.modelR=b.from(i.modelR),n.animationSpeeds=[...i.animationSpeeds],n.lighting=new N,n.countdowns.push({remaining:2e4,callback:o}),window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation}));function o(){const a=n.upcomingAnimations.shift();n.currentAnimation=a,window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation})),n.upcomingAnimations.length||Z(),Ne(a,2e3),n.countdowns.push({callback:()=>{ge(n.lighting,a.lighting,2e3*2)},remaining:2e3}),n.countdowns.push({callback:()=>{pe(r,a.animationSpeeds.map(l=>1.3*l),2e3/4)},remaining:2e3}),n.countdowns.push({callback:o,remaining:2e4})}}function oe(e){n.grabStyle=e}function Xe(){function e(){B("main-canvas").clientWidth>350?n.blurPassCount=4:n.blurPassCount=2}window.addEventListener("resize",a=>{for(const l of[n.animation1]){const c=l.context;c.canvas.width=c.canvas.clientWidth,c.canvas.height=c.canvas.clientHeight,c.viewport(0,0,c.canvas.width,c.canvas.height),l.keepAnimating||requestAnimationFrame(l.draw)}e()}),e();const t=a=>{n.lastX=a.clientX,n.lastY=a.clientY,n.pointerdown=!0};B("main-canvas").addEventListener("pointerdown",t);const r=a=>{n.pointerdown=!1,n.releasedViewL=n.viewL,n.releasedViewR=n.viewR,n.viewSnapT=0};B("main-canvas").addEventListener("pointerup",r);const i=a=>{r()};B("main-canvas").addEventListener("pointerleave",i);const o=a=>{if(n.pointerdown){const l=(a.clientX-n.lastX)/a.target.offsetWidth,c=(a.clientY-n.lastY)/a.target.offsetHeight,d=l*V,u=c*V;switch(n.grabStyle){case"3d":n.viewL.premultiply([0,Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewR.postmultiply([0,-Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewL.premultiply([Math.sin(u*.75),0,0,Math.cos(u*.75)]),n.viewR.postmultiply([-Math.sin(u*.75),0,0,Math.cos(u*.75)]);break;case"4d":n.viewL.premultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewR.postmultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewL.premultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]),n.viewR.postmultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]);break}n.viewL.normalize(),n.viewR.normalize()}n.lastX=a.clientX,n.lastY=a.clientY};B("main-canvas").addEventListener("pointermove",o)}const L=document.querySelector.bind(document),P=document.querySelectorAll.bind(document);je();function je(){const e=L(".underline");let t="left",r={left:0,right:0},i=L(".link-box"),o=!1;Oe(3e3),Ge(),l();const a=P(".link-box a");e.style.right=r.right-a[a.length-1].getBoundingClientRect().right+"px",oe(L('input[name="grab-type"]:checked').value);for(const f of P(".line-link"))f.addEventListener("click",h=>{h.preventDefault()});L(".grab-style").addEventListener("input",f=>{oe(f.target.value)});for(const f of P(".link-box"))f.addEventListener("pointerenter",h=>{const x=f.querySelector(".line-link");i=f,e.classList.remove("no-delay"),x.getBoundingClientRect().left-r.left<parseFloat(getComputedStyle(e).left)?(e.classList.remove("delay-left"),e.classList.add("delay-right"),t="left"):(e.classList.remove("delay-right"),e.classList.add("delay-left"),t="right"),e.style.left=x.getBoundingClientRect().left-r.left+"px",e.style.right=r.right-x.getBoundingClientRect().right+"px"});L(".link-box-container").addEventListener("pointerleave",()=>{e.classList.remove("delay-left"),e.classList.remove("delay-right"),e.classList.add("no-delay"),t==="left"?e.style.right=r.right-i.querySelector("a").getBoundingClientRect().left+"px":e.style.left=i.querySelector("a").getBoundingClientRect().right-r.left+"px"});function l(){r=L(".link-box-container").getBoundingClientRect()}function c(){const f=P(".link-box a");e.classList.remove("delay-right"),e.classList.remove("delay-left"),e.classList.add("no-delay"),e.style.left="100%",e.style.right=r.right-f[f.length-1].getBoundingClientRect().right+"px"}window.addEventListener("resize",()=>{l(),c()}),document.getElementById("contact-box").addEventListener("click",()=>{const f=L(".contact-email");if(f.childElementCount>0)return;const R=F("<`hc\\TU,gRQa[.E^R","You look down and see a tortoise..."),w=document.createElement("a");w.href=`mailto:${R}`,w.textContent=R,f.append(w);function F(M,ee){return[...M].map((ye,Te)=>String.fromCharCode((ye.charCodeAt(0)-32-(ee.charCodeAt(Te%ee.length)-32)+95)%95+32)).join("")}});for(const f of[L(".gear"),...P(".link-box")])f.addEventListener("click",h=>{const x=f.dataset.section,R=L("."+x);if(R.classList.contains("opaque"))return d();window.dispatchEvent(new CustomEvent("pane-open")),R.classList.remove("concealed"),R.classList.add("opaque"),R.scrollTop=0;const w=R.querySelector(".scroll-container");w&&(w.scrollTop=0);for(const F of P(".content"))F.classList.contains(x)||(F.classList.remove("opaque"),F.classList.add("concealed"));x!=="settings"&&u(R),J(0,500)}),f.addEventListener("pointerenter",h=>{L(".underline").classList.add("bright-underline")}),f.addEventListener("pointerleave",h=>{L(".underline").classList.remove("bright-underline")});function d(){window.dispatchEvent(new CustomEvent("pane-close"));for(const f of P(".content"))f.classList.remove("opaque"),f.classList.add("concealed");J(1,1500)}for(const f of P(".close"))f.addEventListener("click",d);document.body.addEventListener("click",f=>{}),window.addEventListener("click",f=>{for(const h of P(".content"))if(h.contains(f.target)||h===f.target)return;f.target.classList.contains("link-box")||f.target.classList.contains("line-link")||L(".gear").contains(f.target)||d()});function u(f){u.duration??(u.duration=1100),u.canvas??(u.canvas=document.querySelector(".glint-canvas")),u.ctx??(u.ctx=u.canvas.getContext("2d"));const h=f.getBoundingClientRect();u.canvas.style.width=h.width+"px",u.canvas.style.height=h.height+"px",u.canvas.style.top=h.top+"px",clearTimeout(u.tid),u.canvas.style.display="block",u.tid=setTimeout(()=>u.canvas.style.display="none",u.duration),delete m.t0,requestAnimationFrame(m)}function m(f){if(!u.ctx.createConicGradient)return;const h=80;m.t0??(m.t0=f);const x=Math.min((f-m.t0)/u.duration,1),R=1-(1-x)**2,w=1-x**3,F=-R*Math.PI*2-Math.PI/2,M=u.ctx.createConicGradient(F,-.4*h,1.5*h);M.addColorStop(0,`hsla(22, 100%, 59%, ${w*.02})`),M.addColorStop(.29,`hsla(22, 100%, 59%, ${w*.125})`),M.addColorStop(.34,`hsla(353, 88%, 63%, ${w*.314})`),M.addColorStop(.45,`hsla(8, 100%, 67%, ${w*.376})`),M.addColorStop(.48,`hsla(26, 100%, 65%, ${w*.439})`),M.addColorStop(.5,`hsla(26, 100%, 70%, ${w*.565})`),M.addColorStop(.72,`hsla(151, 51%, 51%, ${w*.376})`),M.addColorStop(.875,`hsla(198, 57%, 49%, ${w*.251})`),M.addColorStop(1,`hsla(198, 57%, 49%, ${w*.02})`),u.ctx.clearRect(0,0,h,h),u.ctx.fillStyle=M,u.ctx.fillRect(0,0,h,h),x<1&&requestAnimationFrame(m)}L(".fullscreen").addEventListener("click",f=>{o=!o,A(o),T(o)});function A(f){f?document.documentElement.requestFullscreen?document.documentElement.requestFullscreen():document.documentElement.webkitRequestFullscreen&&document.documentElement.webkitRequestFullscreen():document.exitFullscreen?document.exitFullscreen():document.webkitCancelFullScreen&&document.webkitCancelFullScreen()}function T(f){f?(L(".name-container").classList.add("fade-out"),L(".link-box-container").classList.add("fade-out"),L(".gear").classList.add("mostly-hidden"),L(".fullscreen").classList.add("mostly-hidden")):(L(".name-container").classList.remove("fade-out"),L(".link-box-container").classList.remove("fade-out"),L(".gear").classList.remove("mostly-hidden"),L(".fullscreen").classList.remove("mostly-hidden"))}function p(){document.fullscreenElement||document.webkitFullscreenElement?o=!0:o=!1,T(o)}document.addEventListener("fullscreenchange",p),document.addEventListener("webkitfullscreenchange",p)}function Ge(){if(!K.length){_("Animation data not yet available.");return}const e=L(".ul-animations");for(const t of K){const r=document.createElement("li"),i=document.createElement("label"),o=document.createElement("input");o.type="checkbox",o.checked=!0,o.dataset.title=t.title,o.addEventListener("input",He),i.append(o),i.append(t.title),r.append(i),e.append(r)}}function He(){const e=P('.ul-animations input[type="checkbox"]');let t=0;for(const r of e)r.checked&&t++;t===0&&(this.checked=!0);for(const r of e)K.find(i=>i.title===r.dataset.title).active=r.checked;Z()}Ye();function Ye(){for(const e of P(".carousel")){const t=document.createElement("div");t.classList.add("carousel-clipping"),e.append(t),e.dataset.current=0,e.addEventListener("rotate",$e);const r=e.dataset.src.split(", ");if(t.addEventListener("click",()=>{S.noClick||(location=e.closest("section").querySelector("a").href)}),r.length>1){const i=document.createElement("div");i.classList.add("pip-container"),e.append(i);for(const[o,a]of Object.entries(r)){32*r.length/-2;const l=document.createElement("div");l.classList.add("carousel-pip"),l.addEventListener("click",c=>{e.dispatchEvent(new CustomEvent("rotate",{detail:o})),c.stopPropagation()}),i.append(l)}e.querySelector(".carousel-pip").classList.add("current")}for(const i of e.dataset.src.split(", ")){const o=document.createElement("div");o.classList.add("carousel-slide"),o.classList.add("hide-slide"),o.style.backgroundImage=`url(${i})`,t.append(o)}if(be(e),r.length>1){const i=document.createElement("button"),o=document.createElement("button");i.classList.add("spin-left-button"),o.classList.add("spin-right-button"),i.addEventListener("click",a=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),a.stopPropagation()}),o.addEventListener("click",a=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),a.stopPropagation()}),e.append(i),e.append(o),e.addEventListener("touchstart",S),e.addEventListener("touchmove",Ke),e.addEventListener("touchend",Je)}}}function be(e){const t=e.querySelectorAll(".carousel-slide"),r=e.dataset.current,i=t.length;for(const[o,a]of Object.entries(t)){if(a.classList.remove("skip-slide"),o===r){a.classList.remove("slide-left"),a.classList.remove("slide-right"),a.classList.remove("hide-slide");continue}const l=(r-o+i)%i,c=(o-r+i)%i;l===1||c===1?a.classList.remove("hide-slide"):a.classList.add("hide-slide"),l<c?(a.classList.contains("slide-right")&&(a.classList.remove("slide-right"),a.classList.add("skip-slide")),a.classList.add("slide-left")):(a.classList.contains("slide-left")&&(a.classList.remove("slide-left"),a.classList.add("skip-slide")),a.classList.add("slide-right"))}}function $e(e){const t=e.detail,r=e.currentTarget.dataset.src.split(", ").length,i=Number(e.currentTarget.dataset.current);let o;switch(t){case"next":o=(r+i+1)%r;break;case"previous":o=(r+i-1)%r;break;default:o=t}e.currentTarget.dataset.current=o,be(e.currentTarget);const a=e.currentTarget.querySelectorAll(".carousel-pip");a[i].classList.remove("current"),a[o].classList.add("current")}function S(e){S.noClick=!1,S.contact={x0:e.changedTouches[0].screenX,y0:e.changedTouches[0].screenY}}function Ke(e){if(!S.contact)return;const t=Math.min(document.body.clientWidth,document.body.clientHeight),r=(e.changedTouches[0].screenX-S.contact.x0)/t,i=(e.changedTouches[0].screenY-S.contact.y0)/t;if(!(Math.abs(i/r)>.577)){if(e.preventDefault(),i>.03||i<-.03){S.noClick=!0,delete S.contact;return}r>.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),delete S.contact,S.noClick=!0),r<-.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),delete S.contact,S.noClick=!0)}}function Je(){delete S.contact}const ae=new Map([["blossom",[[.07,.03,.31],[.07,.03,.31],[.14,.08,.49]]],["first light",[[.3,.06,.01],[.3,.06,.01],[.4,.14,.01],[.72,.18,.05]]],["aquarius",[[.02,.03,.13],[.06,.06,.24],[.06,.06,.34],[.04,.04,.56]]],["wintersun",[[.09,.07,.35],[.1,.04,.08],[.09,.07,.35],[.06,.03,.25],[.29,.1,.01]]],["trance",[[.75,.09,.01],[.35,.07,.04],[.31,.11,.01],[.31,.07,.04]]],["anemochore",[[.06,.1,.29],[.04,.06,.19],[.06,.1,.29],[.04,.06,.19],[.06,.1,.29],[.04,.06,.19],[.12,.2,.4]]],["ember iris",[[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.35,.07,.08],[.55,.09,0]]],["captured light",[[.09,.05,.3],[.09,.05,.3],[.1,.06,.38],[.1,.06,.38],[.13,.07,.58]]],["chromophore",[[.54,.19,.22],[.24,.09,.22],[.08,.12,.24],[.12,.04,.11],[.04,.06,.12],[.12,.04,.11],[.04,.06,.12]]]]),z={},O={},g={position:-1,xyBlur:-1,xyComposite:-1,uvBlur:-1,uvComposite:-1,kernel:null,readTexture:null,blurStep:null,blurSampler:null,clearSampler:null,hexAspect:null,compositorAspect:null,curtainLo:null,curtainHi:null,aberration:null,pulseRadius:null,positionMax:null,transform:null,project:null,rgba:null},k={transform:fe(0),project:[]},s={gl:null,readingMode:!1,pulseTime:-2,zPulse:0,resizeCount:0,blurKernelSize:10,canvasWidth:0,canvasHeight:0,textureWidth:1,textureHeight:1,tLast:0,elapsed:0,aspect:1,sceneScale:1,xMax:0,yMax:0,particleDensity:14,maxParticles:0,hexagonProgram:null,blurProgram:null,compositorProgram:null,hexagonVertexBuffer:null,squareVertexBuffer:null,uvBuffer:null,fboAA:null,rbAA:null,fboList:[],textureList:[],activeColorSet:[[.3,.1,.15],[.1,.25,.3]]},v=[];function Ze(){const e=document.querySelector(".render-canvas");return!e||document.documentElement.clientHeight<1?1:e.clientHeight/document.documentElement.clientHeight}function ne(e){if(ae.has(e.title)){s.activeColorSet=ae.get(e.title);return}}function Qe(){const e=document.querySelector(".bokeh-canvas");if(!e)throw Error("No bokeh canvas found");if(s.gl=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl&&(s.gl=e.getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl))throw Error("Unable to create bokeh rendering context");const t=s.gl;window.addEventListener("resize",le),n.currentAnimation&&ne(n.currentAnimation),window.addEventListener("tesseract-change",c=>{ne(c.detail),se()}),window.addEventListener("pane-close",()=>{s.readingMode=!1}),window.addEventListener("pane-open",()=>{s.readingMode=!0}),t instanceof WebGL2RenderingContext&&(s.fboAA=t.createFramebuffer(),s.rbAA=t.createRenderbuffer());const r=q(t,t.VERTEX_SHADER,z.flatLensVert),i=q(t,t.FRAGMENT_SHADER,z.premultiplyAlpha);s.hexagonProgram=H(t,r,i);const o=q(t,t.VERTEX_SHADER,z.uvVert),a=q(t,t.FRAGMENT_SHADER,z.blur1d);s.blurProgram=H(t,o,a);const l=q(t,t.FRAGMENT_SHADER,z.compositor);s.compositorProgram=H(t,o,l),g.position=t.getAttribLocation(s.hexagonProgram,"position"),g.hexAspect=t.getUniformLocation(s.hexagonProgram,"aspect"),g.positionMax=t.getUniformLocation(s.hexagonProgram,"positionMax"),g.transform=t.getUniformLocation(s.hexagonProgram,"transform"),g.project=t.getUniformLocation(s.hexagonProgram,"project"),g.rgba=t.getUniformLocation(s.hexagonProgram,"rgba"),s.hexagonVertexBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.hexagonVertexBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.hexagon),t.STATIC_DRAW),t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE),t.clearColor(0,0,0,0),t.useProgram(s.blurProgram),g.blurStep=t.getUniformLocation(s.blurProgram,"blurStep"),g.kernel=t.getUniformLocation(s.blurProgram,"kernel"),t.uniform1fv(g.kernel,de(.1,s.blurKernelSize)),g.blurSampler=t.getUniformLocation(s.compositorProgram,"blurSampler"),g.clearSampler=t.getUniformLocation(s.compositorProgram,"clearSampler"),g.compositorAspect=t.getUniformLocation(s.compositorProgram,"compositorAspect"),g.curtainLo=t.getUniformLocation(s.compositorProgram,"curtainLo"),g.curtainHi=t.getUniformLocation(s.compositorProgram,"curtainHi"),g.aberration=t.getUniformLocation(s.compositorProgram,"aberration"),g.pulseRadius=t.getUniformLocation(s.compositorProgram,"pulseRadius"),g.xyBlur=t.getAttribLocation(s.blurProgram,"xy"),g.xyComposite=t.getAttribLocation(s.compositorProgram,"xy"),g.uvBlur=t.getAttribLocation(s.blurProgram,"uv"),g.uvComposite=t.getAttribLocation(s.compositorProgram,"uv"),s.squareVertexBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.squareVertexBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.square),t.STATIC_DRAW),s.uvBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.uvBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array([0,1,1,1,1,0,0,0]),t.STATIC_DRAW),s.fboList=[t.createFramebuffer(),t.createFramebuffer(),t.createFramebuffer()];for(const c of s.fboList)t.bindFramebuffer(t.FRAMEBUFFER,c),s.textureList.push(t.createTexture()),t.bindTexture(t.TEXTURE_2D,s.textureList.at(-1)),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,s.textureList.at(-1),0);le(),tt(),se(),requestAnimationFrame(xe)}function se(){setTimeout(()=>{s.readingMode||(s.pulseTime=0)},19500)}function le(){const t=s.gl,r=document.querySelector(".bokeh-canvas");if(!r||!t)return;s.resizeCount++,s.canvasHeight=Math.max(1,Math.round(Math.min(600,r.clientHeight))),s.canvasWidth=Math.max(1,Math.round(s.canvasHeight*r.clientWidth/r.clientHeight));const i=r.clientWidth/1600;s.textureWidth=Math.max(1,Math.min(1024,Math.floor(s.canvasWidth/2))),s.textureHeight=Math.max(1,Math.min(1024,Math.floor(s.canvasHeight/2))),r.height=s.canvasHeight,r.width=s.canvasWidth,s.aspect=s.canvasWidth/s.canvasHeight,s.sceneScale=Ze();const o=s.sceneScale*2;s.xMax=.5*o*s.aspect/s.sceneScale,s.yMax=.5*o/s.sceneScale,t.useProgram(s.hexagonProgram),t.uniform2fv(g.positionMax,[s.xMax,s.yMax]),t.useProgram(s.compositorProgram),t.uniform1f(g.compositorAspect,s.aspect);const a=0*i+-.05/.04*(1-i),l=i>=.96?.8*i+-12.95*(1-i):.25*(1-(i-.96))+.7*(i-.96);if(t.uniform1f(g.curtainLo,Math.max(-.05,Math.min(.1,a))),t.uniform1f(g.curtainHi,Math.max(0,Math.min(1,l))),s.fboAA&&t instanceof WebGL2RenderingContext){const u=Math.min(16,t.getParameter(t.MAX_SAMPLES)),m=t.getParameter(t.RENDERBUFFER_BINDING);t.bindRenderbuffer(t.RENDERBUFFER,s.rbAA),t.renderbufferStorageMultisample(t.RENDERBUFFER,u,t.RGBA8,s.textureWidth,s.textureHeight),t.bindFramebuffer(t.FRAMEBUFFER,s.fboAA),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.RENDERBUFFER,s.rbAA),t.bindRenderbuffer(t.RENDERBUFFER,m)}const c=document.querySelector(".bokeh-canvas"),d=document.querySelector(".render-canvas");if(!c||!d)throw Error("DOM missing canvas nodes");s.maxParticles=Math.min(300,Math.round(s.particleDensity*(c.clientWidth*c.clientHeight)/(d.clientWidth*d.clientHeight)));for(const u of s.textureList)t.bindTexture(t.TEXTURE_2D,u),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,s.textureWidth,s.textureHeight,0,t.RGBA,t.UNSIGNED_BYTE,null);Ee()}function et(e){v[e]=v.at(-1),v.pop()}function ve(){const e=s.xMax*2*(Math.random()-.5),t=s.yMax*2*(Math.random()-.5),r=2*(Math.random()-.5),i=Math.floor(Math.random()*s.activeColorSet.length);v.push({position:[e,t,r],lifetime:5+Math.random()*5,spawnDelay:0,age:0,color:[...s.activeColorSet[i],1],colorIndex:i,scale:.85+.1*t/s.yMax+.2/(r+2)})}function tt(){for(;v.length<s.maxParticles/2;){const e=6*v.length/s.maxParticles;ve(),v[v.length-1].lifetime=2+Math.random()*4,v[v.length-1].spawnDelay=e}}function rt(e){for(;v.length<s.maxParticles;)ve(),v[v.length-1].spawnDelay=Math.random()*2;for(let r=0;r<v.length;r++){if(v[r].spawnDelay>0){v[r].spawnDelay-=e,v[r].color[3]=0;continue}if(v[r].age+=e,v[r].age>v[r].lifetime){et(r),r--;continue}const i=s.activeColorSet[v[r].colorIndex%s.activeColorSet.length];v[r].color[0]=t(v[r].color[0],i[0],e),v[r].color[1]=t(v[r].color[1],i[1],e),v[r].color[2]=t(v[r].color[2],i[2],e),v[r].color[3]=Math.sin(Math.PI*v[r].age/v[r].lifetime)**4}function t(r,i,o){return i-(i-r)*Math.exp(-.6161308271643958*o)}}function xe(e){s.tLast??(s.tLast=e),e-s.tLast>100&&(s.tLast=e);const t=(s.readingMode&&s.pulseTime>6?.3:1)*(e-s.tLast)/1e3;s.tLast=e,s.elapsed+=t,s.elapsed%=86400,s.pulseTime+=t,s.zPulse=.6*s.pulseTime-2,rt(t),Ee(),requestAnimationFrame(xe)}function it(e){const t=s.gl;t.viewport(0,0,s.textureWidth,s.textureHeight),t.useProgram(s.blurProgram),t.enableVertexAttribArray(g.xyBlur),t.enableVertexAttribArray(g.uvBlur),t.bindBuffer(t.ARRAY_BUFFER,s.squareVertexBuffer),t.vertexAttribPointer(g.xyBlur,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,s.uvBuffer),t.vertexAttribPointer(g.uvBlur,2,t.FLOAT,!1,0,0);for(let r=0;r<e;r++)t.bindFramebuffer(t.FRAMEBUFFER,s.fboList[1+r%2]),r<2&&t.clear(t.COLOR_BUFFER_BIT),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,s.textureList[r===0?0:1+(r+1)%2]),t.uniform1i(g.readTexture,0),t.uniform2f(g.blurStep,r%2?0:1/s.textureWidth,r%2?1/s.textureHeight:0),t.drawArrays(t.TRIANGLE_FAN,0,O.square.length/2);t.disableVertexAttribArray(g.xyBlur),t.disableVertexAttribArray(g.uvBlur)}function ot(){const e=s.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,s.canvasWidth,s.canvasHeight),e.useProgram(s.compositorProgram),e.enableVertexAttribArray(g.xyComposite),e.enableVertexAttribArray(g.uvComposite),e.bindBuffer(e.ARRAY_BUFFER,s.squareVertexBuffer),e.vertexAttribPointer(g.xyComposite,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,s.uvBuffer),e.vertexAttribPointer(g.uvComposite,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,s.textureList[0]),e.uniform1i(g.clearSampler,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,s.textureList[2]),e.uniform1i(g.blurSampler,1),e.uniform1f(g.aberration,.005+.007*st(1-Math.abs(2*s.zPulse+1))),e.uniform1f(g.pulseRadius,Math.max(s.xMax,s.yMax)*(s.zPulse+1)),e.drawArrays(e.TRIANGLE_FAN,0,O.square.length/2),e.disableVertexAttribArray(g.xyComposite),e.disableVertexAttribArray(g.uvComposite)}function at(){const e=s.gl;e.viewport(0,0,s.textureWidth,s.textureHeight),e.clear(e.COLOR_BUFFER_BIT),e.blendFunc(e.ONE,e.ONE),e.useProgram(s.hexagonProgram),e.enableVertexAttribArray(g.position),e.bindBuffer(e.ARRAY_BUFFER,s.hexagonVertexBuffer),e.vertexAttribPointer(g.position,3,e.FLOAT,!1,0,0),j(k.project),k.project[0]=1/s.aspect,e.uniformMatrix4fv(g.project,!1,k.project);for(const t of v)t.spawnDelay>0||(j(k.transform),X(k.transform,fe(Math.PI/10),ce(t.scale*s.sceneScale/4)),X(k.transform,ue(t.position[0],t.position[1],t.position[2]),k.transform),e.uniform4fv(g.rgba,t.color),e.uniformMatrix4fv(g.transform,!1,k.transform),e.drawArrays(e.TRIANGLE_FAN,0,O.hexagon.length/3));e.disableVertexAttribArray(g.position)}function Ee(){const e=s.gl;e&&(e.bindFramebuffer(e.FRAMEBUFFER,null),e.clear(e.COLOR_BUFFER_BIT),e instanceof WebGL2RenderingContext?e.bindFramebuffer(e.FRAMEBUFFER,s.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,s.fboList[0]),at(),nt(),it(4),ot())}function nt(){if(!(s.gl instanceof WebGL2RenderingContext)||!s.fboAA)return;const e=s.gl;e.bindFramebuffer(e.READ_FRAMEBUFFER,s.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.fboList[0]),e.blitFramebuffer(0,0,s.textureWidth,s.textureHeight,0,0,s.textureWidth,s.textureHeight,e.COLOR_BUFFER_BIT,e.NEAREST)}function H(e,t,r){const i=e.createProgram();if(e.attachShader(i,t),e.attachShader(i,r),e.linkProgram(i),e.getProgramParameter(i,e.LINK_STATUS))return i;const a=e.getProgramInfoLog(i);throw e.deleteProgram(i),Error(a||"Program link failed; no log available")}function q(e,t,r){const i=e.createShader(t);if(!i)throw Error("Unable to create shader");if(e.shaderSource(i,r),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS))return i;const a=e.getShaderInfoLog(i);throw e.deleteShader(i),Error(a||"Shader compilation failed")}function st(e){return e<=0?0:e>=1?1:1-2**(-10*e)}O.hexagon=[-1,0,0,-1/2,Math.sqrt(3)/2,0,1/2,Math.sqrt(3)/2,0,1,0,0,1/2,-Math.sqrt(3)/2,0,-1/2,-Math.sqrt(3)/2,0];O.square=[-1,1,1,1,1,-1,-1,-1];z.flatLensVert=`
uniform float aspect;
uniform vec2 positionMax;
uniform mat4 transform;
uniform mat4 project;
attribute vec4 position;

void main() {
  vec4 transformed = transform * position;

  // Slightly flatten geometry radially:
  float r = length(vec2(transformed)) / length(positionMax);
  transformed.x /= 0.9 + r * 0.1125;
  transformed.y /= 0.9 + r * 0.1125;

  gl_Position = project * transformed;
}
`;z.premultiplyAlpha=`
precision mediump float;
uniform vec4 rgba;

void main() {
  gl_FragColor = vec4(vec3(rgba) * rgba.a, rgba.a);
}
`;z.uvVert=`
attribute vec2 xy;
attribute vec2 uv;
varying mediump vec2 vuv;

void main() {
  gl_Position = vec4(xy, 0, 1);
  vuv = uv;
}
`;z.compositor=`
precision mediump float;
uniform sampler2D blurSampler;
uniform sampler2D clearSampler;
uniform float compositorAspect;
uniform float aberration;
uniform float pulseRadius;
uniform float curtainLo;
uniform float curtainHi;
varying mediump vec2 vuv;

float ease(float x) {
  // Bound input range to [0... 1]
  float t = max(0., min(1., x));

  // Exponential ease:
  float lo = 0.5 * pow(2., 20. * t - 10.);
  float hi = 1.0 - 0.5 * pow(2., -20. * t + 10.);
  float isHi = step(0.5, t);
  return max(0., min(1., (1. - isHi) * lo + isHi * hi));
}

void main() {
  const float yFocus = 0.55;
  vec2 deltaCenter = vec2(vuv.x, vuv.y) - vec2(0.5, yFocus);
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
  float r = min(1.0, 0.8 * length(deltaCenter));

  // Lerp blur intensity based on vertical position:
  float t = min(1., pow(2. * abs(vuv.y - yFocus), 3.));

  // Take five samples for chromatic aberration:
  vec4 near = mix(
    texture2D(clearSampler, vuv + radialOffset),
    texture2D(blurSampler, vuv + radialOffset) , t);
  vec4 seminear = mix(
    texture2D(clearSampler, vuv + 0.5 * radialOffset),
    texture2D(blurSampler, vuv + 0.5 * radialOffset) , t);
  vec4 middle = mix(
    texture2D(clearSampler, vuv),
    texture2D(blurSampler, vuv) , t);
  vec4 semifar = mix(
    texture2D(clearSampler, vuv - 0.5 * radialOffset),
    texture2D(blurSampler, vuv - 0.5 * radialOffset) , t);
  vec4 far = mix(
    texture2D(clearSampler, vuv - radialOffset),
    texture2D(blurSampler, vuv - radialOffset) , t);

  // Interpolation parameter based on aspect ratio:
  float tAspect = min(1., max(0., (2.1 - compositorAspect) / 1.2));
  float vertical = cos(3.0 * abs((vuv.y - yFocus * 0.95)
                    / (sin(3.14159 / 2. + 0.5*(vuv.x - 0.5)))));
  vertical = 1. - (1. - vertical) * mix(1., 0.9, tAspect);

  // Weight color samples based on radial offset:
  far *=      vec4(0.,   0.,   0.6,   0.2);
  semifar *=  vec4(0.,   0.3,  0.3,   0.2);
  middle *=   vec4(0.1,  0.4,  0.1,   0.2);
  seminear *= vec4(0.3,  0.3,  0.,    0.2);
  near *=     vec4(0.6,  0.,   0.,    0.2);
  
  float centralR = pow(mix(0.9, 1.8, tAspect) * r, mix(1.8, 2.4, tAspect));

  vec4 aberrantColor = far + semifar + middle + seminear + near;

  // Apply horizontal vignetting:
  float curtainFactor = smoothstep(
    curtainLo, curtainHi, (1. - 2. * abs(vuv.x - 0.5)));

  float overallFade = (1. - vertical) * (pulseDelta);
  
  // Highlight fragments based on proximity to the pulse animation:
  float waveEmphasis = 1.45 * (1. - pow(pulseDelta, 2.));

  float finalScale = (1. - overallFade)
                      * centralR * (1. + waveEmphasis) * curtainFactor;
  gl_FragColor = aberrantColor * finalScale;
}
`;z.blur1d=`
precision mediump float;
varying vec2 vuv;

uniform sampler2D readTexture;
#define kernelSize ${s.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(readTexture, vuv) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(readTexture, vuv - float(i)*dv) * kernel[i]
            + texture2D(readTexture, vuv + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`;Qe();
