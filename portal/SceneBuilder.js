import Mesh from './Mesh.js';

import Node from './Node.js';
import Model from './Model.js';
import Camera from './Camera.js';
import Portal from './Portal.js';
import Player from "./Player.js";
import Checkpoint from "./Checkpoint.js";

import Scene from './Scene.js';

export default class SceneBuilder {

    constructor(spec) {
        this.spec = spec;
    }

    createNode(spec) {
        switch (spec.type) {
            case 'camera': return new Camera(spec);
            case 'portal': {
                const mesh = new Mesh(this.spec.meshes[spec.mesh]);
                const texture = this.spec.textures[spec.texture];
                return new Portal(mesh, texture, spec);
            }
            case 'model': {
                const mesh = new Mesh(this.spec.meshes[spec.mesh]);
                const texture = this.spec.textures[spec.texture];
                return new Model(mesh, texture, spec);
            }
            case 'player': {
                const mesh = new Mesh(this.spec.meshes[spec.mesh]);
                const texture = this.spec.textures[spec.texture];
                return new Player(mesh, texture, spec);
            }
            case 'checkpoint': {
                const mesh = new Mesh(this.spec.meshes[spec.mesh]);
                const texture = this.spec.textures[spec.texture];
                return new Checkpoint(mesh, texture, spec);
            }
            default: return new Node(spec);
        }
    }

    build() {
        let scene = new Scene();
        this.spec.nodes.forEach(spec => scene.addNode(this.createNode(spec)));
        // Poveži portale
        scene.portals[0].updateDestination(scene.portals[1]);
        scene.portals[1].updateDestination(scene.portals[0]);
        scene.portals[2].updateDestination(scene.portals[3]);
        scene.portals[3].updateDestination(scene.portals[2]);
        return scene;
    }

}
