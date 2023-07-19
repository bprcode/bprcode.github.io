	const shadertoy = 
  /* glsl */`
  	// Double emulation based on GLSL Mandelbrot Shader by Henry Thasler (www.thasler.org/blog)
	//
	// Emulation based on Fortran-90 double-single package. See http://crd.lbl.gov/~dhbailey/mpdist/
	// Substract: res = ds_add(a, b) => res = a + b
  const float iti = 75.;
  float times_frc(float a, float b) {
      // looks like this isn't needed...
    //return mix(0.0, a * b, b != 0.0 ? 1.0 : 0.0);
    return a*b;
  }
  
  float plus_frc(float a, float b) {
  // looks like this isn't needed...
    //return mix(a, a + b, b != 0.0 ? 1.0 : 0.0);
    return a+b;
  }
  
  float minus_frc(float a, float b) {
  // !!! this, however, is actually needed!
    return mix(a, a - b, b != 0.0 ? 1.0 : 0.0);
    //return a-b;
  }
  
  // Double emulation based on GLSL Mandelbrot Shader by Henry Thasler (www.thasler.org/blog)
  //
  // Emulation based on Fortran-90 double-single package. See http://crd.lbl.gov/~dhbailey/mpdist/
  // Substract: res = ds_add(a, b) => res = a + b
  vec2 add (vec2 dsa, vec2 dsb) {
    vec2 dsc;
    float t1, t2, e;
  
    t1 = plus_frc(dsa.x, dsb.x);
    e = minus_frc(t1, dsa.x);
    t2 = plus_frc(plus_frc(plus_frc(minus_frc(dsb.x, e), minus_frc(dsa.x, minus_frc(t1, e))), dsa.y), dsb.y);
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
  
  // Compare: res = -1 if a < b
  //              = 0 if a == b
  //              = 1 if a > b
  float cmp(vec2 dsa, vec2 dsb) {
    if (dsa.x < dsb.x) {
      return -1.;
    }
    if (dsa.x > dsb.x) {
      return 1.;
    }
    if (dsa.y < dsb.y) {
      return -1.;
    }
    if (dsa.y > dsb.y) {
      return 1.;
    }
    return 0.;
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
  
  // create double-single number from float
  vec2 set(float a) {
    return vec2(a, 0.0);
  }
  
  float rand(vec2 co) {
    // implementation found at: lumina.sourceforge.net/Tutorials/Noise.html
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }
  
  vec2 complexMul(vec2 a, vec2 b) {
    return vec2(a.x*b.x -  a.y*b.y,a.x*b.y + a.y * b.x);
  }
  
  // double complex multiplication
  vec4 dcMul(vec4 a, vec4 b) {
    return vec4(sub(mul(a.xy,b.xy),mul(a.zw,b.zw)),add(mul(a.xy,b.zw),mul(a.zw,b.xy)));
  }
  
  vec4 dcAdd(vec4 a, vec4 b) {
    return vec4(add(a.xy,b.xy),add(a.zw,b.zw));
  }
  
  // Length of double complex
  vec2 dcLength(vec4 a) {
    return add(mul(a.xy,a.xy),mul(a.zw,a.zw));
  }
  
  vec4 dcSet(vec2 a) {
    return vec4(a.x,0.,a.y,0.);
  }
  
  vec4 dcSet(vec2 a, vec2 ad) {
    return vec4(a.x, ad.x,a.y,ad.y);
  }
  
  // Multiply double-complex with double
  vec4 dcMul(vec4 a, vec2 b) {
    return vec4(mul(a.xy,b),mul(a.wz,b));
  }
  
    vec4 dcSub(vec4 a, vec4 b) {
      return vec4(sub(a.xy,b.xy),sub(a.zw,b.zw));
    }
    
    
  float PI = 3.14159265358979323846264;
  
  float scale = 2.0;
  //known deep coord
  //-1.74995768370609350360221450607069970727110579726252077930242837820286008082972804887218672784431700831100544507655659531379747541999999995
  //0.00000000000000000278793706563379402178294753790944364927085054500163081379043930650189386849765202169477470552201325772332454726999999995
  // -1.401,155,189,098,919,8
  
  //Hmm this way of breaking up numbers isn't really right
  //Needs a string to double representation routine
  vec4 offset = vec4(-1.649958,1e-6 - 6.837060935e-7, 2.787937e-18,0.65633794e-24);
  //vec4 offset = vec4(-1.4011551,8.90989198e-8, 0.0,0.0);
  
  const int max_iterations = 150;
  const int max_colors = 50;
  const float color_scale = 2.0;
  const float inverse_max_colors = 1.0 / float(max_colors);
  
  const int P = 2;
  const float threshold = 200000.0;
  
  
  #define cx_mul(a, b) vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x)
  
  vec4 color_ramp(int i) {
      // Running the index through cos creates a continous ramp.
      float normalized_mod = mod(float(i), float(max_colors)) * inverse_max_colors;
    float normalized_cos = (cos(normalized_mod * 2.0 * PI) + 1.0) * 0.5;
      i = int(float(max_colors) * normalized_cos);
  
      float factor = float(i) / float(max_colors);
      float inverse_factor = 1.0 - factor;
      // An arbritrary ramp of colors
      return vec4(sqrt(sqrt(factor)), factor, inverse_factor * 0.5, 1.0);
  }
  
  vec4 color_from_ramp(int i, float f) {
    vec4 first = color_ramp(i);
    vec4 second = color_ramp(i + 1);
      return first * (1.0 - f) + second * f;
  }
  
  vec4 color_from_iteration(vec4 z, int i) {
      // Continuous coloring
      vec2 len=dcLength(z);
      float s = float(i) + log2(log(threshold)) - log2(log(len.x+len.y));
      s *= color_scale;
      int first = int(floor(s));
      return color_from_ramp(first, s - float(first));
  }
  
  vec4 single_color_from_iteration(vec2 z, int i) {
      // Continuous coloring
      float s = float(i) + log2(log(threshold)) - log2(log(length(z)));
      s *= color_scale;
      int first = int(floor(s));
      return color_from_ramp(first, s - float(first));
  }
  
  vec3 single_fractal(vec2 fragCoord)
  {
    vec2 c = vec2(
          (fragCoord.x / iResolution.x) * 3.5 - 2.5,
          (fragCoord.y / iResolution.y) * 2.0 - 1.0
      );
  
      c *= (scale / exp(iti * 0.2));
      c += vec2(offset.x,offset.z);
  
      vec2 z = vec2(0.0, 0.0);
      int final_i;
      for (int i = 0; i < max_iterations; i++) {
          final_i = i;
  
          if (length(z) >= threshold) {
              break;
          }
  
          // z^P + c, P = 2  gives us  z^2 + c
          z = cx_mul(z, z) + c;
      }
  
    return single_color_from_iteration(z, final_i).rgb;
  }
  vec3 double_fractal( vec2 fragCoord)
  {
      vec2 Threshold = set(threshold);
      float scaletemp= (scale / exp(iti * 0.2));
    vec4 c = vec4(
          set((fragCoord.x / iResolution.x) * 3.5*scaletemp),
          set((fragCoord.y / iResolution.y) * 2.0*scaletemp)
      );
  
      c = dcSub(dcAdd(c,offset),vec4(set(2.5*scaletemp),set(scaletemp)));
  
  
      vec4 z = vec4(0.0, 0.0, 0.0, 0.0);
      int final_i;
      for (int i = 0; i < max_iterations; i++) {
          final_i = i;
  
          if (cmp(dcLength(z), Threshold)>0.) { break; } 
  
          // z^P + c, P = 2  gives us  z^2 + c
          z = dcAdd(dcMul(z, z), c);
      }
  
    return color_from_iteration(z, final_i).rgb;
  }
  vec3 fractal( vec2 fragCoord)
  {
      if (fragCoord.y<iResolution.y*.5) return single_fractal(fragCoord);
      return double_fractal(fragCoord);
  }
  
  
  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
  
    fragColor.rgb  = fractal( fragCoord + vec2(0,0) );
    fragColor.rgb += fractal( fragCoord + vec2(.5,.0) );
    fragColor.rgb += fractal( fragCoord + vec2(.0,.5) );
    fragColor.rgb += fractal( fragCoord + vec2(.5,.5) );
    fragColor.rgb /= 4.0;}  
  `