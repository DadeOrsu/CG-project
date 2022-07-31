DepthShader = function (gl) {
  var vertexShaderSource = `
      attribute vec3 aPosition;
      uniform   mat4 uModelMatrix;
      uniform   mat4 uVP;

      void main(void)
      {
        gl_Position = uVP * uModelMatrix * vec4(aPosition, 1);
      }`;

  var fragmentShaderSource = `
      void main(void) {
        gl_FragColor = vec4(0);
      }`;

  // create the vertex shader

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);



  // create the fragment shader

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);



  // Create the shader program

  var aPositionIndex = 0;
  var shaderProgram = gl.createProgram();

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.bindAttribLocation(shaderProgram, aPositionIndex, "aPosition");
  gl.linkProgram(shaderProgram);



  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    var str = "Unable to initialize the shader program.n";
    str += "VS:\n" + gl.getShaderInfoLog(vertexShader) + "\n";
    str += "FS:\n" + gl.getShaderInfoLog(fragmentShader) + "\n";
    str += "PROG:\n" + gl.getProgramInfoLog(shaderProgram);
    alert(str);
  }



  shaderProgram.aPositionIndex = aPositionIndex;
  shaderProgram.uVPLocation = gl.getUniformLocation(shaderProgram, "uVP");
  shaderProgram.uModelMatrixLocation = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  shaderProgram.vertex_shader = vertexShaderSource;
  shaderProgram.fragment_shader = fragmentShaderSource;
  shaderProgram.is_shadow = true;
  return shaderProgram;
};
