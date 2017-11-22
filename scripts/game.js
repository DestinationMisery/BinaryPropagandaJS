/*
*
* GLOBAL VARIABLES DECLARATIONS
*
*/

var canvas;
var gl;
var shaderProgram;
var shaderCubeProgram;
abs = Math.abs;

// Buffers
var worldVertexPositionBuffer = null;
var worldVertexTextureCoordBuffer = null;
var friendlyPlayerVertexPositionBuffer;
var friendlyPlayerVertexTextureCoordBuffer;

// Variables for storing textures
var wallTexture;
var friendlyPlayers = [];
var playerTexture;

// Helper variables for animation
var lastTime = 0;
var effectiveFPMS = 60 / 1000;

// Variable that stores  loading state of textures.
var worldTexturesLoaded = false;

// Helper variable for animation
var lastTime = 0;

/*
*
* ANIMATION FUNCTIONS
*
*/


// Global variable for the hover effect (to know when to switch direction of movement (up/down))
var framesPassed = 0;

//
// animate
//
// Called every time before redeawing the screen.
//
function animate() {
  var timeNow = new Date().getTime();
  if (lastTime != 0) {
    var elapsed = timeNow - lastTime;
    framesPassed++;
    if (framesPassed > 100) {
      framesPassed = 0;
    }

    if (speed != 0) {
      xPosition -= Math.sin(degToRad(yaw)) * speed * elapsed;
      zPosition -= Math.cos(degToRad(yaw)) * speed * elapsed;

    }

    for (var i in friendlyPlayers) {
      friendlyPlayers[i].hover(framesPassed);
    }

    yaw += yawRate * elapsed;
    pitch += pitchRate * elapsed;

  }
  lastTime = timeNow;
}

canvasSizeX = 1280;
canvasSizeY = 720;

playgroundSizeX = 5;
playgroundSizeY = 5;


function checkIfAllTexturesLoaded() {
  // check world
  // check pyr
  // check cube
  // check hotspots

  if (worldTexturesLoaded && pyrTexturesLoaded && cubeTexturesLoaded && hotspotTexturesLoaded) {
    return true;
  }
  return false;
}

//
// start
//
// Called when the canvas is created to get the ball rolling.
// Figuratively, that is. There's nothing moving in this demo.

let pyramids = []
let cubes = []

//
function start() {
  canvas = document.getElementById("glcanvas");
  gl = initGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working
  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
    gl.clearDepth(1.0);                                     // Clear everything
    gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
    gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.
    initShaders();
    
    // Next, load and set up the textures we'll be using.
    initWorldTextures();
    initPyramidTextures();
    initCubeTextures();
    initHotspotTextures();

    // Initialise world objects
    loadWorld();

    // Bind keyboard handling functions to document handlers
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;

    pyramids.push(new PlayerObject('PYR', 0.25, 0.6, -7.0, 0.6, 1, 1, 1, []));
    pyramids.push(new PlayerObject('PYR', 0.19, 1.0, -8, 0.5, 1, 1, 1, []));
    pyramids.push(new PlayerObject('PYR', 0.21, -1, -7, 0.6, 1, 1, 1, []));
    pyramids.push(new PlayerObject('PYR', 0.3, 0, -8.6, 0.6, 1, 1, 1, [pyramids[0], pyramids[1], pyramids[2]])); // the main one is last

    cubes.push(new PlayerObject('CUBE', 0.25, 0.6, -12.0, 0.6, 1, 1, 1, []));
    cubes.push(new PlayerObject('CUBE', 0.19, 1.0, -13, 0.5, 1, 1, 1, []));
    cubes.push(new PlayerObject('CUBE', 0.21, -1, -12, 0.6, 1, 1, 1, []));
    cubes.push(new PlayerObject('CUBE', 0.3, 0, -13.6, 0.6, 1, 1, 1, [cubes[0], cubes[1], cubes[2]])); // the main one is last

    // Set up to draw the scene periodically.
    setInterval(function() {
      if (checkIfAllTexturesLoaded()) { // only draw scene and animate when textures are loaded.
        requestAnimationFrame(animate);
        handleKeys();
        mouseMovePlayground();
        drawScene();
      }
    }, 15);
  }
}