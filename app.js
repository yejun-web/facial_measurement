const container = document.getElementById('container')
const textureLoader = new THREE.TextureLoader()
var renderer      // WebGL渲染器
var labelRenderer // 2D标签渲染器
var camera        // 摄像机
var scene         // 画布
var mesh          // 物体

var raycaster     // 模型
var mouse = new THREE.Vector2()
var position = new THREE.Vector3()
var positionList = []
var point
var lines = []
var isMove
var isModel
var signLine      // 标识连线

// gui
var params = {
    
}

function init() {
    // renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true, // 抗锯齿
        precision: 'highp',
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(renderer.domElement)

    // labelRenderer
    labelRenderer = new THREE.CSS2DRenderer()
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    container.appendChild(labelRenderer.domElement)

    // stats
    stats = new Stats()
    container.appendChild(stats.dom)

    // http://www.webgl3d.cn/threejs/docs/index.html#api/zh/cameras/PerspectiveCamera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        1000
    )
    camera.position.z = 120
    camera.target = new THREE.Vector3()

    var controls = new THREE.OrbitControls(camera, labelRenderer.domElement) // labelRenderer
    controls.minDistance = 50
    controls.maxDistance = 200

    // 设置环境光、方向光源
    scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0x443333))

    var light = new THREE.DirectionalLight(0xffddcc, 1)
    light.position.set(1, 0.75, 0.5)
    scene.add(light)
    var light = new THREE.DirectionalLight(0xccccff, 1)
    light.position.set(-1, 0.75, -0.5)
    scene.add(light)

    // http://www.webgl3d.cn/threejs/docs/index.html#api/zh/core/BufferGeometry
    point = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }))
    scene.add(point)

    // 导入模型
    loadPatient()

    // http://www.webgl3d.cn/threejs/docs/index.html#api/zh/core/Raycaster
    raycaster = new THREE.Raycaster()

    // 监听事件
    window.addEventListener('mousemove', onMouseMove)
    controls.addEventListener('change', function () {
        isMove = true
    })
    window.addEventListener('mousedown', () => {
        isMove = false
    }, false)
    window.addEventListener('mouseup', () => {
        if (isModel && !isMove) {
            handleConnect()
        }
    })

    // 视图更新
    window.addEventListener('resize', () => {
        onWindowResize()
    })

    // https://zhuanlan.zhihu.com/p/47752059
    var gui = new dat.GUI()
    gui.open()

    // 开始渲染
    animate()
}

function loadPatient() {
    new THREE.MTLLoader()
        .setPath('models/patient_1/')
        .load('head3d.obj.mtl', function(materials) {
            materials.preload()
            new THREE.OBJLoader()
                .setMaterials(materials)
                .setPath('models/patient_1/')
                .load('head3d.obj', function(object) {
                    mesh = object.clone()
                    scene.add(mesh)
                    mesh.scale.set(0.3, 0.3, 0.3)
                })
        })
}

function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    checkIntersection()
    if (positionList[lines.length] && positionList[lines.length].length === 1) {
        // 创建动态线段
        scene.remove(signLine)
        var geometry = new THREE.BufferGeometry()
        geometry.setFromPoints([positionList[lines.length][0], position])
        signLine = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ linewidth: 4 })
        )
        scene.add(signLine)
    }
}

// http://www.webgl3d.cn/threejs/docs/index.html#api/zh/core/Geometry
function checkIntersection() {
    if (!mesh) return
    raycaster.setFromCamera(mouse, camera) // 光线投射用于进行鼠标拾取
    var intersects = raycaster.intersectObjects([mesh], true) // 获取鼠标和模型的焦点
    if (intersects.length) {
        var p = intersects[0].point
        point.position.set(p.x, p.y, p.z)
        // 拷贝坐标
        position.copy(p)
        isModel = true
    } else {
        isModel = false
    }
}

function handleConnect(e) {
    checkIntersection()
    if (!positionList[lines.length]) positionList[lines.length] = []
    positionList[lines.length].push(new THREE.Vector3().copy(position))
    // 
    var geometry = new THREE.SphereGeometry(0.2, 32, 32)
    var material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    var sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(position.x, position.y, position.z)
    scene.add(sphere)
    // 当前index数组中包含坐标数等于2时连线
    if (positionList[lines.length].length !== 2) return
    let connect = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(positionList[lines.length]),
        new THREE.LineBasicMaterial({ linewidth: 1 })
    )
    // 
    let distance = positionList[lines.length][0].distanceTo(positionList[lines.length][1])
    let _position = new THREE.Vector3(
        (positionList[lines.length][0].x + positionList[lines.length][1].x) / 2,
        (positionList[lines.length][0].y + positionList[lines.length][1].y) / 2,
        (positionList[lines.length][0].z + positionList[lines.length][1].z) / 2
    )
    // 创建射线
    lines.push(connect)
    scene.add(connect)
    // 创建标签
    createLabel(distance.toFixed(4), _position)
}

function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    stats.update()
}

// resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
}

// 创建2D标签
function createLabel(text, position) {
    const div = document.createElement('div')
    div.className = 'label'
    div.textContent = text
    const divLabel = new THREE.CSS2DObject(div)
    divLabel.position.set(position.x, position.y, position.z)
    scene.add(divLabel)
}

window.addEventListener('load', init)
