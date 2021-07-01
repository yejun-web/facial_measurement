const container = document.getElementById('container')
const textureLoader = new THREE.TextureLoader()

var gui // gui
var renderer // WebGL渲染器
var labelRenderer // 2D标签渲染器
var camera // 摄像机
var scene // 画布
var mesh  // 模型
var raycaster // 光线投射
var mouse = new THREE.Vector2() // 鼠标二维坐标
var position = new THREE.Vector3() // 鼠标二维坐标映射

var point // 动态标识点
var signLine // 动态标识线
var isMove // 鼠标是否在移动模型
var isModel // 鼠标所在位置是否为模型
var linesPosition = [] // 线段坐标列表
var lines = [] // 线段列表
var anglesPosition = [] // 角度坐标列表
var angles = [] // 角度列表
var anglesGroup = []
var measureType = 'none' // 默认`none`, `distance`表示测量距离, `angle`表示测量角度

// gui
var params = {
    '提示信息': '点击选择操作方式',
    '测量距离': measureDistance,
    '测量角度': measureAngle,
    '取消操作': handleCancle,
}

// 测量距离
function measureDistance() {
    container.classList.add('crosshair')
    measureType = 'distance'
    point.visible = true
}

// 测量角度
function measureAngle() {
    container.classList.add('crosshair')
    measureType = 'angle'
    point.visible = true
}

// 取消操作
function handleCancle() {
    container.classList.remove('crosshair')
    measureType = 'none'
    point.visible = false
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

    // https://zhuanlan.zhihu.com/p/47752059
    gui = new dat.GUI()
    gui.add(params, '提示信息')
    gui.add(params, '测量距离')
    gui.add(params, '测量角度')
    gui.add(params, '取消操作')
    gui.open()

    // http://www.webgl3d.cn/threejs/docs/index.html#api/zh/cameras/PerspectiveCamera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        1000
    )
    camera.position.z = 120
    camera.target = new THREE.Vector3()

    // 设置鼠标控制
    var controls = new THREE.OrbitControls(camera, labelRenderer.domElement) // labelRenderer
    controls.minDistance = 50
    controls.maxDistance = 200

    // 设置环境光、方向光源
    scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0x443333))

    var light = new THREE.DirectionalLight(0xffddcc, 1)
    light.position.set(1, 0.75, 0.5)
    scene.add(light)
    var _light = new THREE.DirectionalLight(0xccccff, 1)
    _light.position.set(-1, 0.75, -0.5)
    scene.add(_light)

    // http://www.webgl3d.cn/threejs/docs/index.html#api/zh/core/BufferGeometry
    point = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffff00 }))
    scene.add(point)
    point.visible = false

    // 导入模型
    loadPatient()

    // 光线投射
    raycaster = new THREE.Raycaster()

    // 监听事件
    controls.addEventListener('change', function () {
        isMove = true
    })
    window.addEventListener('mousemove', onMouseMove)
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

    // 开始渲染
    animate()
}

// 导入模型
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

// http://www.webgl3d.cn/threejs/docs/index.html#api/zh/core/Raycaster
function checkIntersection() {
    if (!mesh) return
    raycaster.setFromCamera(mouse, camera) // 光线投射用于进行鼠标拾取
    var intersects = raycaster.intersectObjects([mesh], true) // 获取鼠标和模型的焦点
    if (intersects.length) {
        var p = intersects[0].point
        point.position.set(p.x, p.y, p.z)
        position.copy(p) // 拷贝坐标
        isModel = true
    } else {
        isModel = false
    }
}

function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    checkIntersection()
    if (measureType === 'distance') {
        // 创建动态线段
        if (!linesPosition[lines.length] || linesPosition[lines.length].length === 2) return
        scene.remove(signLine)
        var geometry = new THREE.BufferGeometry()
        geometry.setFromPoints([linesPosition[lines.length][0], position])
        signLine = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ linewidth: 4 })
        )
        scene.add(signLine)
    }
    if (measureType === 'angle') {
        if (!anglesPosition[angles.length] || anglesPosition[angles.length].length === 3) return
        scene.remove(signLine)
        var geometry = new THREE.BufferGeometry()
        geometry.setFromPoints([anglesPosition[angles.length][anglesPosition[angles.length].length - 1], position])
        signLine = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ linewidth: 4 })
        )
        scene.add(signLine)
    }
}

