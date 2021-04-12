import Portal from "./Portal.js";

export default class Scene {

    constructor() {
        this.nodes = [];
        this.portals = [];
    }

    addNode(node) {
        if (node instanceof Portal) {
            this.portals.push(node);
        }
        this.nodes.push(node);
    }

    traverse(before, after) {
        this.nodes.forEach(node => node.traverse(before, after));
    }
}
