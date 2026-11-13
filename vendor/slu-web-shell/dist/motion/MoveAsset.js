export class MoveLibrary {
    moves = new Map();
    register(move) {
        this.moves.set(move.id, structuredClone(move));
    }
    registerPack(pack) {
        for (const move of pack.moves)
            this.register(move);
    }
    get(id) {
        const move = this.moves.get(id);
        return move ? structuredClone(move) : undefined;
    }
    list(tags) {
        const required = tags ?? [];
        return [...this.moves.values()]
            .filter((move) => required.every((tag) => move.tags?.includes(tag)))
            .map((move) => structuredClone(move));
    }
}
