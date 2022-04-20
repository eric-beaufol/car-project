import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'
// import CannonDebugRenderer from './utils/CannonDebugRenderer'
import CannonDebugger from 'cannon-es-debugger'
import Stats from 'stats.js'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise'
import { Sky } from 'three/examples/jsm/objects/Sky'

/**
 * Base
 */

const debug = {
  debug: false
}

const objectsToUpdate = [], wheelBodies = [], wheelMeshes = [], keydown = []
let car, cannonDebugger, vehicle

// Stats
const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

// Debug
const gui = new dat.GUI()
const debugObject = {}

gui.add(debug, 'debug').onChange(value => {
  
})

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Physics

const world = new CANNON.World()
world.gravity.set(0, -10, 0)
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.solver.iterations = 10

const groundMaterial = new CANNON.Material('groundMaterial')
const wheelMaterial = new CANNON.Material('wheelMaterial')
const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
  friction: 1,
  restitution: .2,
  // contactEquationStiffness: 1000
})
world.addContactMaterial(wheelGroundContactMaterial)
world.defaultContactMaterial = wheelGroundContactMaterial

// Debug

if (debug.debug) {
  cannonDebugger = new CannonDebugger(scene, world)
}

/**
 * Environment map
 */

const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMap = cubeTextureLoader.load([
  '/textures/environmentMaps/0/px.jpg',
  '/textures/environmentMaps/0/nx.jpg',
  '/textures/environmentMaps/0/py.jpg',
  '/textures/environmentMaps/0/ny.jpg',
  '/textures/environmentMaps/0/pz.jpg',
  '/textures/environmentMaps/0/nz.jpg'
])
environmentMap.encoding = THREE.sRGBEncoding

// scene.background = environmentMap
scene.environment = environmentMap

/**
 * Material update
 */


const updateAllMaterials = () => {
  scene.traverse(child => {
      if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial &&
          !child.material.preventUpdate
      ) {
          child.material.envMapIntensity = debugObject.envmapIntensity
          child.castShadow = true
          child.receiveShadow = true
          child.material.needsUpdate = true
      }
  })
}

debugObject.envmapIntensity = 7
gui.add(debugObject, 'envmapIntensity').min(0).max(10).step(0.01).onChange(updateAllMaterials)

/**  
 * Models
 */

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)
const carFolder = gui.addFolder('car')

