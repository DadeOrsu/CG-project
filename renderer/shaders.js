Shader = function (gl) {
  var vertexShaderSource = `
    uniform   mat4 uViewMatrix;
    uniform   mat4 uModelMatrix;
    uniform   mat4 uProjectionMatrix;
    uniform   mat4 uNormalMatrix;

    uniform   vec3 uSunDirection;
    uniform   vec3 uLampPosition[12];

    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoords;

    varying   vec2 vTexCoords;
    varying   vec3 vNormal;
    varying   vec4 vPos;
    varying   vec3 vSunDirectionVS;
    varying   vec3 vLampPositionVS[12];
    varying   vec3 vLampDirVS;

    uniform   mat4 uLeftHeadlightViewMatrix, uRightHeadlightViewMatrix;
    uniform   mat4 uHeadlightProjMatrix;
    varying   vec4 vHlPos[2];
    varying   vec4 vHlPosProj[2];
    varying   vec3 vHeadlightNormal[2];
    varying   vec4 vDepthTexCoords;

    void main(void)
    {
      vec4 posWS = uModelMatrix * vec4(aPosition, 1);

      vNormal = (uNormalMatrix * vec4(aNormal, 0)).xyz;
      vSunDirectionVS = normalize((uViewMatrix * vec4(uSunDirection, 0)).xyz);

      for (int i = 0; i < 12; i++)
        vLampPositionVS[i] = (uViewMatrix * vec4(uLampPosition[i], 1)).xyz;
      vLampDirVS = normalize(uViewMatrix * vec4(0, -1, 0, 0)).xyz;

      vTexCoords = aTexCoords;

      // for computing of flat shading (buildings) and the falloff
      vHlPos[0] = uLeftHeadlightViewMatrix * posWS;
      vHlPos[1] = uRightHeadlightViewMatrix * posWS;

      vHlPosProj[0] = uHeadlightProjMatrix * vHlPos[0];
      vHlPosProj[1] = uHeadlightProjMatrix * vHlPos[1];

      // only angle-preserving transformations
      vHeadlightNormal[0] = (uLeftHeadlightViewMatrix * uModelMatrix * vec4(aNormal, 0)).xyz;
      vHeadlightNormal[1] = (uRightHeadlightViewMatrix * uModelMatrix * vec4(aNormal, 0)).xyz;

      vPos = uViewMatrix * posWS;
      gl_Position = uProjectionMatrix * vPos;
    }
  `;

  var fragmentShaderSource = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform sampler2D uSampler;
    uniform sampler2D uNormalSampler;
    uniform int uTexMode; // 0: no texture, 1: color
    varying vec2 vTexCoords;

    uniform sampler2D uHeadlightSampler;
    varying vec4 vHlPos[2];
    varying vec4 vHlPosProj[2];
    varying vec3 vHeadlightNormal[2];
    uniform sampler2D uDepthSampler[2];
    varying vec4 vDepthTexCoords;

    varying vec4 vPos;
    varying vec3 vNormal;

    uniform vec4 uColor;
    uniform bool uIsSpec;
    uniform bool uIsFlat;
    uniform bool uUseNormalMap;

    varying vec3 vLampPositionVS[12];
    varying vec3 vLampDirVS;
    const vec3 lampColor = vec3(0.8, 0.8, 0.8);
    const float lampOpening = 1.05; // ~60°
    const float lampCutoff = 1.4;   // ~80°

    varying vec3 vSunDirectionVS;
    uniform vec3 uSunColor;

    const float kamb = 0.1;
    float kspec = 1.;

    float specf(vec3 view, vec3 norm, vec3 light) {
      return pow(max(0., dot(view, reflect(-light, norm))), 5.);
    }

    void main(void)
    {
      vec3 norm;

      if (uUseNormalMap)
        norm = texture2D(uNormalSampler, vTexCoords).xyz;
      else
        norm = normalize(uIsFlat ? cross(dFdx(vPos.xyz), dFdy(vPos.xyz)) : vNormal);

      vec3 view = normalize(-vPos.xyz);

      vec3 color = (uTexMode == 0 ? uColor : texture2D(uSampler, vTexCoords)).xyz;

      if (!uIsSpec) kspec = 0.;

      vec3 ambient = color * kamb;

      vec3 diffuse = color * uSunColor * max(0., dot(vSunDirectionVS, norm));
      vec3 specular = kspec * uSunColor * specf(view, norm, vSunDirectionVS);

      for (int i = 0; i < 12; i++) {
        vec3 v = vLampPositionVS[i] - vPos.xyz;
        vec3 dir = normalize(v);

        float dist = length(v);
        float falloff = min(1., 2. / dist);

        float spotcos = max(0., dot(vLampDirVS, -dir));
        float spotAngle = acos(spotcos);
        float spotf;

        if (spotAngle > lampCutoff) spotf = 0.;
        else if (spotAngle > lampOpening) spotf = pow(spotcos, 1.);
        else spotf = 1.;

        vec3 incoming = lampColor * falloff * spotf;
        diffuse += color * incoming * max(.0, dot(dir, norm));
        specular += kspec * incoming * specf(view, norm, dir);
      }

      vec4 hlColor = vec4(0.);

      for (int i = 0; i < 2; i++) {
        vec3 hlTexCoords = .5 + .5 * (vHlPosProj[i] / vHlPosProj[i].w).xyz;
        vec3 hlnorm = normalize(uIsFlat ? cross(dFdx(vHlPos[i].xyz), dFdy(vHlPos[i].xyz)) : vHeadlightNormal[i]);

        if (vHlPosProj[i].z > 0.
            && hlTexCoords.x >= 0. && hlTexCoords.x <= 1.
            && hlTexCoords.y >= 0. && hlTexCoords.y <= 1.
            && dot(hlnorm, -vHlPos[i].xyz) > 0.
            && texture2D(uDepthSampler[i], hlTexCoords.xy).x > hlTexCoords.z) {
          float d = length(vHlPos[i]);
          float falloff = max(0., min(1., 30. / (d*d - d)));
          hlColor += texture2D(uHeadlightSampler, hlTexCoords.xy) * falloff;
        }
      }

      gl_FragColor = vec4(ambient + diffuse + specular, 1) * (1. - hlColor.a) + hlColor * hlColor.a;
    }
  `;

  // create the vertex shader
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);

  // create the fragment shader
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);

  // Create the shader program
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    var str = "Unable to initialize the shader program.\n\n";
    str += "VS:\n" + gl.getShaderInfoLog(vertexShader) + "\n\n";
    str += "FS:\n" + gl.getShaderInfoLog(fragmentShader) + "\n\n";
    str += "PROG:\n" + gl.getProgramInfoLog(shaderProgram);
    alert(str);
  }

  shaderProgram.aPositionIndex = 0;
  shaderProgram.aNormalIndex = 1;
  shaderProgram.aTexCoordsIndex = 2;

  gl.bindAttribLocation(shaderProgram, shaderProgram.aPositionIndex, "aPosition");
  gl.bindAttribLocation(shaderProgram, shaderProgram.aNormalIndex, "aNormal");
  gl.bindAttribLocation(shaderProgram, shaderProgram.aTexCoordsIndex, "aTexCoords");

  shaderProgram.uColorLocation = gl.getUniformLocation(shaderProgram, "uColor");
  shaderProgram.uSunColorLocation = gl.getUniformLocation(shaderProgram, "uSunColor");
  shaderProgram.uHeadlightSamplerLocation = gl.getUniformLocation(shaderProgram, "uHeadlightSampler");
  shaderProgram.uLeftHeadlightViewMatrixLocation = gl.getUniformLocation(shaderProgram, "uLeftHeadlightViewMatrix");
  shaderProgram.uRightHeadlightViewMatrixLocation = gl.getUniformLocation(shaderProgram, "uRightHeadlightViewMatrix");
  shaderProgram.uHeadlightProjMatrixLocation = gl.getUniformLocation(shaderProgram, "uHeadlightProjMatrix");
  shaderProgram.uIsSpecLocation = gl.getUniformLocation(shaderProgram, "uIsSpec");
  shaderProgram.uIsFlatLocation = gl.getUniformLocation(shaderProgram, "uIsFlat");
  shaderProgram.uUseNormalMapLocation = gl.getUniformLocation(shaderProgram, "uUseNormalMap");
  shaderProgram.uLampPositionLocation = gl.getUniformLocation(shaderProgram, "uLampPosition");
  shaderProgram.uModelMatrixLocation = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  shaderProgram.uNormalMatrixLocation = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
  shaderProgram.uProjectionMatrixLocation = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
  shaderProgram.uSamplerLocation = gl.getUniformLocation(shaderProgram, "uSampler");
  shaderProgram.uNormalSamplerLocation = gl.getUniformLocation(shaderProgram, "uNormalSampler");
  shaderProgram.uSunDirectionLocation = gl.getUniformLocation(shaderProgram, "uSunDirection");
  shaderProgram.uTexModeLocation = gl.getUniformLocation(shaderProgram, "uTexMode");
  shaderProgram.uViewMatrixLocation = gl.getUniformLocation(shaderProgram, "uViewMatrix");
  shaderProgram.uLeftDepthSamplerLocation = gl.getUniformLocation(shaderProgram, "uDepthSampler[0]");
  shaderProgram.uRightDepthSamplerLocation = gl.getUniformLocation(shaderProgram, "uDepthSampler[1]");

  return shaderProgram;
};
