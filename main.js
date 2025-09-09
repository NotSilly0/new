// main.js - Fixed post-apocalyptic 3D sandbox with visible first chunk
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js";

let scene, camera, renderer, clock;
let player = { x: 0, y: 2, z: 0, mesh: null };
let chunks = new Map(); // chunkID => group
let playerStructures = new Map(); // persistent player-built structures
let chunkSize = 50;
let loadedRadius = 2;
let worldScale = 0.05;
let ambientLight, dirLight;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    scene.fog = new THREE.FogExp2(0x111111, 0.002);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(player.x, player.y + 5, player.z + 10);
    camera.lookAt(player.x, player.y, player.z);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    dirLight = new THREE.DirectionalLight(0xffddaa, 1.0);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);

    // Player
    const playerGeo = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    player.mesh = new THREE.Mesh(playerGeo, playerMat);
    player.mesh.position.set(player.x, player.y, player.z);
    scene.add(player.mesh);

    window.addEventListener("keydown", handleKeys);
    window.addEventListener("keyup", handleKeysUp);
    window.addEventListener("resize", onWindowResize);

    // Load initial chunks
    updateChunks();
}

// Key handling
const keys = {};
function handleKeys(event) {
    keys[event.key.toLowerCase()] = event.type === "keydown";
    if (event.key === "p") buildVehicle("plane");
    if (event.key === "b") buildVehicle("boat");
}
function handleKeysUp(event) { keys[event.key.toLowerCase()] = false; }

// Vehicles
let vehicles = [];
function buildVehicle(type) {
    let mesh;
    switch (type) {
        case "plane":
            mesh = new THREE.Mesh(new THREE.BoxGeometry(2,0.4,4),
                new THREE.MeshStandardMaterial({ color: 0xffff00 }));
            const wing = new THREE.Mesh(new THREE.BoxGeometry(4,0.1,1),
                new THREE.MeshStandardMaterial({ color: 0xffff00 }));
            wing.position.y = 0; wing.position.z = 0;
            mesh.add(wing);
            mesh.position.set(player.x+2, player.y+1, player.z);
            break;
        case "boat":
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(1,1,0.5,8),
                new THREE.MeshStandardMaterial({ color: 0x0000ff }));
            mesh.rotation.z = Math.PI/2;
            mesh.position.set(player.x+2,0.25,player.z);
            break;
    }
    if(mesh){ scene.add(mesh); vehicles.push(mesh); saveStructure(mesh); }
}

// Persist structures
function saveStructure(mesh){
    const id = Date.now()+"_"+Math.random();
    playerStructures.set(id,{
        geometry: mesh.geometry.clone(),
        material: mesh.material.clone(),
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone()
    });
}

// Chunk management
function chunkID(x,z){ return `${Math.floor(x/chunkSize)}_${Math.floor(z/chunkSize)}`; }

function updateChunks(){
    const cx = Math.floor(player.mesh.position.x/chunkSize);
    const cz = Math.floor(player.mesh.position.z/chunkSize);

    for(let dx=-loadedRadius;dx<=loadedRadius;dx++){
        for(let dz=-loadedRadius;dz<=loadedRadius;dz++){
            const id = `${cx+dx}_${cz+dz}`;
            if(!chunks.has(id)) createChunk(cx+dx, cz+dz, id);
        }
    }

    // unload far chunks
    chunks.forEach((chunk,id)=>{
        const [x,z] = id.split("_").map(Number);
        if(Math.abs(x-cx)>loadedRadius || Math.abs(z-cz)>loadedRadius) unloadChunk(id);
    });
}

// Create procedural chunk
function createChunk(cx,cz,id){
    const group = new THREE.Group();
    // Terrain blocks
    for(let i=0;i<50;i++){
        const x=(Math.random()-0.5)*chunkSize + cx*chunkSize;
        const z=(Math.random()-0.5)*chunkSize + cz*chunkSize;
        const y=Math.random()*2;
        const geo = new THREE.BoxGeometry(1,y,1);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const block = new THREE.Mesh(geo,mat);
        block.position.set(x,y/2,z);
        group.add(block);
    }
    // Simple buildings
    for(let i=0;i<3;i++){
        const w=Math.random()*3+1;
        const h=Math.random()*5+3;
        const d=Math.random()*3+1;
        const geo=new THREE.BoxGeometry(w,h,d);
        const mat=new THREE.MeshStandardMaterial({color:0x555555,flatShading:true});
        const building=new THREE.Mesh(geo,mat);
        building.position.set(
            cx*chunkSize + (Math.random()-0.5)*chunkSize,
            h/2,
            cz*chunkSize + (Math.random()-0.5)*chunkSize
        );
        group.add(building);
    }

    scene.add(group);
    chunks.set(id,group);
}

// Unload chunk
function unloadChunk(id){
    const chunk = chunks.get(id);
    if(!chunk) return;
    scene.remove(chunk);
    chunks.delete(id);
}

// Player movement
function updatePlayer(delta){
    const speed=10*delta;
    if(keys["w"]) player.mesh.position.z -= speed;
    if(keys["s"]) player.mesh.position.z += speed;
    if(keys["a"]) player.mesh.position.x -= speed;
    if(keys["d"]) player.mesh.position.x += speed;
}

// Animate
function animate(){
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updatePlayer(delta);
    updateChunks();
    animateVehicles(delta);
    animateImmersion(delta);
    renderer.render(scene,camera);
}

// Animate vehicles
function animateVehicles(delta){
    vehicles.forEach(v=>{
        v.position.y += Math.sin(Date.now()*0.001)*delta; 
    });
}

// Immersion effects
function animateImmersion(delta){
    const time=Date.now()*0.001;
    dirLight.position.x = Math.sin(time)*50;
    dirLight.position.z = Math.cos(time)*50;
}

// Resize
function onWindowResize(){
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}