gltfLoader.load(
  '/models/car/car.glb',
  gltf => {
    // return

    scene.add(gltf.scene)
    car = gltf.scene.getObjectByName('car')

    wheelMeshes[0] = gltf.scene.getObjectByName('front_left_wheel')
    wheelMeshes[1] = gltf.scene.getObjectByName('front_right_wheel')
    wheelMeshes[2] = gltf.scene.getObjectByName('back_left_wheel')
    wheelMeshes[3] = gltf.scene.getObjectByName('back_right_wheel')

    wheelMeshes[0].traverse(child => {
      child.rotation.y = Math.PI
    })

    wheelMeshes[2].traverse(child => {
      child.rotation.y = Math.PI
    })

    updateAllMaterials()

    const carTop = new CANNON.Box(
      new CANNON.Vec3(0.81, 0.2835, 0.8775)
    )
    
    const carBottom = new CANNON.Box(
      new CANNON.Vec3(1.755, 0.2925, 0.8775)      
    )
    
    const chassisBody = new CANNON.Body({ mass: 150 })
    chassisBody.addShape(carBottom)
    chassisBody.addShape(carTop, new CANNON.Vec3(-0.495, 0.585, 0))

    car.body = chassisBody
    objectsToUpdate.push(car)

    chassisBody.position.z = -2.2
    chassisBody.position.y = 15

    // Create the vehicle
    vehicle = new CANNON.RaycastVehicle({
      chassisBody,
    })

    const options = {
      radius: 0.315,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 14,
      suspensionRestLength: 0.3,
      frictionSlip: 2,
      dampingRelaxation: .0001,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.05,
      axleLocal: new CANNON.Vec3(0, 0, 1),
      chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    }

    const xFront = 0.8775
    const xRear = -1.134
    const y = -0.26
    const z = 0.756
    const frontStiffnessOffset = 3

    options.suspensionStiffness += frontStiffnessOffset

    options.chassisConnectionPointLocal.set(xFront, y, z)
    vehicle.addWheel(options)

    options.chassisConnectionPointLocal.set(xFront, y, -z)
    vehicle.addWheel(options)

    options.suspensionStiffness -= frontStiffnessOffset

    options.chassisConnectionPointLocal.set(xRear, y, z)
    vehicle.addWheel(options)

    options.chassisConnectionPointLocal.set(xRear, y, -z)
    vehicle.addWheel(options)

    debug.suspensionStiffness = options.suspensionStiffness
    
    carFolder.add(debug, 'suspensionStiffness').min(0).max(2000).step(1).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.suspensionStiffness = value
      })
    })

    debug.suspensionRestLength = options.suspensionRestLength

    carFolder.add(debug, 'suspensionRestLength').min(0).max(1).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.suspensionRestLength = value
      })
    })

    debug.frictionSlip = options.frictionSlip

    carFolder.add(debug, 'frictionSlip').min(0).max(20).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.frictionSlip = value
      })
    })

    debug.dampingRelaxation = options.dampingRelaxation

    carFolder.add(debug, 'dampingRelaxation').min(0).max(20).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.dampingRelaxation = value
      })
    })

    debug.dampingCompression = options.dampingCompression

    carFolder.add(debug, 'dampingCompression').min(0).max(20).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.dampingCompression = value
      })
    })

    debug.rollInfluence = options.rollInfluence

    carFolder.add(debug, 'rollInfluence').min(0).max(1).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.rollInfluence = value
      })
    })

    debug.maxSuspensionTravel = options.maxSuspensionTravel

    carFolder.add(debug, 'maxSuspensionTravel').min(0).max(10).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.maxSuspensionTravel = value
      })
    })

    debug.customSlidingRotationalSpeed = options.customSlidingRotationalSpeed

    carFolder.add(debug, 'customSlidingRotationalSpeed').min(-50).max(50).step(.001).onChange(value => {
      vehicle.wheelInfos.forEach(wheel => {
        wheel.customSlidingRotationalSpeed = value
      })
    })

    vehicle.addToWorld(world)

    vehicle.wheelInfos.forEach(({ radius }, index) => {
      const cylinderShape = new CANNON.Cylinder(radius, radius, radius * .85, 20)
      const wheelBody = new CANNON.Body({ mass: 0, material: wheelMaterial })

      // wheelBody.type = CANNON.Body.KINEMATIC
      wheelBody.collisionFilterGroup = 0 // turn off collisions

      const quaternion = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0)
      
      wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion)
      wheelBodies.push(wheelBody)
      world.addBody(wheelBody)

      wheelMeshes[index].body = wheelBody
      objectsToUpdate.push(wheelMeshes[index])
    })

    // Update wheels
    world.addEventListener('postStep', () => {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i)

        const transform = vehicle.wheelInfos[i].worldTransform
        const wheelBody = wheelBodies[i]
         
        wheelBody.position.copy(transform.position)

        if (i % 2) {
          wheelBody.quaternion.copy(transform.quaternion)
        } else {
          wheelBody.quaternion.copy(transform.quaternion)
        }
      }
    })

    addCarControls()
  },
  progress => {
    console.log('progress ')
  },
  error => {
    console.log('error ', error)
  }
)

// Car controls

function addCarControls() {
  document.addEventListener('keydown', handleKeyChange)
  document.addEventListener('keyup', handleKeyChange)
}

let steerVal = 0

debug.maxSteerVal = .5
debug.maxForce = 270
debug.brakeForce = 5.9
debug.handbrakeForce = 100
debug.steerInc = .0125

carFolder.add(debug, 'maxForce').min(50).max(1000)
carFolder.add(debug, 'handbrakeForce').min(1).max(10).step(.001)
carFolder.add(debug, 'brakeForce').min(1).max(10).step(.001)


const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'b', ' ']