function handleConnect(e) {
    if (measureType === 'none') return
    if (measureType === 'distance') {
        if (!linesPosition[lines.length]) linesPosition[lines.length] = []
        linesPosition[lines.length].push(new THREE.Vector3().copy(position))
        // 添加坐标标识点
        var geometry = new THREE.SphereGeometry(0.2, 32, 32)
        var material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        var sphere = new THREE.Mesh(geometry, material)
        sphere.position.set(position.x, position.y, position.z)
        scene.add(sphere)
        // 当前index数组中包含坐标数等于2时连线
        if (linesPosition[lines.length].length !== 2) return
        let connect = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(linesPosition[lines.length]),
            new THREE.LineBasicMaterial({ linewidth: 1 })
        )
        // 获取两点中间坐标
        let distance = linesPosition[lines.length][0].distanceTo(linesPosition[lines.length][1])
        let _position = new THREE.Vector3(
            (linesPosition[lines.length][0].x + linesPosition[lines.length][1].x) / 2,
            (linesPosition[lines.length][0].y + linesPosition[lines.length][1].y) / 2,
            (linesPosition[lines.length][0].z + linesPosition[lines.length][1].z) / 2
        )
        // 创建射线
        lines.push(connect)
        scene.add(connect)
        // 创建标签
        createLabel(distance.toFixed(4), _position)
    }
    if (measureType === 'angle') {
        if (!anglesPosition[angles.length]) anglesPosition[angles.length] = []
        anglesPosition[angles.length].push(new THREE.Vector3().copy(position))
        // 添加坐标标识点
        var geometry = new THREE.SphereGeometry(0.2, 32, 32)
        var material = new THREE.MeshBasicMaterial({ color: 0x3c78d8 })
        var sphere = new THREE.Mesh(geometry, material)
        sphere.position.set(position.x, position.y, position.z)
        scene.add(sphere)
        if (anglesPosition[angles.length].length < 1) return
        scene.remove(anglesGroup)
        anglesGroup = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(anglesPosition[angles.length]),
            new THREE.LineBasicMaterial({ linewidth: 1 })
        )
        if (anglesPosition[angles.length].length !== 3) return scene.add(anglesGroup)
        // 计算夹角(第二个点对应角度)
        let lengthAB = anglesPosition[angles.length][0].distanceTo(anglesPosition[angles.length][1])
        let lengthBC = anglesPosition[angles.length][1].distanceTo(anglesPosition[angles.length][2])
        let lengthAC = anglesPosition[angles.length][0].distanceTo(anglesPosition[angles.length][2])
        let cosB = (Math.pow(lengthBC, 2) + Math.pow(lengthAB, 2) - Math.pow(lengthAC, 2)) / (2 * lengthBC * lengthAB)
        let angleB = Math.round( Math.acos(cosB) * 180 / Math.PI )
        // 绘制曲线
        let centerPositionAB = new THREE.Line3(anglesPosition[angles.length][0], anglesPosition[angles.length][1]).getCenter()
        let centerPositionBC = new THREE.Line3(anglesPosition[angles.length][1], anglesPosition[angles.length][2]).getCenter()
        let arcGeometry = new THREE.Geometry()
        let arcPath = new THREE.CatmullRomCurve3([
            centerPositionAB,
            centerPositionBC,
        ])
        arcGeometry.vertices = arcPath.getPoints(50)
        let arc = new THREE.Line(
            arcGeometry,
            new THREE.LineBasicMaterial({ color: 0x3c78d8 })
        )
        scene.add(arc)
        // 当满足三个点时
        angles.push(anglesGroup.clone())
        scene.add(anglesGroup.clone())
        // 创建标签
        createLabel(`${angleB}°`, new THREE.Line3(centerPositionAB, centerPositionBC).getCenter())
    }
}

function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
    signRenderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    stats.update()
}

// 视图更新
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    signRenderer.setSize(window.innerWidth, window.innerHeight)
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
