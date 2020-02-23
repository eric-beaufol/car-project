import React from 'react'
import styles from './Home.css'
import * as THREE from 'three'
import * as CANNON from 'cannon'
import OrbitControls from 'orbit-controls-es6'
import Stats from 'stats.js'
import dat from 'dat.gui'

// Interactivity
let mousedown = false, wheelRef = []

// THREE
let scene, camera, renderer, controls, directionalLight, spotLight, camRotation = new THREE.Vector3(0, 0, 0)

// UI
const settings = {
  trackVehicleRotation: true
}

// CANNON
let world, groundMaterial, wheelMaterial, wheelGroundContactMaterial, wheelBodies

// Mixed
let vehicle, groundMesh, boxes = [], launchingPads = [], spheres = [], groundSize = 500, maxBoxes = 0, maxLaunchingPads = 20

// Stats.js
let stats

class Home extends React.Component {

  constructor(props) {
    super(props)

    this.canvas = React.createRef()
    this.animate = this.animate.bind(this)
  }

  componentDidMount() {
    this.setScene()

    this.addGround()
    this.addVehicle()

    document.onkeydown = this.handler
    document.onkeyup = this.handler
    document.onclick = this.addBox
    document.onmousedown = this.onMousedown
    document.onmouseup = this.onMouseup
    document.onmousemove = this.onMousemove
    window.onresize = this.onResize

    for (let i = 0; i < maxBoxes; i++) {
      this.addBox(true)
    }

    let count = 0

    for (let ii = 0; ii < maxLaunchingPads; ii++) {
      this.addLaunchingPad(true)
    }

    // const interval = setInterval(() => {
    //   if (count%2) {
    //     this.addSphere(false)
    //   } else {
    //     this.addLaunchingPad(false)
    //   }
      
    //   count++
    //   if (count === maxLaunchingPads) {
    //     clearInterval(interval)
    //   } 
    // }, 1000)

    this.animate()
  }

  onMousedown(e) {
    e.preventDefault()
    mousedown = true
  }

  onMouseup(e) {
    e.preventDefault()
    mousedown = false
  }

  onMousemove(e) {
    e.preventDefault()

    if (mousedown) {
      camRotation.y -= e.movementX / 100
      camRotation.x += e.movementY / 100
    }
  }

  onResize() {
    renderer.setSize(innerWidth, innerHeight)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
  }

  setScene() {
    // THREE

    renderer = new THREE.WebGLRenderer({antialias: false, canvas: this.canvas})
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(devicePixelRatio)
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    scene = new THREE.Scene()
    scene.background = new THREE.Color().setHSL(0.6, 0, 1)
    scene.fog = new THREE.Fog(scene.background, 1, 800)
    
    camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000)
    camera.position.y = 15
    camera.position.z = 40

    controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 0
    controls.maxDistance = 1000
    controls.enableKeys = false

    const grid = new THREE.GridHelper(groundSize, groundSize / 25)
    grid.position.set(0, 0.1, 0)
    // scene.add(grid)

    // const ambientLight = new THREE.AmbientLight(0xffffff, .2)
    // scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
    hemiLight.color.setHSL(0.6, 1, 0.6)
    hemiLight.groundColor.setHSL(0.095, 1, 0.75)
    hemiLight.position.set(0, 5, 0)
    scene.add(hemiLight)

    spotLight = new THREE.SpotLight(0xffffff, 1, 100, 0.7, 0.28, .5)
    spotLight.position.set(0, 70, 0)
    spotLight.castShadow = true
    scene.add(spotLight)

    directionalLight = new THREE.DirectionalLight(0xda2b2b, 0.5, 100)
    directionalLight.castShadow = true
    directionalLight.position.set(0, 100, 0)
    scene.add(directionalLight)
    // directionalLight.target.position.set(10, 0, 10)