function handleKeyChange(event) {
  const { key, type } = event

  if (keys.indexOf(key) !== -1) {

    if (type === 'keydown') {
      // console.log(`[KEYDOWN] ${key}`)

      if (keydown.indexOf(key) < 0) {
        keydown.push(key)
      }
    } else {
      // console.log(`[KEYUP] ${key}`)

      const index = keydown.indexOf(key)
      keydown.splice(index, 1)

      switch(key) {
        case 'ArrowUp':
        case 'ArrowDown':
        vehicle.applyEngineForce(0, 2)
        vehicle.applyEngineForce(0, 3)
        break

      case 'ArrowLeft':
      case 'ArrowRight':
        steerVal = 0
        vehicle.setSteeringValue(0, 0)
        vehicle.setSteeringValue(0, 1)
        break

      case 'b':
        vehicle.setBrake(0, 0)
        vehicle.setBrake(0, 1)
        vehicle.setBrake(0, 2)
        vehicle.setBrake(0, 3)
        break
  
      case ' ':
        vehicle.setBrake(0, 2)
        vehicle.setBrake(0, 3)
        break
      }
    }
  }
}

function applyKeys() {
    
  keydown.forEach(key => {
    switch(key) {
      case 'ArrowUp':
        vehicle.applyEngineForce(debug.maxForce, 2)
        vehicle.applyEngineForce(debug.maxForce, 3)
        break
      
      case 'ArrowDown':
        vehicle.applyEngineForce(-debug.maxForce, 2)
        vehicle.applyEngineForce(-debug.maxForce, 3)
        break

      case 'ArrowLeft':
        steerVal = Math.min(debug.maxSteerVal, steerVal + debug.steerInc)
        vehicle.setSteeringValue(steerVal, 0)
        vehicle.setSteeringValue(steerVal, 1)
        // console.log(steerVal)
        break
      
      case 'ArrowRight':
        steerVal = Math.max(-debug.maxSteerVal, steerVal - debug.steerInc)
        vehicle.setSteeringValue(steerVal, 0)
        vehicle.setSteeringValue(steerVal, 1)
        break

      case 'b':
        vehicle.setBrake(debug.brakeForce, 0)
        vehicle.setBrake(debug.brakeForce, 1)
        vehicle.setBrake(debug.brakeForce, 2)
        vehicle.setBrake(debug.brakeForce, 3)
        break
  
      case ' ':
        vehicle.setBrake(debug.handbrakeForce, 2)
        vehicle.setBrake(debug.handbrakeForce, 3)
        break
    }
  })
}

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffc0cb, .1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffc0cb, 1.6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(4096, 4096)
directionalLight.shadow.camera.far = 35
directionalLight.shadow.camera.left = -20
directionalLight.shadow.camera.top = 20
directionalLight.shadow.camera.right = 20
directionalLight.shadow.camera.bottom = -20
directionalLight.position.set(0, 1, -2)
directionalLight.shadow.bias = -0.0325
scene.add(directionalLight)

console.log(directionalLight)


const folder = gui.addFolder('directionalLight')

folder.add(directionalLight.shadow.mapSize, 'x').min(1024).max(10240).step(5)
folder.add(directionalLight.shadow.mapSize, 'y').min(1024).max(10240).step(5)
folder.add(directionalLight.shadow.camera, 'far').min(10).max(300).step(0.001).onChange(() => {
  directionalLight.shadow.camera.updateProjectionMatrix()
})
folder.add(directionalLight.shadow.camera, 'left').min(-2000).max(-20).step(1).onChange(() => {
  directionalLight.shadow.camera.updateProjectionMatrix()
})
folder.add(directionalLight.shadow.camera, 'right').min(20).max(2000).step(1).onChange(() => {
  directionalLight.shadow.camera.updateProjectionMatrix()
})
folder.add(directionalLight.shadow.camera, 'bottom').min(-2000).max(-20).step(1).onChange(() => {
  directionalLight.shadow.camera.updateProjectionMatrix()
})
folder.add(directionalLight.shadow.camera, 'top').min(20).max(2000).step(1).onChange(() => {
  directionalLight.shadow.camera.updateProjectionMatrix()
})

folder.add(directionalLight.shadow, 'bias').min(-1).max(1).step(0.0001)

const lightHelper = new THREE.DirectionalLightHelper(directionalLight)
// scene.add(lightHelper)

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 5000)
camera.position.set(-12, 5, -2)
const cameraGroup = new THREE.Group()
scene.add(cameraGroup)
cameraGroup.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.autoRotate = false

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Add Sky
const sky = new Sky()
sky.scale.setScalar(450000)
scene.add(sky)

