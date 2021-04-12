import Node from './Node.js'

export default class Player extends Node {

    constructor(mesh, image, options) {
        super(options);
        this.mesh = mesh;
        this.image = image;
    }
}