    const pointLight = new THREE.PointLight(0xda2b2b, 1)
    pointLight.castShadow = true
    pointLight.position.set(0, 10, 0)
    scene.add(pointLight)

    // CANNON

    world = new CANNON.World()
    world.broadphase = new CANNON.NaiveBroadphase(world)
    world.gravity.set(0, -10, 0)

    // Stats.js
    stats = new Stats()
    document.body.appendChild(stats.domElement)

    // Dat.gui
    const gui = new dat.GUI()
    gui.add(settings, 'trackVehicleRotation')
  }

  addVehicle() {
    wheelMaterial = new CANNON.Material('wheelMaterial')
    wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
      friction: 0.3,
      restitution: 0,
      contactEquationStiffness: 1000
    })

    world.addContactMaterial(wheelGroundContactMaterial)

    const chassisShape = new CANNON.Box(new CANNON.Vec3(2, 1, .5))
    const chassisBody = new CANNON.Body({mass: 18 })
    chassisBody.addShape(chassisShape)
    chassisBody.position.set(0, 1, 0)
    chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2)

    const geometry = new THREE.BoxGeometry(4, 2, 1)
    const material = new THREE.MeshLambertMaterial(0xffffff)
    vehicle = new THREE.Mesh(geometry, material)
    vehicle.castShadow = true
    scene.add(vehicle)

    var options = {
      radius: 1,
      directionLocal: new CANNON.Vec3(0, 0, -1),
      suspensionStiffness: 30,
      suspensionRestLength: 0.3,
      frictionSlip: 5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence:  0.01,
      axleLocal: new CANNON.Vec3(0, 1, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    vehicle.physics = new CANNON.RaycastVehicle({ chassisBody })
    
    options.chassisConnectionPointLocal.set(1, 1, 0.2)
    vehicle.physics.addWheel(options)

    options.chassisConnectionPointLocal.set(1, -1, 0.2)
    vehicle.physics.addWheel(options)

    options.chassisConnectionPointLocal.set(-1, 1, 0.2)
    vehicle.physics.addWheel(options)

    options.chassisConnectionPointLocal.set(-1, -1, 0.2)
    vehicle.physics.addWheel(options)

    vehicle.physics.addToWorld(world)

    vehicle.physics.wheels = []
    vehicle.wheels = []

    wheelBodies = []

    vehicle.physics.wheelInfos.forEach(wheel => {
      const shape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20)
      const body = new CANNON.Body({ mass: 0 })
      body.type = CANNON.Body.KINEMATIC
      body.collisionFilterGroup = 0 // turn off collisions
      wheelBodies.push(body)
      const q2 = new CANNON.Quaternion()
      q2.setFromAxisAngle(new CANNON.Vec3(0, 0, 0), Math.PI / 2)
      body.addShape(shape, new CANNON.Vec3(), q2)
      vehicle.physics.wheels.push(body)
      world.add(body)

      // console.log(wheel)

      const wheelGeometry = new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.25, 20)
      const wheelMesh = new THREE.Mesh(wheelGeometry, material)
      wheelMesh.castShadow = true
      scene.add(wheelMesh)
      vehicle.wheels.push(wheelMesh)
    })
  }

  addGround() {
    groundMaterial = new CANNON.Material('groundMaterial')

    const planeShape = new CANNON.Box(new CANNON.Vec3(groundSize / 2, 10, groundSize / 2))
    const body = new CANNON.Body({ mass: 0, shape: planeShape, material: groundMaterial })
    body.position.set(0, -10, 0)
    world.add(body)

    const geometry = new THREE.BoxGeometry(groundSize, 20, groundSize)
    const material = new THREE.MeshPhongMaterial(0xffffff)
    material.color.setHSL(0.095, 1, 0.75)
    material.needsUpdate = true

    groundMesh = new THREE.Mesh(geometry, material)
    groundMesh.receiveShadow = true
    groundMesh.position.set(0, -10, 0)
    scene.add(groundMesh)
  }

  addSphere() {
    const geometry = new THREE.SphereGeometry(3, 10, 10)
    const material = new THREE.MeshPhongMaterial(0xffffff)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    const shape = new CANNON.Sphere(3)
    mesh.physics = new CANNON.Body({shape, mass: 70})

    const x = 0
    const y = 50
    const z = 0

    mesh.physics.position.set(x, y, z)

    scene.add(mesh)
    world.add(mesh.physics)
    spheres.push(mesh)
  }

  addBox(randomPos) {
    const size = 1 + Math.random() * 4
    const geometry = new THREE.BoxGeometry(size, size, size)
    const material = new THREE.MeshLambertMaterial(0xffffff)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2))
    mesh.physics = new CANNON.Body({shape, mass: 70})

    const x = randomPos
      ? Math.random() * groundSize - groundSize / 2
      : 0
    const y = randomPos
      ? size / 2
      : 50
    const z = randomPos
      ? Math.random() * groundSize - groundSize / 2
      : 0

    mesh.physics.position.set(x, y, z)

    scene.add(mesh)
    world.add(mesh.physics)
    boxes.push(mesh)
  }

  addLaunchingPad(randomPos) {
    const halfWidth = 3
    const halfHeight = 1
    const halfDepth = 6
    const geometry = new THREE.Geometry()

    geometry.vertices.push(
      new THREE.Vector3(-halfWidth, -halfHeight, halfDepth), // 0
      new THREE.Vector3(halfWidth, -halfHeight, halfDepth), // 1
      new THREE.Vector3(halfWidth, -halfHeight, -halfDepth), // 2
      new THREE.Vector3(-halfWidth, -halfHeight, -halfDepth), // 3
      new THREE.Vector3(-halfWidth, halfHeight, -halfDepth), // 4
      new THREE.Vector3(halfWidth, halfHeight, -halfDepth), // 5
    )

    geometry.faces.push(
      new THREE.Face3(1, 0, 2), new THREE.Face3(2, 0, 3), // -y
      new THREE.Face3(4, 0, 5), new THREE.Face3(5, 0, 1), // y 
      new THREE.Face3(5, 2, 4), new THREE.Face3(4, 2, 3), // -z 
      new THREE.Face3(3, 0, 4), // -x
      new THREE.Face3(5, 1, 2), // x 
    )

    geometry.faces[0].color = geometry.faces[1].color = new THREE.Color('red')
    geometry.faces[2].color = geometry.faces[3].color = new THREE.Color('white')
    geometry.faces[4].color = geometry.faces[5].color = new THREE.Color('yellow')
    geometry.faces[6].color = new THREE.Color('magenta')
    geometry.faces[7].color = new THREE.Color('cyan')
    
    geometry.computeFaceNormals()

    const material = new THREE.MeshPhongMaterial({vertexColors: THREE.FaceColors, side: THREE.FrontSide})
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const points = []
    const faces = []

    mesh.geometry.vertices.forEach(vertice => {
      points.push(new CANNON.Vec3(vertice.x, vertice.y, vertice.z))
    })
    
    faces.push(
      [0, 3, 2, 1], // -y
      [2, 3, 4, 5], // -z
      [0, 1, 5, 4], // y
      [5, 1, 2], // -x
      [4, 3, 0], // x
    )
    
    const shape = new CANNON.ConvexPolyhedron(points, faces)
    mesh.physics = new CANNON.Body({ shape, mass: 200 })

    const x = randomPos
      ? groundSize * Math.random() - groundSize / 2
      : 8
    const y = randomPos
      ? halfHeight
      : halfHeight
    const z = randomPos
      ? groundSize * Math.random() - groundSize / 2
      : 0
      
    mesh.physics.position.set(x, y, z)
    mesh.physics.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    
    world.add(mesh.physics)

    launchingPads.push(mesh)
  }

  handler() {
    if (!vehicle) return
    const { physics } = vehicle
    var maxSteerVal = 0.5;
    var maxForce = 60;
    var brakeForce = 1000000;

    const up = (event.type == 'keyup')

    if(!up && event.type !== 'keydown') {
      return
    }

    physics.setBrake(0, 0)
    physics.setBrake(0, 1)
    physics.setBrake(0, 2)
    physics.setBrake(0, 3)

    switch (event.keyCode) {

    case 38: // forward
      physics.applyEngineForce(up ? 0 : -maxForce, 2)
      physics.applyEngineForce(up ? 0 : -maxForce, 3)
      break

    case 40: // backward
      physics.applyEngineForce(up ? 0 : maxForce, 2)
      physics.applyEngineForce(up ? 0 : maxForce, 3)
      break

    case 66: // b
      physics.setBrake(brakeForce, 0)
      physics.setBrake(brakeForce, 1)
      physics.setBrake(brakeForce, 2)
      physics.setBrake(brakeForce, 3)
      break

    case 39: // right
      physics.setSteeringValue(up ? 0 : -maxSteerVal / 4, 0)
      physics.setSteeringValue(up ? 0 : -maxSteerVal, 1)
      break

    case 37: // left
      physics.setSteeringValue(up ? 0 : maxSteerVal, 0)
      physics.setSteeringValue(up ? 0 : maxSteerVal / 4, 1)
      break
    }
  }

  animate() {
    requestAnimationFrame(this.animate)

    stats.begin()

    this.update()
    renderer.render(scene, camera)

    stats.end()
  }

  update() {

    if (vehicle) {
      const { chassisBody, wheelInfos } = vehicle.physics
      
      vehicle.position.copy(chassisBody.position)
      vehicle.quaternion.copy(chassisBody.quaternion)

      for (let i = 0; i < wheelInfos.length; i++) {
        vehicle.physics.updateWheelTransform(i)
        const t = wheelInfos[i].worldTransform
        const wheelBody = wheelBodies[i]

        wheelBody.position.copy(t.position)
        wheelBody.quaternion.copy(t.quaternion)

        vehicle.wheels[i].position.copy(wheelBody.position)
        vehicle.wheels[i].quaternion.copy(wheelBody.quaternion)

        if (wheelInfos[i].sliding) {
          wheelRef[i].classList.add(styles.sliding)
        } else {
          wheelRef[i].classList.remove(styles.sliding)
        }
      }
    }

    boxes.forEach(box => {
      box.position.copy(box.physics.position)
      box.quaternion.copy(box.physics.quaternion)
    })

    launchingPads.forEach(launchingPad => {
      launchingPad.position.copy(launchingPad.physics.position)
      launchingPad.quaternion.copy(launchingPad.physics.quaternion)
    })

    spheres.forEach(sphere => {
      sphere.position.copy(sphere.physics.position)
      sphere.quaternion.copy(sphere.physics.quaternion)
    })

    world.step(1 / 60)

    if (vehicle) {
      // camera position
      const offset = new THREE.Vector3(0, -6, 20)

      if (settings.trackVehicleRotation) {
        camRotation.y = vehicle.rotation.z + Math.PI / 2
      }

      // rotation
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), camRotation.x)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), camRotation.y)

      const camPos = vehicle.position.clone().sub(offset)

      camera.position.copy(camPos)
      camera.lookAt(vehicle.position)

    }

    // controls.update()

  }

  render() {
    return (
      <div className={styles.container}>
        <div className={styles['wheel-info']}>
          <div ref={el => { wheelRef[0] = el}} />
          <div ref={el => { wheelRef[1] = el}} />
          <div ref={el => { wheelRef[2] = el}} />
          <div ref={el => { wheelRef[3] = el}} />
        </div>
        <canvas ref={el => { this.canvas = el }}/>
      </div>
    )
  }
}

export default Home