const sun = new THREE.Vector3(0, 0, 0)
const phi = THREE.MathUtils.degToRad(90 - 5)
const theta = THREE.MathUtils.degToRad(180)
sun.setFromSphericalCoords(1, phi, theta)
const uniforms = sky.material.uniforms
uniforms['sunPosition'].value.copy(sun)

const effectController = {
  turbidity: 0.6,
  rayleigh: 2.7,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.7,
  elevation: 3.7,
  azimuth: 180,
  exposure: renderer.toneMappingExposure
}

function guiChanged() {

  const uniforms = sky.material.uniforms;
  uniforms[ 'turbidity' ].value = effectController.turbidity;
  uniforms[ 'rayleigh' ].value = effectController.rayleigh;
  uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
  uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

  const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
  const theta = THREE.MathUtils.degToRad( effectController.azimuth );

  sun.setFromSphericalCoords( 1, phi, theta );

  uniforms[ 'sunPosition' ].value.copy( sun );

  renderer.toneMappingExposure = effectController.exposure;
  renderer.render( scene, camera );

}

gui.add( effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( guiChanged );
gui.add( effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( guiChanged );
gui.add( effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( guiChanged );
gui.add( effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( guiChanged );
gui.add( effectController, 'elevation', 0, 90, 0.1 ).onChange( guiChanged );
gui.add( effectController, 'azimuth', - 180, 180, 0.1 ).onChange( guiChanged );
gui.add( effectController, 'exposure', 0, 1, 0.0001 ).onChange( guiChanged );

guiChanged();

function checkAccident() {
  const rotation = new CANNON.Vec3()
  car.body.quaternion.toEuler(rotation)
  const { x, y , z } = rotation

  rotationEl.innerText = `rotation : x: ${Math.round(x)}, y: ${Math.round(y)}, z: ${Math.round(z)}`

  if (
    car.body.velocity.length() < 1  &&
    (
      Math.abs(x) > 1.5 ||
      Math.abs(z) > 1.5
    )
  ) {
    notOnWheels++

    if (notOnWheels > 100) {
      car.body.velocity.set(0, 0, 0)
      car.body.angularVelocity.set(0, 0, 0)
      car.body.position.y = 5
      car.body.quaternion = new CANNON.Quaternion()
    }
    
  } else {
    notOnWheels = 0
  }
}

/**
 * Ground box
 */

function addGroundBox() {
  const body = new CANNON.Body({ mass: 0 })
  const shape = new CANNON.Box(new CANNON.Vec3(10000, 10, 10000))
  body.addShape(shape)
  body.position.y = -10
  world.addBody(body)

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(20000, 20, 20000),
    new THREE.MeshStandardMaterial({ color: 0x000 })
  )

  scene.add(mesh)

  mesh.position.copy(body.position)
  mesh.quaternion.copy(body.quaternion)

  const gridHelper = new THREE.GridHelper(1000, 999)
  gridHelper.position.y = .05
  gridHelper.visible = false
  scene.add(gridHelper)

  gui.add(gridHelper, 'visible').name('grid helper visible')
}

// addGroundBox()

/**
 * Terrain
 */
function addTerrain() {
  const size = 100
  const resolution = 1
  const scaleHeight = .5
  const scale = .2
  
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, size * resolution, size * resolution),
    new THREE.MeshStandardMaterial({ color: 0xccc, wireframe: true })
  )
  
  const noise = new SimplexNoise()
  const position = mesh.geometry.attributes.position.array
  const matrix = []
  
  for (let i = 0; i < position.length; i += 3) {
    const height = noise.noise(position[i] * scale, position[i + 1] * scale) * scaleHeight
    position[i + 2] = height
  }

  for (let i = 0; i < size; i++) {
    matrix.push([])
    for (let j = 0; j < size; j++) {
      const height = position[i * 3 + j * 3 + 2]
      matrix[i].push(height)
    }
  }

  scene.add(mesh)

  const heightfieldShape = new CANNON.Heightfield(matrix, {
    elementSize: 1 / resolution
  })

  const heightfieldBody = new CANNON.Body({ mass: 0 })
  heightfieldBody.addShape(heightfieldShape, new CANNON.Vec3(-size / 2, -size / 2, 0))
  world.addBody(heightfieldBody)

  mesh.body = heightfieldBody
  objectsToUpdate.push(mesh)

  // heightfieldBody.position.set(
  //   -((size - 1) * heightfieldShape.elementSize) / 2,
  //   4,
  //   ((size - 1) * heightfieldShape.elementSize) / 2
  // )
  heightfieldBody.position.y = .4
  heightfieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
}

// addTerrain()

function addHeightfield() {
  const sizeX = 3000 // number of vertices in the X axis
  const sizeY = 3000 // number of vertices in the Y axis
  const elementSize = 2.5 // cell width
  const depth = 0.6
  const noise = new SimplexNoise()
  const scaleHeight = 20
  const scale = 20

  // Physics
  const body = new CANNON.Body({ mass: 0 })
  const matrix = []

  // Graphics
  const geometry = new THREE.PlaneGeometry(
    (sizeX - 1) * elementSize,
    (sizeY - 1) * elementSize,
    sizeX - 1,
    sizeY - 1
  )

  for (let i = 0; i < sizeX; i++) {
    matrix.push([])
    for (let j = 0; j < sizeY; j++) {
      const height = noise.noise(i / (sizeX - 1) * scale, j / (sizeY - 1) * scale) * scaleHeight
      matrix[i].push(height)
      geometry.attributes.position.setZ(j * sizeX + i, height)

    }
  }

  geometry.scale(1, -1, 1)

  // console.log(matrix)

  const shape = new CANNON.Heightfield(matrix, { elementSize })
  body.addShape(shape, new CANNON.Vec3((-(sizeX - 1) / 2) * elementSize, (-(sizeY - 1) / 2) * elementSize, 0))
  body.position.set(0, depth, 0)
  body.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(body)

  const normalTexture = new THREE.TextureLoader().load('/textures/sand_normal.jpg')
  normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping
  normalTexture.repeat.set(300, 300)

  geometry.computeBoundingSphere()
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x4477a9, 
    side: THREE.DoubleSide,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(.08, .08)
  })
  material.preventUpdate = true

  const mesh = new THREE.Mesh(geometry, material)

  mesh.castShadow = true
  mesh.receiveShadow = true

  // position and quaternion of the mesh are set by updateMeshPositions...
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  mesh.body = body
  objectsToUpdate.push(mesh)
}

addHeightfield()

/**
 * Animate
 */
 const clock = new THREE.Clock()
 let previousTime = 0, notOnWheels = 0
 const speedEl = document.querySelector('.speed')
 const rotationEl = document.querySelector('.rotation')
 
 const tick = () => {
   stats.begin()
 
   const elapsedTime = clock.getElapsedTime()
   const deltaTime = elapsedTime - previousTime
   previousTime = elapsedTime
 
   if (debug.debug) {
    cannonDebugger = cannonDebugger || new CannonDebugger(scene, world)
   }
   
   // Controls
   applyKeys()
 
   // Physics
   world.step(1/60, deltaTime)
 
   objectsToUpdate.forEach(mesh => {
     mesh.position.copy(mesh.body.position)
     mesh.quaternion.copy(mesh.body.quaternion)
   })
 
   controls.update()
 
   if (car) {
     camera.lookAt(car.position)
     cameraGroup.position.set(car.position.x, car.position.y + 5, car.position.z + 4)
     directionalLight.position.set(car.position.x, car.position.y + 5, car.position.z - 10)
   }
 
   // Render
   renderer.render(scene, camera)
 
   if (cannonDebugger) {
    cannonDebugger.update()
   }
 
   // Call tick again on the next frame
   window.requestAnimationFrame(tick)
 
   // debug
   if (car) {
     const speed = car.body.velocity.length()
     // console.log(`[SPEED] ${speed}`)
     speedEl.innerText = `${Math.round(speed / 1000 * 60 * 60 )}km/h`
   }
 
   if (typeof car !== 'undefined') {
     checkAccident()
   }
 
   stats.end()
 }
 
 tick()